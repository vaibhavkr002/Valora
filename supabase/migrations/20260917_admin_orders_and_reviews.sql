-- ============================================================================
-- MIGRATION: 20260917_admin_orders_and_reviews.sql
-- DESCRIPTION:
-- 1. Enhanced public.is_admin() checking public.profiles and JWT user_metadata.
-- 2. Explicit admin DELETE policies on public.order_items and public.orders.
-- 3. Atomic secure admin_delete_order(p_order_id UUID) RPC.
-- 4. Atomic secure admin_bulk_delete_orders(p_order_ids UUID[]) RPC.
-- 5. Full CRUD on public.reviews and sync_product_review_stats(p_product_id UUID).
-- ============================================================================

-- 1. ENHANCED IS_ADMIN FUNCTION
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
    v_jwt_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- A) Check database profiles table
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF v_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- B) Check JWT metadata (user_metadata / app_metadata)
    v_jwt_role := COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() ->> 'role'
    );
    IF v_jwt_role = 'admin' THEN
        -- Auto-sync profile role to admin for consistency
        BEGIN
            UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 2. ORDER ITEMS & ORDERS ADMIN DELETE POLICIES
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;
CREATE POLICY "Admins can delete order items"
    ON public.order_items FOR DELETE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
    ON public.orders FOR DELETE
    USING (public.is_admin());

GRANT DELETE ON public.order_items TO authenticated;
GRANT DELETE ON public.orders TO authenticated;

-- 3. ATOMIC SECURE SINGLE ORDER DELETION RPC
CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order_num TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied. Only administrators can delete orders.';
    END IF;

    IF p_order_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order ID is required');
    END IF;

    SELECT order_number INTO v_order_num FROM public.orders WHERE id = p_order_id;
    IF v_order_num IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- 1. Delete related order_items
    DELETE FROM public.order_items WHERE order_id = p_order_id;

    -- 2. Clear any UPI payment transactions referencing this order
    BEGIN
        UPDATE public.upi_payment_transactions SET order_id = NULL WHERE order_id = p_order_id;
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    -- 3. Delete the order record itself
    DELETE FROM public.orders WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'order_number', v_order_num, 'id', p_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.admin_delete_order(UUID) TO authenticated;

-- 4. ATOMIC SECURE BULK ORDER DELETION RPC
CREATE OR REPLACE FUNCTION public.admin_bulk_delete_orders(p_order_ids UUID[])
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INT := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied. Only administrators can delete orders.';
    END IF;

    IF p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL OR array_length(p_order_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No order IDs provided', 'deleted_count', 0);
    END IF;

    -- 1. Delete related order_items for all specified orders
    DELETE FROM public.order_items WHERE order_id = ANY(p_order_ids);

    -- 2. Clear any UPI payment transactions referencing these orders
    BEGIN
        UPDATE public.upi_payment_transactions SET order_id = NULL WHERE order_id = ANY(p_order_ids);
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    -- 3. Delete the orders
    WITH deleted AS (
        DELETE FROM public.orders WHERE id = ANY(p_order_ids)
        RETURNING id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

    RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.admin_bulk_delete_orders(UUID[]) TO authenticated;

-- 5. REVIEWS TABLE SCHEMA & POLICIES
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved reviews" ON public.reviews;
CREATE POLICY "Public can view approved reviews"
    ON public.reviews FOR SELECT
    USING (status = 'approved' OR public.is_admin());

DROP POLICY IF EXISTS "Customers can insert reviews" ON public.reviews;
CREATE POLICY "Customers can insert reviews"
    ON public.reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL OR public.is_admin());

DROP POLICY IF EXISTS "Admins have full CRUD on reviews" ON public.reviews;
CREATE POLICY "Admins have full CRUD on reviews"
    ON public.reviews FOR ALL
    USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;

-- 6. PRODUCT RATING & REVIEW STATS SYNCHRONIZATION RPC
CREATE OR REPLACE FUNCTION public.sync_product_review_stats(p_product_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_count INT;
    v_avg NUMERIC(3, 2);
BEGIN
    SELECT COUNT(*), COALESCE(ROUND(AVG(rating)::numeric, 1), 0.0)
    INTO v_count, v_avg
    FROM public.reviews
    WHERE product_id = p_product_id AND status = 'approved';

    UPDATE public.products
    SET rating = v_avg,
        review_count = v_count
    WHERE id = p_product_id;

    RETURN jsonb_build_object(
        'success', true,
        'product_id', p_product_id,
        'rating', v_avg,
        'review_count', v_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.sync_product_review_stats(UUID) TO anon, authenticated;
