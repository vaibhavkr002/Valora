-- ============================================================================
-- MIGRATION: 20260929_direct_upi_payment_system.sql
-- DESCRIPTION:
-- Extends public.orders and public.payment_transactions with Direct UPI payment
-- verification fields, customer UTR tracking, and manual admin verification audit.
-- Completely removes dependency on external payment gateways.
-- All columns are non-breaking and backwards-compatible with existing schema.
-- ============================================================================

-- 1. EXTEND ORDERS TABLE WITH DIRECT UPI AUDIT FIELDS
DO $$
BEGIN
    -- customer_utr: Optional 12-digit UPI reference / transaction ID entered by customer
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_utr'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN customer_utr TEXT;
    END IF;

    -- payment_submitted_at: Timestamp when customer clicked "I Have Paid"
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_submitted_at'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN payment_submitted_at TIMESTAMPTZ;
    END IF;

    -- verified_at: Timestamp when admin verified bank receipt
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'verified_at'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;

    -- verified_by: Email or identifier of admin who verified payment
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'verified_by'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN verified_by TEXT;
    END IF;

    -- rejection_reason: Reason provided if admin could not find payment
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN rejection_reason TEXT;
    END IF;

    -- merchant_vpa: Default vadii@ptaxis
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'merchant_vpa'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN merchant_vpa TEXT DEFAULT 'vadii@ptaxis';
    END IF;

    -- merchant_name: Default VADI
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'merchant_name'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN merchant_name TEXT DEFAULT 'VADI';
    END IF;
END $$;

COMMENT ON COLUMN public.orders.customer_utr IS '12-digit UPI UTR / Transaction Reference entered by customer';
COMMENT ON COLUMN public.orders.payment_submitted_at IS 'When customer submitted payment confirmation';
COMMENT ON COLUMN public.orders.verified_at IS 'Timestamp of manual bank transaction verification by admin';
COMMENT ON COLUMN public.orders.verified_by IS 'Admin username/email who validated payment against bank ledger';
COMMENT ON COLUMN public.orders.rejection_reason IS 'Explanation if payment verification was rejected';

-- 2. EXTEND PAYMENT_TRANSACTIONS TABLE WITH DIRECT UPI VERIFICATION FIELDS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_transactions') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'customer_utr'
        ) THEN
            ALTER TABLE public.payment_transactions ADD COLUMN customer_utr TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'verified_at'
        ) THEN
            ALTER TABLE public.payment_transactions ADD COLUMN verified_at TIMESTAMPTZ;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'verified_by'
        ) THEN
            ALTER TABLE public.payment_transactions ADD COLUMN verified_by TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'rejection_reason'
        ) THEN
            ALTER TABLE public.payment_transactions ADD COLUMN rejection_reason TEXT;
        END IF;
    END IF;
END $$;

-- 3. INDEXES FOR FAST ORDER AND UTR LOOKUPS
CREATE INDEX IF NOT EXISTS idx_orders_customer_utr ON public.orders(customer_utr) WHERE customer_utr IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_utr ON public.payment_transactions(utr_number) WHERE utr_number IS NOT NULL;
    END IF;
END $$;

-- 4. UPDATE STORE SETTINGS WITH NEW MERCHANT UPI ID
INSERT INTO public.store_settings (key, value, updated_at)
VALUES (
    'payment',
    jsonb_build_object(
        'merchant_vpa', 'vadii@ptaxis',
        'merchant_name', 'VADI',
        'upi_enabled', true,
        'gpay_enabled', true,
        'phonepe_enabled', true,
        'paytm_enabled', true,
        'bhim_enabled', true,
        'generic_upi_enabled', true
    ),
    NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_build_object(
    'merchant_vpa', 'vadii@ptaxis',
    'merchant_name', 'VADI',
    'upi_enabled', true,
    'gpay_enabled', true,
    'phonepe_enabled', true,
    'paytm_enabled', true,
    'bhim_enabled', true,
    'generic_upi_enabled', true
),
updated_at = NOW();
