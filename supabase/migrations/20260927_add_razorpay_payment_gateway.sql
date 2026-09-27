-- ============================================================================
-- MIGRATION: 20260927_add_razorpay_payment_gateway.sql
-- DESCRIPTION:
-- Extends public.orders and public.payment_transactions with Razorpay
-- payment gateway identifiers, verification signatures, and refund fields.
-- All columns are non-breaking and backwards-compatible with existing schema.
-- ============================================================================

-- 1. EXTEND ORDERS TABLE WITH RAZORPAY AND REFUND FIELDS
DO $$
BEGIN
    -- razorpay_order_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'razorpay_order_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN razorpay_order_id TEXT;
    END IF;

    -- razorpay_payment_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'razorpay_payment_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN razorpay_payment_id TEXT;
    END IF;

    -- razorpay_signature
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'razorpay_signature'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN razorpay_signature TEXT;
    END IF;

    -- payment_gateway
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_gateway'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN payment_gateway TEXT DEFAULT 'razorpay';
    END IF;

    -- refund_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'refund_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN refund_id TEXT;
    END IF;

    -- refund_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'refund_status'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN refund_status TEXT DEFAULT 'not_applicable';
    END IF;

    -- refund_amount
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'refund_amount'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN refund_amount NUMERIC(12, 2) DEFAULT 0.00;
    END IF;

    -- refund_notes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'refund_notes'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN refund_notes TEXT;
    END IF;

    -- refunded_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'refunded_at'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN refunded_at TIMESTAMPTZ;
    END IF;
END $$;

COMMENT ON COLUMN public.orders.razorpay_order_id IS 'Official Razorpay Order ID (e.g. order_OPWk9b...)';
COMMENT ON COLUMN public.orders.razorpay_payment_id IS 'Official Razorpay Payment ID (e.g. pay_OPWk9b...)';
COMMENT ON COLUMN public.orders.razorpay_signature IS 'HMAC SHA256 payment signature verified server-side';
COMMENT ON COLUMN public.orders.payment_gateway IS 'Payment processor identity: razorpay, cod, manual';

-- 2. EXTEND PAYMENT_TRANSACTIONS TABLE WITH RAZORPAY FIELDS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_transactions') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'razorpay_order_id'
        ) THEN
            ALTER TABLE public.payment_transactions ADD COLUMN razorpay_order_id TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'razorpay_payment_id'
        ) THEN
            ALTER TABLE public.payment_transactions ADD COLUMN razorpay_payment_id TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'razorpay_signature'
        ) THEN
            ALTER TABLE public.payment_transactions ADD COLUMN razorpay_signature TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'payment_gateway'
        ) THEN
            ALTER TABLE public.payment_transactions ADD COLUMN payment_gateway TEXT DEFAULT 'razorpay';
        END IF;
    END IF;
END $$;

-- 3. INDEXES FOR FAST ORDER AND PAYMENT LOOKUP
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON public.orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_rzp_order ON public.payment_transactions(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_rzp_payment ON public.payment_transactions(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
    END IF;
END $$;
