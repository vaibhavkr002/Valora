-- ============================================================================
-- MIGRATION: 20260920_create_sarojini_store.sql
-- DESCRIPTION:
-- Complete database architecture for isolated VADI Sarojini Bazaar store:
-- 1. sarojini_categories (hierarchical departments & subcategories)
-- 2. sarojini_products (isolated product catalog with variant & pricing JSONB)
-- 3. sarojini_offers (promotions, deals under ₹199, ₹299, ₹499, 50% off)
-- 4. Shared table columns: order_items, wishlist, reviews catalog_type discriminators
-- 5. Row Level Security (RLS): Public read active, Admin full CRUD
-- 6. Starter seed categories for all 7 departments
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SAROJINI CATEGORIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sarojini_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department TEXT NOT NULL CHECK (department IN ('MEN', 'WOMEN', 'ACCESSORIES', 'FOOTWEAR', 'BAGS', 'JEWELLERY', 'CAPS', 'OTHER')),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    parent_id UUID REFERENCES public.sarojini_categories(id) ON DELETE CASCADE,
    description TEXT,
    image_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_sarojini_cat UNIQUE (department, slug)
);

COMMENT ON TABLE public.sarojini_categories IS 'Independent category & subcategory taxonomy for VADI Sarojini Bazaar';

-- ----------------------------------------------------------------------------
-- 2. SAROJINI PRODUCTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sarojini_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.sarojini_categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES public.sarojini_categories(id) ON DELETE SET NULL,
    department TEXT NOT NULL CHECK (department IN ('MEN', 'WOMEN', 'ACCESSORIES', 'FOOTWEAR', 'BAGS', 'JEWELLERY', 'CAPS', 'OTHER')),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    brand TEXT DEFAULT 'Sarojini Bazaar',
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    original_price NUMERIC(12, 2) CHECK (original_price >= price),
    discount_percentage INTEGER DEFAULT 0,
    rating NUMERIC(3, 2) DEFAULT 4.5,
    review_count INTEGER DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sizes JSONB DEFAULT '[]'::jsonb,
    colors JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    specifications JSONB DEFAULT '{}'::jsonb,
    shipping_info JSONB DEFAULT '{}'::jsonb,
    return_policy TEXT DEFAULT '7-Day Easy Returns',
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_new BOOLEAN NOT NULL DEFAULT true,
    is_deal BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    advance_payment_enabled BOOLEAN NOT NULL DEFAULT false,
    advance_payment_type TEXT DEFAULT 'fixed',
    advance_payment_value NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.sarojini_products IS 'Dedicated product catalog for VADI Sarojini Bazaar. Completely isolated from main products table.';

-- ----------------------------------------------------------------------------
-- 3. SAROJINI OFFERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sarojini_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    badge TEXT,
    discount_text TEXT,
    filter_query JSONB DEFAULT '{}'::jsonb,
    banner_image TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER DEFAULT 0,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.sarojini_offers IS 'Promotional offers & budget brackets specific to Sarojini Bazaar';

-- ----------------------------------------------------------------------------
-- 4. SUPPORTING COLUMNS ON SHARED TABLES
-- ----------------------------------------------------------------------------
-- Order Items: store catalog_type and sarojini_product_id
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS catalog_type TEXT NOT NULL DEFAULT 'main';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS sarojini_product_id UUID REFERENCES public.sarojini_products(id) ON DELETE SET NULL;

-- Wishlist: store catalog_type and sarojini_product_id
ALTER TABLE public.wishlist ADD COLUMN IF NOT EXISTS catalog_type TEXT NOT NULL DEFAULT 'main';
ALTER TABLE public.wishlist ADD COLUMN IF NOT EXISTS sarojini_product_id UUID REFERENCES public.sarojini_products(id) ON DELETE CASCADE;

