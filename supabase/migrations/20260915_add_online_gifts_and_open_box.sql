-- ============================================================================
-- VELORA - FULL ONLINE PAYMENT BENEFITS & OPEN BOX DELIVERY MIGRATION
-- ============================================================================
-- Adds delivery_preference, free_gifts_eligible, free_gifts_items, and
-- is_full_online_payment to the orders table.
-- Idempotent, safe execution with IF NOT EXISTS checks.
-- ============================================================================

DO $$ 
BEGIN
    -- 1. delivery_preference: 'Simple Delivery' (default) or 'Open Box Delivery'
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_preference'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN delivery_preference TEXT NOT NULL DEFAULT 'Simple Delivery';
    END IF;

    -- 2. free_gifts_eligible: boolean flag indicating if order earned 3 free gifts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'free_gifts_eligible'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN free_gifts_eligible BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- 3. free_gifts_items: JSONB array detailing the 3 complimentary gifts included
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'free_gifts_items'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN free_gifts_items JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    -- 4. is_full_online_payment: boolean flag confirming 100% online payment was captured
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'is_full_online_payment'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN is_full_online_payment BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

COMMENT ON COLUMN public.orders.delivery_preference IS 'Customer delivery preference: Simple Delivery or Open Box Delivery';
COMMENT ON COLUMN public.orders.free_gifts_eligible IS 'True if customer paid 100% online and unlocked 3 complimentary gifts';
COMMENT ON COLUMN public.orders.free_gifts_items IS 'Structured metadata list of free gifts included with this order (Socks, Extra Laces, Keychain)';
COMMENT ON COLUMN public.orders.is_full_online_payment IS 'True if entire order was paid online without COD or partial COD balance';

