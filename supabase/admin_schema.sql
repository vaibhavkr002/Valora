-- ============================================================================
-- VELORA ADMIN PANEL - DATABASE EXTENSIONS & MIGRATIONS
-- ============================================================================
-- Adds tables for coupons, reviews, banners, delivery_partners, and store_settings.
-- Full Row Level Security (RLS) policies configured for admin CRUD and customer read.
-- Promotes admin accounts for dashboard access.
-- ============================================================================

-- 1. COUPONS TABLE
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (min_order_amount >= 0),
    max_discount NUMERIC(12, 2) CHECK (max_discount > 0),
    usage_limit INTEGER DEFAULT 100 CHECK (usage_limit >= 0),
    used_count INTEGER DEFAULT 0 CHECK (used_count >= 0),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BANNERS TABLE
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT NOT NULL,
    button_text TEXT DEFAULT 'Shop Now',
    button_link TEXT DEFAULT 'shop.html',
    display_order INTEGER DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. DELIVERY PARTNERS TABLE
CREATE TABLE IF NOT EXISTS public.delivery_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT NOT NULL,
    tagline TEXT,
    badge_text TEXT,
    tracking_url_template TEXT,
    display_order INTEGER DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. STORE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.store_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_banners_active ON public.banners(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_active ON public.delivery_partners(is_active);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Coupons
DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
CREATE POLICY "Public can view active coupons" ON public.coupons FOR SELECT USING (is_active = true OR public.is_admin());
DROP POLICY IF EXISTS "Admins have full CRUD on coupons" ON public.coupons;
CREATE POLICY "Admins have full CRUD on coupons" ON public.coupons FOR ALL USING (public.is_admin());

-- RLS Policies for Reviews
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.reviews;
CREATE POLICY "Public can view approved reviews" ON public.reviews FOR SELECT USING (status = 'approved' OR public.is_admin());
DROP POLICY IF EXISTS "Customers can insert reviews" ON public.reviews;
CREATE POLICY "Customers can insert reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins have full CRUD on reviews" ON public.reviews;
CREATE POLICY "Admins have full CRUD on reviews" ON public.reviews FOR ALL USING (public.is_admin());

-- RLS Policies for Banners
DROP POLICY IF EXISTS "Public can view active banners" ON public.banners;
CREATE POLICY "Public can view active banners" ON public.banners FOR SELECT USING (is_active = true OR public.is_admin());
DROP POLICY IF EXISTS "Admins have full CRUD on banners" ON public.banners;
CREATE POLICY "Admins have full CRUD on banners" ON public.banners FOR ALL USING (public.is_admin());

-- RLS Policies for Delivery Partners
DROP POLICY IF EXISTS "Public can view active partners" ON public.delivery_partners;
CREATE POLICY "Public can view active partners" ON public.delivery_partners FOR SELECT USING (is_active = true OR public.is_admin());
DROP POLICY IF EXISTS "Admins have full CRUD on partners" ON public.delivery_partners;
CREATE POLICY "Admins have full CRUD on partners" ON public.delivery_partners FOR ALL USING (public.is_admin());

-- RLS Policies for Store Settings
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings" ON public.store_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
CREATE POLICY "Admins can update store settings" ON public.store_settings FOR ALL USING (public.is_admin());

-- Ensure alex@velora.com and admin@velora.com have admin role
UPDATE public.profiles SET role = 'admin' WHERE email IN ('alex@velora.com', 'admin@velora.com');

-- Seed initial coupons
INSERT INTO public.coupons (code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, is_active)
VALUES
    ('VELORA10', 'percentage', 10.00, 999.00, 1000.00, 500, true),
    ('VELORA15', 'percentage', 15.00, 1999.00, 1500.00, 250, true),
    ('FESTIVE500', 'fixed', 500.00, 2999.00, 500.00, 100, true)
ON CONFLICT (code) DO NOTHING;

-- Seed initial delivery partners
INSERT INTO public.delivery_partners (name, slug, logo_url, tagline, badge_text, tracking_url_template, display_order, is_active)
VALUES
    ('Ekart', 'ekart', 'images/partners/ekart.svg', 'Fast Surface & Hubs', 'Pan-India', 'https://ekartlogistics.com/shipmenttrack/{TRACK_ID}', 1, true),
    ('Delhivery', 'delhivery', 'images/partners/delhivery.svg', 'Express Air & Surface', 'Live Tracking', 'https://www.delhivery.com/track/package/{TRACK_ID}', 2, true),
    ('Meesho Logistics', 'meesho', 'images/partners/meesho.svg', 'Reliable Value Reach', 'Direct Hubs', 'https://www.meesho.com/track/{TRACK_ID}', 3, true),
    ('DHL', 'dhl', 'images/partners/dhl.svg', 'Global & Metro Priority', 'Next-Day Air', 'https://www.dhl.com/en/express/tracking.html?AWB={TRACK_ID}', 4, true),
    ('Blue Dart', 'bluedart', 'images/partners/bluedart.svg', 'Dedicated Aviation Fleet', 'Guaranteed ETA', 'https://www.bluedart.com/tracking?numbers={TRACK_ID}', 5, true),
    ('Amazon Logistics', 'amazon', 'images/partners/amazon.svg', 'Smart Route Delivery', 'Doorstep OTP', 'https://track.amazon.in/tracking/{TRACK_ID}', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed default store settings
INSERT INTO public.store_settings (key, value, description)
VALUES
    ('general', '{"store_name": "VELORA Lifestyle Studio", "support_email": "support@velorastudio.com", "support_phone": "+91 1800 102 8356", "studio_address": "12 Connaught Place, New Delhi 110001, India"}'::jsonb, 'General Storefront Profile'),
    ('shipping', '{"currency": "INR", "free_shipping_threshold": 999, "standard_shipping_fee": 99, "express_shipping_fee": 199, "return_period_days": 30}'::jsonb, 'Shipping and Delivery Configuration'),
    ('social', '{"instagram": "https://instagram.com/velorastudio", "twitter": "https://twitter.com/velorastudio", "facebook": "https://facebook.com/velorastudio"}'::jsonb, 'Social Media Channels')
ON CONFLICT (key) DO NOTHING;
