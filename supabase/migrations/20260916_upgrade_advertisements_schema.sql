-- ============================================================================
-- VELORA - DYNAMIC ADVERTISEMENT & BANNERS SCHEMA UPGRADE
-- ============================================================================
-- Upgrades public.banners table to support multi-placement advertisement
-- management, page targeting, scheduling, priority, and custom badges.
-- ============================================================================

-- 1. Add new columns to public.banners table non-destructively
ALTER TABLE public.banners 
    ADD COLUMN IF NOT EXISTS badge_text TEXT,
    ADD COLUMN IF NOT EXISTS mobile_image_url TEXT,
    ADD COLUMN IF NOT EXISTS cta_text TEXT,
    ADD COLUMN IF NOT EXISTS cta_link TEXT,
    ADD COLUMN IF NOT EXISTS ad_type TEXT DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS placement TEXT DEFAULT 'top_announcement',
    ADD COLUMN IF NOT EXISTS target_pages TEXT[] DEFAULT ARRAY['all']::TEXT[],
    ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- 2. Backfill existing columns if empty
UPDATE public.banners 

SET cta_text = button_text 
WHERE cta_text IS NULL AND button_text IS NOT NULL;

UPDATE public.banners 
SET cta_link = button_link 
WHERE cta_link IS NULL AND button_link IS NOT NULL;

UPDATE public.banners 
SET sort_order = display_order 
WHERE sort_order IS NULL AND display_order IS NOT NULL;

UPDATE public.banners 
SET placement = 'top_announcement' 
WHERE placement IS NULL;

UPDATE public.banners 
SET target_pages = ARRAY['all']::TEXT[] 
WHERE target_pages IS NULL OR array_length(target_pages, 1) IS NULL;

-- 3. Indexes for rapid storefront query execution
CREATE INDEX IF NOT EXISTS idx_banners_placement ON public.banners(placement);
CREATE INDEX IF NOT EXISTS idx_banners_active ON public.banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_sort_priority ON public.banners(sort_order ASC, priority DESC);
CREATE INDEX IF NOT EXISTS idx_banners_schedule ON public.banners(start_at, end_at);

-- 4. Ensure Row Level Security (RLS) policies are up to date
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Allow public / customers to view active banners currently in schedule
DROP POLICY IF EXISTS "Public can view active banners" ON public.banners;
CREATE POLICY "Public can view active banners" 
    ON public.banners FOR SELECT 
    USING (
        is_active = true 
        AND (start_at IS NULL OR start_at <= NOW()) 
        AND (end_at IS NULL OR end_at >= NOW())
        OR public.is_admin()
    );

-- Allow admins full CRUD operations on banners
DROP POLICY IF EXISTS "Admins have full CRUD on banners" ON public.banners;
CREATE POLICY "Admins have full CRUD on banners" 
    ON public.banners FOR ALL 
    USING (public.is_admin());

-- 5. Seed initial dynamic advertisement campaigns if table is currently empty
INSERT INTO public.banners (
    title,
    subtitle,
    badge_text,
    image_url,
    cta_text,
    cta_link,
    ad_type,
    placement,
    target_pages,
    priority,
    sort_order,
    is_active
) 
SELECT 
    'Buy 1 Get 1 Free on Curated Designer Favorites',
    'Add any qualifying item to your bag and claim a matching gift instantly.',
    '🔥 BOGO SALE',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
    'Shop BOGO',
    'bogo.html',
    'bogo',
    'top_announcement',
    ARRAY['all']::TEXT[],
    5,
    1,
    true
WHERE NOT EXISTS (SELECT 1 FROM public.banners WHERE placement = 'top_announcement' LIMIT 1);

INSERT INTO public.banners (
    title,
    subtitle,
    badge_text,
    image_url,
    cta_text,
    cta_link,
    ad_type,
    placement,
    target_pages,
    priority,
    sort_order,
    is_active
) 
SELECT 
    'Discover What''s Trending This Week',
    'Explore customer-favorite footwear, luxury horology, and modern lifestyle pieces.',
    '⚡ TRENDING NOW',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
    'Explore Trending',
    'trending.html',
    'trending',
    'top_announcement',
    ARRAY['all']::TEXT[],
    4,
    2,
    true
WHERE NOT EXISTS (SELECT 1 FROM public.banners WHERE title LIKE '%Trending%' AND placement = 'top_announcement' LIMIT 1);

INSERT INTO public.banners (
    title,
    subtitle,
    badge_text,
    image_url,
    cta_text,
    cta_link,
    ad_type,
    placement,
    target_pages,
    priority,
    sort_order,
    is_active
) 
SELECT 
    'Double Your Style — Buy 1, Get 1 Free',
    'Unlock a complimentary luxury accessory or footwear piece with qualifying purchases.',
    '🎁 EXCLUSIVE BOGO CAMPAIGN',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
    'Shop BOGO Collection',
    'bogo.html',
    'bogo',
    'below_hero',
    ARRAY['homepage', 'shop']::TEXT[],
    5,
    1,
    true
WHERE NOT EXISTS (SELECT 1 FROM public.banners WHERE placement = 'below_hero' LIMIT 1);

