-- ============================================================================
-- VELORA ADVANCE PAYMENT FEATURE - DATABASE MIGRATION
-- ============================================================================
-- Adds optional product advance-payment configuration fields to products table,
-- and preserves historical advance and COD balance information on orders and order_items.
-- Safe, idempotent execution with IF NOT EXISTS checks and RLS compatibility.
-- ============================================================================

-- 1. EXTEND PRODUCTS TABLE
DO $$ 
BEGIN
    -- Add advance_payment_enabled (boolean flag, default false for all existing products)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'advance_payment_enabled'
    ) THEN
        ALTER TABLE public.products ADD COLUMN advance_payment_enabled BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add advance_payment_type ('fixed' or 'percentage', default 'fixed')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'advance_payment_type'
    ) THEN
        ALTER TABLE public.products ADD COLUMN advance_payment_type TEXT NOT NULL DEFAULT 'fixed' 
            CHECK (advance_payment_type IN ('fixed', 'percentage'));
    END IF;

    -- Add advance_payment_value (numeric amount or percentage, default 0)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'advance_payment_value'
    ) THEN
        ALTER TABLE public.products ADD COLUMN advance_payment_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 
            CHECK (advance_payment_value >= 0);
    END IF;
END $$;

COMMENT ON COLUMN public.products.advance_payment_enabled IS 'Controls whether this product requires an advance payment before confirmation';
COMMENT ON COLUMN public.products.advance_payment_type IS 'Calculation type: fixed (in INR) or percentage (of product price)';
COMMENT ON COLUMN public.products.advance_payment_value IS 'Advance amount in INR or percentage value between 0 and 100';

-- 2. EXTEND ORDERS TABLE
DO $$ 
BEGIN
    -- advance_amount: Total advance required for the order
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'advance_amount'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN advance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (advance_amount >= 0);
    END IF;

    -- advance_paid: Amount of advance collected online prior to order confirmation
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'advance_paid'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN advance_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (advance_paid >= 0);
    END IF;

    -- cod_balance: Remaining amount to be collected at doorstep via Cash on Delivery
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'cod_balance'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN cod_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cod_balance >= 0);
    END IF;

    -- advance_payment_status: Lifecycle status of the advance portion
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'advance_payment_status'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN advance_payment_status TEXT NOT NULL DEFAULT 'not_required' 
            CHECK (advance_payment_status IN ('not_required', 'pending', 'paid', 'failed', 'refunded'));
    END IF;

    -- cod_payment_status: Lifecycle status of the COD balance portion
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'cod_payment_status'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN cod_payment_status TEXT NOT NULL DEFAULT 'not_applicable' 
            CHECK (cod_payment_status IN ('not_applicable', 'pending', 'collected'));
    END IF;
END $$;

COMMENT ON COLUMN public.orders.advance_amount IS 'Total calculated advance required for all products in this order';
COMMENT ON COLUMN public.orders.advance_paid IS 'Actual advance payment captured online prior to order confirmation';
COMMENT ON COLUMN public.orders.cod_balance IS 'Remaining balance to be collected via Cash on Delivery upon shipment arrival';
COMMENT ON COLUMN public.orders.advance_payment_status IS 'Status of online advance payment: not_required, pending, paid, failed, refunded';
COMMENT ON COLUMN public.orders.cod_payment_status IS 'Status of COD collection: not_applicable, pending, collected';

-- 3. EXTEND ORDER_ITEMS TABLE
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'advance_payment_enabled'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN advance_payment_enabled BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'advance_payment_type'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN advance_payment_type TEXT DEFAULT 'fixed';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'advance_payment_value'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN advance_payment_value NUMERIC(12, 2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'advance_amount'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN advance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (advance_amount >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'cod_balance'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN cod_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cod_balance >= 0);
    END IF;
END $$;

COMMENT ON COLUMN public.order_items.advance_amount IS 'Advance amount snapshot locked for this line item at order placement time';
COMMENT ON COLUMN public.order_items.cod_balance IS 'COD balance snapshot locked for this line item at order placement time';

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_products_advance ON public.products(advance_payment_enabled);
CREATE INDEX IF NOT EXISTS idx_orders_advance_status ON public.orders(advance_payment_status);
