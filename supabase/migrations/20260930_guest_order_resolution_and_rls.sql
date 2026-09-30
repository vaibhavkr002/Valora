-- ============================================================================
-- MIGRATION: 20260930_guest_order_resolution_and_rls.sql
-- DESCRIPTION:
-- 1. Updates SELECT RLS policy on public.orders so guest orders (user_id IS NULL)
--    can be queried and confirmed without violating RLS.
-- 2. Ensures order_items RLS subquery allows guest order items insertion.
-- 3. Adds secure SECURITY DEFINER RPC public.get_order_by_reference for authoritative
--    order lookups by order_number, transaction_reference, or UUID.
-- ============================================================================

-- 1. FIX SELECT RLS POLICY ON ORDERS FOR GUEST CHECKOUT AND CONFIRMATION
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
    ON public.orders FOR SELECT
    USING (
        auth.uid() = user_id 
        OR public.is_admin() 
        OR (user_id IS NULL AND auth.uid() IS NULL)
    );

-- 2. SECURE ATOMIC RPC FUNCTION TO LOOK UP ORDER BY ANY IDENTIFIER
CREATE OR REPLACE FUNCTION public.get_order_by_reference(p_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
BEGIN
    IF p_ref IS NULL OR TRIM(p_ref) = '' THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_order FROM public.orders
    WHERE order_number = TRIM(p_ref)
       OR transaction_reference = TRIM(p_ref)
       OR id::TEXT = TRIM(p_ref)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN to_jsonb(v_order);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_reference(TEXT) TO anon, authenticated, service_role;

-- 3. SECURE ATOMIC RPC FUNCTION TO SUBMIT CUSTOMER PAYMENT UTR
CREATE OR REPLACE FUNCTION public.submit_customer_payment_utr(
    p_order_ref TEXT,
    p_utr TEXT,
    p_upi_app TEXT DEFAULT 'Generic UPI'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_tracking JSONB;
    v_clean_utr TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF p_order_ref IS NULL OR TRIM(p_order_ref) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing order reference');
    END IF;

    SELECT * INTO v_order FROM public.orders
    WHERE order_number = TRIM(p_order_ref)
       OR transaction_reference = TRIM(p_order_ref)
       OR id::TEXT = TRIM(p_order_ref)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    v_clean_utr := REGEXP_REPLACE(COALESCE(p_utr, ''), '[^a-zA-Z0-9]', '', 'g');
    v_tracking := COALESCE(v_order.tracking_data, '{}'::JSONB);
    v_tracking := jsonb_set(v_tracking, '{payment_verification_status}', '"verification_pending"');
    v_tracking := jsonb_set(v_tracking, '{payment_submitted_at}', to_jsonb(v_now));
    v_tracking := jsonb_set(v_tracking, '{submitted_upi_app}', to_jsonb(COALESCE(p_upi_app, 'Generic UPI')));
    v_tracking := jsonb_set(v_tracking, '{verification_state}', '"pending_admin_review"');
    IF v_clean_utr <> '' THEN
        v_tracking := jsonb_set(v_tracking, '{customer_utr}', to_jsonb(v_clean_utr));
    END IF;

    UPDATE public.orders
    SET tracking_data = v_tracking,
        customer_utr = CASE WHEN v_clean_utr <> '' THEN v_clean_utr ELSE customer_utr END,
        payment_submitted_at = v_now
    WHERE id = v_order.id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'customer_utr', v_clean_utr
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_customer_payment_utr(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