-- Reviews: store catalog_type and sarojini_product_id
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS catalog_type TEXT NOT NULL DEFAULT 'main';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS sarojini_product_id UUID REFERENCES public.sarojini_products(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sarojini_products_dept_active ON public.sarojini_products (department, is_active);
CREATE INDEX IF NOT EXISTS idx_sarojini_products_cat_active ON public.sarojini_products (category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sarojini_products_featured ON public.sarojini_products (is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_sarojini_products_price ON public.sarojini_products (price);
CREATE INDEX IF NOT EXISTS idx_sarojini_categories_dept_order ON public.sarojini_categories (department, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_sarojini_categories_parent ON public.sarojini_categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_order_items_catalog ON public.order_items (catalog_type, sarojini_product_id);

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.sarojini_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarojini_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sarojini_offers ENABLE ROW LEVEL SECURITY;

-- Categories RLS
DROP POLICY IF EXISTS "Public can view active sarojini categories" ON public.sarojini_categories;
CREATE POLICY "Public can view active sarojini categories"
    ON public.sarojini_categories FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins have full CRUD on sarojini categories" ON public.sarojini_categories;
CREATE POLICY "Admins have full CRUD on sarojini categories"
    ON public.sarojini_categories FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Products RLS
DROP POLICY IF EXISTS "Public can view active sarojini products" ON public.sarojini_products;
CREATE POLICY "Public can view active sarojini products"
    ON public.sarojini_products FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins have full CRUD on sarojini products" ON public.sarojini_products;
CREATE POLICY "Admins have full CRUD on sarojini products"
    ON public.sarojini_products FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Offers RLS
DROP POLICY IF EXISTS "Public can view active sarojini offers" ON public.sarojini_offers;
CREATE POLICY "Public can view active sarojini offers"
    ON public.sarojini_offers FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins have full CRUD on sarojini offers" ON public.sarojini_offers;
CREATE POLICY "Admins have full CRUD on sarojini offers"
    ON public.sarojini_offers FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. INITIAL SEED DATA FOR SAROJINI CATEGORIES
-- ----------------------------------------------------------------------------
INSERT INTO public.sarojini_categories (department, name, slug, display_order)
VALUES
    -- MEN
    ('MEN', 'T-Shirts', 'men-t-shirts', 1),
    ('MEN', 'Shirts', 'men-shirts', 2),
    ('MEN', 'Polos', 'men-polos', 3),
    ('MEN', 'Oversized T-Shirts', 'men-oversized-t-shirts', 4),
    ('MEN', 'Hoodies', 'men-hoodies', 5),
    ('MEN', 'Sweatshirts', 'men-sweatshirts', 6),
    ('MEN', 'Jeans', 'men-jeans', 7),
    ('MEN', 'Trousers', 'men-trousers', 8),
    ('MEN', 'Cargo Pants', 'men-cargo-pants', 9),
    ('MEN', 'Shorts', 'men-shorts', 10),
    ('MEN', 'Jackets', 'men-jackets', 11),
    ('MEN', 'Co-ord Sets', 'men-co-ord-sets', 12),
    ('MEN', 'Tracksuits', 'men-tracksuits', 13),
    ('MEN', 'Ethnic Wear', 'men-ethnic-wear', 14),

    -- WOMEN
    ('WOMEN', 'Tops', 'women-tops', 1),
    ('WOMEN', 'T-Shirts', 'women-t-shirts', 2),
    ('WOMEN', 'Shirts', 'women-shirts', 3),
    ('WOMEN', 'Crop Tops', 'women-crop-tops', 4),
    ('WOMEN', 'Dresses', 'women-dresses', 5),
    ('WOMEN', 'Mini Dresses', 'women-mini-dresses', 6),
    ('WOMEN', 'Midi Dresses', 'women-midi-dresses', 7),
    ('WOMEN', 'Co-ord Sets', 'women-co-ord-sets', 8),
    ('WOMEN', 'Jeans', 'women-jeans', 9),
    ('WOMEN', 'Trousers', 'women-trousers', 10),
    ('WOMEN', 'Cargo Pants', 'women-cargo-pants', 11),
    ('WOMEN', 'Skirts', 'women-skirts', 12),
    ('WOMEN', 'Shorts', 'women-shorts', 13),
    ('WOMEN', 'Jackets', 'women-jackets', 14),
    ('WOMEN', 'Hoodies', 'women-hoodies', 15),
    ('WOMEN', 'Sweatshirts', 'women-sweatshirts', 16),
    ('WOMEN', 'Kurtis', 'women-kurtis', 17),
    ('WOMEN', 'Sarees', 'women-sarees', 18),
    ('WOMEN', 'Fashion Sets', 'women-fashion-sets', 19),
    ('WOMEN', 'Loungewear', 'women-loungewear', 20),

    -- ACCESSORIES
    ('ACCESSORIES', 'Earrings', 'accessories-earrings', 1),
    ('ACCESSORIES', 'Necklaces', 'accessories-necklaces', 2),
    ('ACCESSORIES', 'Bracelets', 'accessories-bracelets', 3),
    ('ACCESSORIES', 'Rings', 'accessories-rings', 4),
    ('ACCESSORIES', 'Hair Accessories', 'accessories-hair', 5),
    ('ACCESSORIES', 'Sunglasses', 'accessories-sunglasses', 6),
    ('ACCESSORIES', 'Belts', 'accessories-belts', 7),
    ('ACCESSORIES', 'Wallets', 'accessories-wallets', 8),
    ('ACCESSORIES', 'Watches', 'accessories-watches', 9),
    ('ACCESSORIES', 'Socks', 'accessories-socks', 10),
    ('ACCESSORIES', 'Scarves', 'accessories-scarves', 11),

    -- BAGS
    ('BAGS', 'Shoulder Bags', 'bags-shoulder', 1),
    ('BAGS', 'Tote Bags', 'bags-tote', 2),
    ('BAGS', 'Sling Bags', 'bags-sling', 3),
    ('BAGS', 'Handbags', 'bags-handbags', 4),
    ('BAGS', 'Backpacks', 'bags-backpacks', 5),
    ('BAGS', 'Mini Bags', 'bags-mini', 6),

    -- FOOTWEAR
    ('FOOTWEAR', 'Sneakers', 'footwear-sneakers', 1),
    ('FOOTWEAR', 'Casual Shoes', 'footwear-casual', 2),
    ('FOOTWEAR', 'Sandals', 'footwear-sandals', 3),
    ('FOOTWEAR', 'Slippers', 'footwear-slippers', 4),
    ('FOOTWEAR', 'Heels', 'footwear-heels', 5),
    ('FOOTWEAR', 'Flats', 'footwear-flats', 6),
    ('FOOTWEAR', 'Boots', 'footwear-boots', 7),

    -- CAPS
    ('CAPS', 'Baseball Caps', 'caps-baseball', 1),
    ('CAPS', 'Snapbacks', 'caps-snapbacks', 2),
    ('CAPS', 'Bucket Hats', 'caps-bucket', 3),
    ('CAPS', 'Beanies', 'caps-beanies', 4),

    -- JEWELLERY
    ('JEWELLERY', 'Silver Oxidised Sets', 'jewellery-silver-oxidised', 1),
    ('JEWELLERY', 'Chokers & Neckpieces', 'jewellery-chokers', 2),
    ('JEWELLERY', 'Traditional Jhumkas', 'jewellery-jhumkas', 3),
    ('JEWELLERY', 'Korean Minimalist Studs', 'jewellery-korean-studs', 4),
    ('JEWELLERY', 'Boho Bangles & Kadas', 'jewellery-boho-bangles', 5)

ON CONFLICT (department, slug) DO NOTHING;

-- Initial Seed Sample Deals in Sarojini Offers
INSERT INTO public.sarojini_offers (title, subtitle, badge, discount_text, filter_query, display_order)
VALUES
    ('Sarojini Steals Under ₹199', 'Everyday staples & trendy accessories', 'STEAL DEAL', 'Under ₹199', '{"max_price": 199}'::jsonb, 1),
    ('Bazaar Tops & Tees Under ₹299', 'Graphic tees, crop tops & casual wear', 'HOT SELLER', 'Under ₹299', '{"max_price": 299}'::jsonb, 2),
    ('Denims & Jackets Under ₹499', 'Wide leg cargo, relaxed jeans & outerwear', 'BAZAAR SPECIAL', 'Under ₹499', '{"max_price": 499}'::jsonb, 3)
ON CONFLICT DO NOTHING;

