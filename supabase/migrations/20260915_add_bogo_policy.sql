-- ============================================================================
-- VELORA - BOGO CONFIGURATION RLS POLICY & SEED MIGRATION
-- ============================================================================
-- 1. Permits public storefront users to read 'bogo_config' from store_settings.
-- 2. Initializes bogo_config key if it does not already exist.
-- ============================================================================

-- 1. Update public SELECT policy on store_settings to include bogo_config
DROP POLICY IF EXISTS "Public can view safe store settings" ON public.store_settings;
CREATE POLICY "Public can view safe store settings"
    ON public.store_settings FOR SELECT
    USING (public.is_admin() OR key IN ('general', 'shipping', 'social', 'gift_offers_config', 'bogo_config'));

-- 2. Initialize bogo_config with default eligible deal products if not already configured
DO $$
DECLARE
    deal_ids JSONB;
BEGIN
    -- Collect IDs of existing active deal/featured products to populate default BOGO catalog
    SELECT jsonb_agg(id::text) INTO deal_ids
    FROM (
        SELECT id FROM public.products 
        WHERE is_active = true AND (is_deal = true OR is_featured = true)
        ORDER BY created_at DESC 
        LIMIT 12
    ) sub;

    IF deal_ids IS NULL THEN
        deal_ids := '[]'::jsonb;
    END IF;

    -- Insert bogo_config only if key does not exist yet
    INSERT INTO public.store_settings (key, value, updated_at)
    VALUES (
        'bogo_config',
        jsonb_build_object('product_ids', deal_ids, 'updated_at', NOW()),
        NOW()
    )
    ON CONFLICT (key) DO NOTHING;
END $$;

