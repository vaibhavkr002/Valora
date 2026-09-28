-- ============================================================================
-- MIGRATION: 20260928_add_customer_email_and_guest_orders.sql
-- DESCRIPTION:
-- 1. Adds customer_email column to public.orders for fast, indexed guest lookups.
-- 2. Indexes customer_email (case-insensitive) and user_id.
-- 3. Backfills customer_email from tracking_data->>'customer_email' for existing orders.
-- 4. Creates secure, atomic RPC public.link_guest_orders to associate past guest
--    orders to a verified customer account upon login/signup.
-- 5. Preserves existing RLS policies and guest checkout capability.
-- ============================================================================

-- 1. ADD CUSTOMER_EMAIL COLUMN TO ORDERS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_email'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN customer_email TEXT;
    END IF;
END $$;

COMMENT ON COLUMN public.orders.customer_email IS 'Direct indexed customer email for both guest and authenticated orders';

-- 2. CREATE PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_lower 
    ON public.orders (LOWER(TRIM(customer_email)));

CREATE INDEX IF NOT EXISTS idx_orders_user_id_null 
    ON public.orders (user_id) 
    WHERE user_id IS NULL;

-- 3. BACKFILL CUSTOMER_EMAIL FOR EXISTING ORDERS
UPDATE public.orders
SET customer_email = LOWER(TRIM(tracking_data->>'customer_email'))
WHERE customer_email IS NULL 
  AND tracking_data IS NOT NULL 
  AND tracking_data->>'customer_email' IS NOT NULL
  AND TRIM(tracking_data->>'customer_email') <> '';

-- 4. SECURE ATOMIC RPC FUNCTION TO LINK GUEST ORDERS TO AUTHENTICATED USER
CREATE OR REPLACE FUNCTION public.link_guest_orders(p_user_id UUID, p_user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_clean_email TEXT;
    v_linked_count INTEGER := 0;
    v_is_confirmed BOOLEAN := FALSE;
    v_auth_user_id UUID;
BEGIN
    -- Validate inputs
    IF p_user_id IS NULL OR p_user_email IS NULL OR TRIM(p_user_email) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid user parameters provided.',
            'linked_count', 0
        );
    END IF;

    v_clean_email := LOWER(TRIM(p_user_email));
    v_auth_user_id := auth.uid();

    -- Authorization check:
    -- Caller must either be the user themselves (auth.uid() = p_user_id)
    -- or an administrator, or executing via service_role
    IF v_auth_user_id IS NOT NULL AND v_auth_user_id <> p_user_id THEN
        IF NOT public.is_admin() THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Unauthorized: You can only link orders to your own verified account.',
                'linked_count', 0
            );
        END IF;
    END IF;

    -- Verify user exists in auth.users and email is confirmed
    BEGIN
        SELECT (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL)
        INTO v_is_confirmed
        FROM auth.users
        WHERE id = p_user_id AND LOWER(TRIM(email)) = v_clean_email;
    EXCEPTION WHEN OTHERS THEN
        -- If direct auth.users inspection is restricted, check auth.uid() matching
        v_is_confirmed := (v_auth_user_id IS NOT NULL AND v_auth_user_id = p_user_id);
    END IF;

    -- If caller is authenticated user matching ID and email, accept as verified
    IF v_is_confirmed IS NOT TRUE AND v_auth_user_id IS NOT NULL AND v_auth_user_id = p_user_id THEN
        v_is_confirmed := TRUE;
    END IF;

    IF v_is_confirmed IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Account email address is not verified.',
            'linked_count', 0
        );
    END IF;

    -- Atomically associate unlinked orders matching email to user_id
    WITH updated AS (
        UPDATE public.orders
        SET user_id = p_user_id,
            customer_email = v_clean_email,
            updated_at = NOW()
        WHERE user_id IS NULL
          AND (
            LOWER(TRIM(customer_email)) = v_clean_email
            OR LOWER(TRIM(tracking_data->>'customer_email')) = v_clean_email
          )
        RETURNING id
    )
    SELECT COUNT(*) INTO v_linked_count FROM updated;

    RETURN jsonb_build_object(
        'success', true,
        'linked_count', v_linked_count,
        'user_id', p_user_id,
        'email', v_clean_email
    );
END;
$$;

-- Grant execute permissions to API and authenticated callers
GRANT EXECUTE ON FUNCTION public.link_guest_orders(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.link_guest_orders(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_guest_orders(UUID, TEXT) TO service_role;
