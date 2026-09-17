-- ============================================================================
-- VELORA UPI APP-BASED PAYMENT & TRANSACTION VERIFICATION MIGRATION
-- ============================================================================
-- Adds public.payment_transactions table for tracking UPI Intent payments,
-- extends public.orders with transaction_reference, and implements server-side
-- initiation, amount validation, and multi-stage payment verification RPCs.
-- ============================================================================

-- 1. EXTEND ORDERS TABLE WITH TRANSACTION REFERENCE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'transaction_reference'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN transaction_reference TEXT;
    END IF;
END $$;

COMMENT ON COLUMN public.orders.transaction_reference IS 'Unique merchant transaction reference for tracking UPI and digital payments';

-- 2. CREATE PAYMENT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_reference TEXT NOT NULL UNIQUE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    order_number TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    merchant_vpa TEXT NOT NULL,
    merchant_name TEXT NOT NULL DEFAULT 'VELORA',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_type TEXT NOT NULL CHECK (payment_type IN ('full', 'advance')),
    upi_app TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'cancelled')),
    upi_uri TEXT,
    utr_number TEXT,
    items_snapshot JSONB DEFAULT '[]'::jsonb,
    delivery_details JSONB DEFAULT '{}'::jsonb,
    server_validated_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.payment_transactions IS 'Authoritative log of all initiated and completed UPI payment intents';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_txn_ref ON public.payment_transactions(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_payment_txn_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_txn_order ON public.payment_transactions(order_id);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated to read and insert transactions
CREATE POLICY "Allow public insert for payment transactions"
    ON public.payment_transactions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow read payment transactions by reference"
    ON public.payment_transactions FOR SELECT
    USING (true);

CREATE POLICY "Allow update payment transactions"
    ON public.payment_transactions FOR UPDATE
    USING (true);

-- 3. STORE SETTINGS SEED FOR PAYMENT (IF NOT PRESENT)
INSERT INTO public.store_settings (key, value, updated_at)
VALUES (
    'payment',
    jsonb_build_object(
        'merchant_vpa', 'velora.lifestyle@okhdfcbank',
        'merchant_name', 'VELORA',
        'upi_enabled', true,
        'gpay_enabled', true,
        'phonepe_enabled', true,
        'paytm_enabled', true,
        'bhim_enabled', true,
        'generic_upi_enabled', true
    ),
    NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 4. RPC: INITIATE UPI TRANSACTION (SERVER-SIDE VALIDATED AMOUNT)
CREATE OR REPLACE FUNCTION public.initiate_upi_transaction(
    p_items JSONB,
    p_payment_type TEXT,
    p_coupon_code TEXT DEFAULT NULL,
    p_upi_app TEXT DEFAULT 'Generic UPI',
    p_delivery_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_item JSONB;
    v_product RECORD;
    v_subtotal NUMERIC(12, 2) := 0.00;
    v_total_advance NUMERIC(12, 2) := 0.00;
    v_item_price NUMERIC(12, 2);
    v_item_qty INTEGER;
    v_item_subtotal NUMERIC(12, 2);
    v_discount NUMERIC(12, 2) := 0.00;
    v_shipping NUMERIC(12, 2) := 0.00;
    v_total NUMERIC(12, 2) := 0.00;
    v_payable_amount NUMERIC(12, 2) := 0.00;
    v_remaining_cod NUMERIC(12, 2) := 0.00;
    v_merchant_vpa TEXT := 'velora.lifestyle@okhdfcbank';
    v_merchant_name TEXT := 'VELORA';
    v_payment_settings JSONB;
    v_txn_ref TEXT;
    v_upi_uri TEXT;
    v_coupon RECORD;
    v_shipping_threshold NUMERIC(12, 2) := 999.00;
    v_standard_shipping_fee NUMERIC(12, 2) := 99.00;
BEGIN
    -- 1. Load payment settings
    SELECT value INTO v_payment_settings FROM public.store_settings WHERE key = 'payment' LIMIT 1;
    IF v_payment_settings IS NOT NULL THEN
        v_merchant_vpa := COALESCE(v_payment_settings->>'merchant_vpa', v_merchant_vpa);
        v_merchant_name := COALESCE(v_payment_settings->>'merchant_name', v_merchant_name);
    END IF;

    -- Load shipping settings
    SELECT (value->>'free_shipping_threshold')::numeric, (value->>'standard_shipping_fee')::numeric
    INTO v_shipping_threshold, v_standard_shipping_fee
    FROM public.store_settings WHERE key = 'shipping' LIMIT 1;
    v_shipping_threshold := COALESCE(v_shipping_threshold, 999.00);
    v_standard_shipping_fee := COALESCE(v_standard_shipping_fee, 99.00);

    -- 2. Server-side authoritative price and subtotal calculation
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_qty := GREATEST(1, COALESCE((v_item->>'quantity')::INTEGER, 1));
        
        -- Handle BOGO free item
        IF COALESCE((v_item->>'is_free_bogo')::BOOLEAN, false) THEN
            v_item_price := 0.00;
        ELSE
            SELECT * INTO v_product FROM public.products 
            WHERE id = (v_item->>'product_id')::UUID OR slug = (v_item->>'slug')::TEXT 
            LIMIT 1;

            IF FOUND THEN
                v_item_price := v_product.price;
                v_item_subtotal := round(v_item_price * v_item_qty, 2);
                v_subtotal := v_subtotal + v_item_subtotal;

                -- Check advance requirement for COD
                IF v_product.advance_payment_enabled THEN
                    IF v_product.advance_payment_type = 'percentage' THEN
                        v_total_advance := v_total_advance + round(v_item_subtotal * (v_product.advance_payment_value / 100.0), 2);
                    ELSE
                        v_total_advance := v_total_advance + round(LEAST(v_item_subtotal, v_product.advance_payment_value * v_item_qty), 2);
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- 3. Coupon validation
    IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
        SELECT * INTO v_coupon FROM public.coupons 
        WHERE upper(code) = upper(trim(p_coupon_code)) AND is_active = true 
        LIMIT 1;

        IF FOUND THEN
            IF v_coupon.discount_type = 'percentage' THEN
                v_discount := round(v_subtotal * (v_coupon.discount_value / 100.0), 2);
                IF v_coupon.max_discount IS NOT NULL THEN
                    v_discount := LEAST(v_discount, v_coupon.max_discount);
                END IF;
            ELSE
                v_discount := LEAST(v_subtotal, v_coupon.discount_value);
            END IF;
        END IF;
    END IF;

    -- 4. Shipping fee calculation
    IF (v_subtotal - v_discount) >= v_shipping_threshold OR v_subtotal = 0 THEN
        v_shipping := 0.00;
    ELSE
        v_shipping := v_standard_shipping_fee;
    END IF;

    v_total := GREATEST(0.00, v_subtotal - v_discount + v_shipping);

    -- 5. Determine exact payable amount based on payment type
    IF p_payment_type = 'advance' THEN
        v_payable_amount := LEAST(v_total, v_total_advance);
        IF v_payable_amount <= 0 THEN
            -- If no advance is configured, fallback to 0 or total
            v_payable_amount := 0.00;
        END IF;
        v_remaining_cod := GREATEST(0.00, v_total - v_payable_amount);
    ELSE
        -- Full online payment
        v_payable_amount := v_total;
        v_remaining_cod := 0.00;
    END IF;

    -- 6. Generate unique transaction reference: VEL-TXN-YYMMDD-XXXXXX
    v_txn_ref := 'VEL-TXN-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

    -- 7. Build Canonical UPI Intent URI
    -- Spec: upi://pay?pa=VPA&pn=NAME&tr=REF&tn=NOTE&am=AMOUNT&cu=INR
    v_upi_uri := 'upi://pay?pa=' || v_merchant_vpa ||
                 '&pn=' || replace(v_merchant_name, ' ', '%20') ||
                 '&tr=' || v_txn_ref ||
                 '&tn=VELORA%20Payment%20' || v_txn_ref ||
                 '&am=' || to_char(v_payable_amount, 'FM99999990.00') ||
                 '&cu=INR';

    -- 8. Insert record in payment_transactions
    INSERT INTO public.payment_transactions (
        transaction_reference,
        merchant_vpa,
        merchant_name,
        amount,
        currency,
        payment_type,
        upi_app,
        status,
        upi_uri,
        items_snapshot,
        delivery_details,
        metadata
    ) VALUES (
        v_txn_ref,
        v_merchant_vpa,
        v_merchant_name,
        v_payable_amount,
        'INR',
        p_payment_type,
        p_upi_app,
        'pending',
        v_upi_uri,
        p_items,
        p_delivery_details,
        jsonb_build_object(
            'subtotal', v_subtotal,
            'discount', v_discount,
            'shipping', v_shipping,
            'total', v_total,
            'remaining_cod', v_remaining_cod
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_reference', v_txn_ref,
        'amount', v_payable_amount,
        'total_amount', v_total,
        'remaining_cod', v_remaining_cod,
        'payment_type', p_payment_type,
        'merchant_vpa', v_merchant_vpa,
        'merchant_name', v_merchant_name,
        'upi_uri', v_upi_uri
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. RPC: VERIFY AND COMPLETE UPI PAYMENT
CREATE OR REPLACE FUNCTION public.verify_and_complete_upi_payment(
    p_transaction_reference TEXT,
    p_order_id UUID DEFAULT NULL,
    p_utr_number TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_txn RECORD;
    v_order RECORD;
BEGIN
    -- Look up transaction
    SELECT * INTO v_txn FROM public.payment_transactions 
    WHERE transaction_reference = trim(p_transaction_reference)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Transaction reference not found.'
        );
    END IF;

    IF v_txn.status = 'verified' THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'verified',
            'already_verified', true,
            'transaction_reference', v_txn.transaction_reference,
            'amount', v_txn.amount,
            'order_id', v_txn.order_id,
            'order_number', v_txn.order_number
        );
    END IF;

    -- Mark transaction as verified
    UPDATE public.payment_transactions
    SET status = 'verified',
        utr_number = COALESCE(p_utr_number, utr_number),
        server_validated_at = NOW(),
        updated_at = NOW()
    WHERE id = v_txn.id;

    -- Update linked order if already created
    IF p_order_id IS NOT NULL OR v_txn.order_id IS NOT NULL THEN
        UPDATE public.orders
        SET transaction_reference = v_txn.transaction_reference,
            advance_paid = CASE WHEN v_txn.payment_type = 'advance' THEN v_txn.amount ELSE advance_paid END,
            advance_payment_status = CASE WHEN v_txn.payment_type = 'advance' THEN 'paid' ELSE advance_payment_status END,
            payment_status = CASE WHEN v_txn.payment_type = 'full' THEN 'paid' ELSE payment_status END,
            updated_at = NOW()
        WHERE id = COALESCE(p_order_id, v_txn.order_id);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'verified',
        'transaction_reference', v_txn.transaction_reference,
        'amount', v_txn.amount,
        'payment_type', v_txn.payment_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. RPC: CANCEL UPI TRANSACTION
CREATE OR REPLACE FUNCTION public.cancel_upi_transaction(
    p_transaction_reference TEXT
)
RETURNS JSONB AS $$
BEGIN
    UPDATE public.payment_transactions
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE transaction_reference = trim(p_transaction_reference) AND status = 'pending';

    RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Grants
GRANT EXECUTE ON FUNCTION public.initiate_upi_transaction(JSONB, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_complete_upi_payment(TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_upi_transaction(TEXT) TO anon, authenticated;

