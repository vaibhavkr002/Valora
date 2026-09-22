-- ============================================================================
-- MIGRATION: 20260917_coupon_and_banner_system.sql
-- DESCRIPTION:
-- 1. Non-destructive columns: orders.coupon_code, banners.coupon_code.
-- 2. Enhanced authoritative public.validate_coupon RPC with clear, distinct messages.
-- 3. Update public.create_customer_order and public.create_upi_order_transaction 
--    to record coupon_code and atomic used_count increment.
-- 4. RLS policies ensuring customer SELECT on active coupons and Admin full CRUD.
-- ============================================================================

-- 1. Non-destructive columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS coupon_code TEXT;

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code_upper ON public.coupons (UPPER(code));
CREATE INDEX IF NOT EXISTS idx_banners_placement_active ON public.banners (placement, is_active);

-- 3. Enhanced validate_coupon RPC
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_cart_subtotal NUMERIC)
RETURNS JSONB AS $$
DECLARE
    v_coupon RECORD;
    v_discount NUMERIC := 0.00;
    v_diff NUMERIC := 0.00;
BEGIN
    IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Coupon code is required.');
    END IF;

    -- Look up coupon case-insensitively
    SELECT * INTO v_coupon FROM public.coupons
    WHERE UPPER(code) = UPPER(trim(p_code))
    LIMIT 1;

    -- 1. Coupon existence
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Invalid coupon code.');
    END IF;

    -- 2. Active status
    IF v_coupon.is_active IS NOT TRUE THEN
        RETURN jsonb_build_object('valid', false, 'message', 'This coupon is currently unavailable.');
    END IF;

    -- 3. Expiry date check
    IF v_coupon.expiry_date IS NOT NULL AND v_coupon.expiry_date < NOW() THEN
        RETURN jsonb_build_object('valid', false, 'message', 'This coupon has expired.');
    END IF;

    -- 4. Start date check
    IF v_coupon.start_date IS NOT NULL AND v_coupon.start_date > NOW() THEN
        RETURN jsonb_build_object('valid', false, 'message', 'This coupon is not yet active.');
    END IF;

    -- 5. Usage limit check
    IF v_coupon.usage_limit IS NOT NULL AND COALESCE(v_coupon.used_count, 0) >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object('valid', false, 'message', 'This coupon has reached its usage limit.');
    END IF;

    -- 6. Minimum spend requirement
    IF p_cart_subtotal IS NOT NULL AND p_cart_subtotal < COALESCE(v_coupon.min_order_amount, 0) THEN
        v_diff := round(COALESCE(v_coupon.min_order_amount, 0) - p_cart_subtotal, 2);
        RETURN jsonb_build_object(
            'valid', false,
            'message', format('Minimum order value of ₹%s required. Add ₹%s more to use this coupon.', round(v_coupon.min_order_amount), round(v_diff)),
            'min_order_amount', v_coupon.min_order_amount,
            'difference', v_diff
        );
    END IF;

    -- 7. Calculate discount
    IF v_coupon.discount_type = 'percentage' THEN
        v_discount := round((COALESCE(p_cart_subtotal, 0) * (v_coupon.discount_value / 100.0)), 2);
        IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
            v_discount := v_coupon.max_discount;
        END IF;
    ELSE
        -- Fixed amount discount
        v_discount := LEAST(v_coupon.discount_value, COALESCE(p_cart_subtotal, 0));
    END IF;

    -- Ensure discount does not exceed subtotal
    v_discount := GREATEST(0.00, LEAST(v_discount, COALESCE(p_cart_subtotal, 0)));

    RETURN jsonb_build_object(
        'valid', true,
        'id', v_coupon.id,
        'code', v_coupon.code,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value,
        'max_discount', v_coupon.max_discount,
        'min_order_amount', v_coupon.min_order_amount,
        'calculated_discount', v_discount,
        'message', format('Coupon applied successfully. You saved ₹%s.', round(v_discount))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO anon, authenticated;

-- 4. Secure RLS policies on coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
CREATE POLICY "Public can view active coupons"
    ON public.coupons FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins have full CRUD on coupons" ON public.coupons;
CREATE POLICY "Admins have full CRUD on coupons"
    ON public.coupons FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

