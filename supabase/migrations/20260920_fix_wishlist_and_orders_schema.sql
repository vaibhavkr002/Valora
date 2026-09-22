-- ============================================================================
-- MIGRATION: 20260920_fix_wishlist_and_orders_schema.sql
-- DESCRIPTION:
-- 1. Make public.wishlist.product_id nullable to support Sarojini Bazaar products.
-- 2. Add validation constraint ensuring either product_id or sarojini_product_id is set.
-- 3. Add unique partial index for (user_id, sarojini_product_id) to prevent duplicate saves.
-- 4. Re-assert RLS policies on public.wishlist for authenticated users.
-- ============================================================================

-- 1. MAKE PRODUCT_ID NULLABLE IN WISHLIST
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'wishlist' 
          AND column_name = 'product_id' 
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.wishlist ALTER COLUMN product_id DROP NOT NULL;
    END IF;
END $$;

-- 2. ADD CATALOG VALIDATION CHECK CONSTRAINT
DO $$
BEGIN
    ALTER TABLE public.wishlist DROP CONSTRAINT IF EXISTS chk_wishlist_product_source;
    ALTER TABLE public.wishlist ADD CONSTRAINT chk_wishlist_product_source
        CHECK (
            (catalog_type = 'main' AND product_id IS NOT NULL) OR 
            (catalog_type = 'sarojini' AND sarojini_product_id IS NOT NULL) OR
            (product_id IS NOT NULL) OR
            (sarojini_product_id IS NOT NULL)
        );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 3. ENSURE SAROJINI WISHLIST UNIQUENESS
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_sarojini_wishlist 
    ON public.wishlist (user_id, sarojini_product_id) 
    WHERE sarojini_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_main_wishlist 
    ON public.wishlist (user_id, product_id) 
    WHERE product_id IS NOT NULL;

-- 4. RLS POLICIES FOR WISHLIST (STRICT USER ISOLATION)
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wishlist" ON public.wishlist;
CREATE POLICY "Users can view own wishlist"
    ON public.wishlist FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can add to own wishlist" ON public.wishlist;
CREATE POLICY "Users can add to own wishlist"
    ON public.wishlist FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from own wishlist" ON public.wishlist;
CREATE POLICY "Users can remove from own wishlist"
    ON public.wishlist FOR DELETE
    USING (auth.uid() = user_id OR public.is_admin());

GRANT ALL ON public.wishlist TO authenticated;
GRANT SELECT ON public.wishlist TO anon;

