-- ============================================================================
-- MIGRATION: 20260918_create_homepage_sections.sql
-- DESCRIPTION:
-- 1. Create public.homepage_sections table for dynamic storefront sections.
-- 2. Performance indexes on display_order, is_active, and schedule.
-- 3. Row Level Security (RLS): Public read on active scheduled sections, Admin full CRUD.
-- 4. Initial seed data corresponding to current VADI homepage sections.
-- ============================================================================

-- 1. Create public.homepage_sections table
CREATE TABLE IF NOT EXISTS public.homepage_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_type TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 1,
    background_config JSONB DEFAULT '{}'::jsonb,
    content_config JSONB DEFAULT '{}'::jsonb,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_homepage_sections_active_order 
    ON public.homepage_sections (is_active, display_order ASC);

CREATE INDEX IF NOT EXISTS idx_homepage_sections_schedule 
    ON public.homepage_sections (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_homepage_sections_type 
    ON public.homepage_sections (section_type);

-- 3. Row Level Security (RLS)
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

-- Allow public and customers to view active sections currently in schedule
DROP POLICY IF EXISTS "Public can view active homepage sections" ON public.homepage_sections;
CREATE POLICY "Public can view active homepage sections"
    ON public.homepage_sections FOR SELECT
    USING (
        (is_active = true 
        AND (start_date IS NULL OR start_date <= NOW()) 
        AND (end_date IS NULL OR end_date >= NOW()))
        OR (public.is_admin())
    );

-- Allow authenticated admins full CRUD operations
DROP POLICY IF EXISTS "Admins have full CRUD on homepage sections" ON public.homepage_sections;
CREATE POLICY "Admins have full CRUD on homepage sections"
    ON public.homepage_sections FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. Seed current default sections (Non-destructive insert)
INSERT INTO public.homepage_sections 
    (id, section_type, title, subtitle, is_active, display_order, background_config, content_config)
VALUES
    ('11111111-1111-4111-a111-000000000001', 'hero', 'Hero Showcase', 'Everything. Simply Yours.', true, 1, 
     '{"theme": "dark", "padding": "standard"}'::jsonb, 
     '{"headline": "Everything. <br><span class=\"gradient-text\">Simply Yours.</span>", "subtitle": "Discover curated luxury across shoes, watches, caps, clothing, bags, and modern accessories designed to elevate your everyday presence with effortless sophistication.", "cta_text": "Shop Now", "cta_link": "shop.html", "secondary_cta_text": "Explore Collection", "secondary_cta_link": "shop.html"}'::jsonb),

    ('11111111-1111-4111-a111-000000000002', 'advertisement', 'Promotional Banner Below Hero', 'Dynamic Advertisement Slot', true, 2, 
     '{}'::jsonb, 
     '{"placement": "below_hero"}'::jsonb),

    ('11111111-1111-4111-a111-000000000003', 'categories', 'Shop By Category', 'Curated Collections', true, 3, 
     '{"theme": "dark", "padding": "standard"}'::jsonb, 
     '{"view_all_link": "shop.html", "view_all_text": "Browse All"}'::jsonb),

    ('11111111-1111-4111-a111-000000000004', 'brands', 'Shop by Brands', 'Curated Labels', true, 4, 
     '{"theme": "dark", "padding": "compact"}'::jsonb, 
     '{"autoplay": true}'::jsonb),

    ('11111111-1111-4111-a111-000000000005', 'advertisement', 'Ad Slot Above Trending', 'Dynamic Advertisement Slot', true, 5, 
     '{}'::jsonb, 
     '{"placement": "above_trending"}'::jsonb),

    ('11111111-1111-4111-a111-000000000006', 'trending', 'Trending Now & Customer Favorites', 'Discover the standout styles captivating nationwide attention this week with uncompromised quality.', true, 6, 
     '{"theme": "dark", "padding": "standard"}'::jsonb, 
     '{"badge": "⚡ VADI CURATED RADAR", "limit": 8, "columns": 4}'::jsonb),

    ('11111111-1111-4111-a111-000000000007', 'advertisement', 'Ad Slot Below Trending', 'Dynamic Advertisement Slot', true, 7, 
     '{}'::jsonb, 
     '{"placement": "below_trending"}'::jsonb),

    ('11111111-1111-4111-a111-000000000008', 'advertisement', 'Ad Slot Above New Arrivals', 'Dynamic Advertisement Slot', true, 8, 
     '{}'::jsonb, 
     '{"placement": "above_new_arrivals"}'::jsonb),

    ('11111111-1111-4111-a111-000000000009', 'new_arrivals', 'New Arrivals', 'Fresh silhouettes and elevated essentials just added to the catalog.', true, 9, 
     '{"theme": "dark", "padding": "standard"}'::jsonb, 
     '{"limit": 8, "columns": 4}'::jsonb),

    ('11111111-1111-4111-a111-000000000010', 'advertisement', 'Ad Slot Above Deals', 'Dynamic Advertisement Slot', true, 10, 
     '{}'::jsonb, 
     '{"placement": "above_deals"}'::jsonb),

    ('11111111-1111-4111-a111-000000000011', 'deals', 'Today''s Flash Deals', 'Limited-quantity private tier discounts updating in real time.', true, 11, 
     '{"theme": "dark", "padding": "standard"}'::jsonb, 
     '{"show_timer": true, "limit": 8, "columns": 4}'::jsonb),

    ('11111111-1111-4111-a111-000000000012', 'bogo', 'Buy 1 Get 1 Free (BOGO)', 'Curated promotional pairing festival: select any primary item and claim your complimentary gift.', true, 12, 
     '{"theme": "dark", "padding": "standard"}'::jsonb, 
     '{"limit": 6}'::jsonb),

    ('11111111-1111-4111-a111-000000000013', 'advertisement', 'Ad Slot Below BOGO', 'Dynamic Advertisement Slot', true, 13, 
     '{}'::jsonb, 
     '{"placement": "below_bogo"}'::jsonb),

    ('11111111-1111-4111-a111-000000000014', 'customer_stories', 'REAL CUSTOMERS. REAL LOVE.', 'From a simple DM to a VADI experience — every order has a story.', true, 14, 
     '{"theme": "dark", "padding": "standard"}'::jsonb, 
     '{}'::jsonb),

    ('11111111-1111-4111-a111-000000000015', 'features', 'Why Shop With Us?', 'The VADI Standard: We combine curated aesthetics with world-class logistics and uncompromising customer satisfaction.', true, 15, 
     '{"theme": "dark", "padding": "standard"}'::jsonb, 
     '{}'::jsonb),

    ('11111111-1111-4111-a111-000000000016', 'delivery_partners', 'Express Shipping Network', 'Fast, insured doorstep transit across 28,000+ Indian pincodes.', true, 16, 
     '{"theme": "dark", "padding": "compact"}'::jsonb, 
     '{}'::jsonb),

    ('11111111-1111-4111-a111-000000000017', 'newsletter', 'Unlock 15% Off Your Next Order', 'Join The Collective and receive exclusive drops and private codes.', true, 17, 
     '{"theme": "dark", "padding": "compact"}'::jsonb, 
     '{}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    section_type = EXCLUDED.section_type,
    display_order = EXCLUDED.display_order,
    updated_at = now();

