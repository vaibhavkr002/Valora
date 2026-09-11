-- ============================================================================
-- VELORA E-COMMERCE PLATFORM - COMPLETE ALL-IN-ONE SUPABASE MIGRATION
-- ============================================================================
-- Copy and paste this entire script into your Supabase Dashboard -> SQL Editor
-- and click "RUN". It will set up the entire VELORA database in one click.
-- ============================================================================

-- ============================================================================
-- VELORA E-COMMERCE PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- ============================================================================
-- Complete schema definition for VELORA e-commerce platform.
-- Designed for Supabase with auth.users integration, Row Level Security,
-- INR numeric fields, proper indexing, constraints, and audit triggers.
-- ============================================================================

-- Enable pgcrypto for UUID generation if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Linked to auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles synchronized with Supabase auth.users';
COMMENT ON COLUMN public.profiles.role IS 'Role of the user: customer or admin';

-- ============================================================================
-- 2. CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.categories IS 'Product taxonomy and category catalog';

-- ============================================================================
-- 3. PRODUCTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    brand TEXT,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    original_price NUMERIC(12, 2) CHECK (original_price >= 0),
    discount_percentage INTEGER DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    rating NUMERIC(3, 2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
    colors JSONB NOT NULL DEFAULT '[]'::jsonb,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_url TEXT,
    source_name TEXT,
    advance_payment_enabled BOOLEAN NOT NULL DEFAULT false,
    advance_payment_type TEXT NOT NULL DEFAULT 'fixed' CHECK (advance_payment_type IN ('fixed', 'percentage')),
    advance_payment_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (advance_payment_value >= 0),
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_new BOOLEAN NOT NULL DEFAULT false,
    is_deal BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.products IS 'Full product catalog with INR numeric pricing and variant JSONB';
COMMENT ON COLUMN public.products.price IS 'Current retail selling price in Indian Rupees (numeric, no symbol)';
COMMENT ON COLUMN public.products.original_price IS 'Original MRP price before discount in INR';
COMMENT ON COLUMN public.products.sizes IS 'JSONB array of available sizes (e.g. ["UK 7", "UK 8", "UK 9"])';
COMMENT ON COLUMN public.products.colors IS 'JSONB array of available colors (e.g. ["Obsidian Black", "Pure White"])';
COMMENT ON COLUMN public.products.images IS 'JSONB array of image URLs';
COMMENT ON COLUMN public.products.source_url IS 'Permitted import source URL for authorized product feed ingestion';

-- ============================================================================
-- 4. ADDRESSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    house TEXT NOT NULL,
    street TEXT NOT NULL,
    landmark TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'India',
    pincode TEXT NOT NULL,
    address_type TEXT NOT NULL DEFAULT 'Home' CHECK (address_type IN ('Home', 'Work', 'Other')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.addresses IS 'Saved customer shipping and delivery addresses';

-- ============================================================================
-- 5. WISHLIST TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_wishlist_product UNIQUE (user_id, product_id)
);

COMMENT ON TABLE public.wishlist IS 'User saved products for later purchase';

-- ============================================================================
-- 6. ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL UNIQUE,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    shipping_charge NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (shipping_charge >= 0),
    tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    order_status TEXT NOT NULL DEFAULT 'placed' CHECK (order_status IN ('placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    advance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (advance_amount >= 0),
    advance_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (advance_paid >= 0),
    cod_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cod_balance >= 0),
    advance_payment_status TEXT NOT NULL DEFAULT 'not_required' CHECK (advance_payment_status IN ('not_required', 'pending', 'paid', 'failed', 'refunded')),
    cod_payment_status TEXT NOT NULL DEFAULT 'not_applicable' CHECK (cod_payment_status IN ('not_applicable', 'pending', 'collected')),
    delivery_full_name TEXT NOT NULL,
    delivery_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_city TEXT NOT NULL,
    delivery_state TEXT NOT NULL,
    delivery_country TEXT NOT NULL DEFAULT 'India',
    delivery_pincode TEXT NOT NULL,
    estimated_delivery TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.orders IS 'Master order records with frozen delivery address and payment metadata';

-- ============================================================================
-- 7. ORDER_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_image TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    selected_size TEXT,
    selected_color TEXT,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    advance_payment_enabled BOOLEAN NOT NULL DEFAULT false,
    advance_payment_type TEXT DEFAULT 'fixed',
    advance_payment_value NUMERIC(12, 2) DEFAULT 0.00,
    advance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (advance_amount >= 0),
    cod_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cod_balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.order_items IS 'Line items per order preserving historical price and product snapshot';

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name_brand ON public.products(name, brand);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_deals ON public.products(is_deal) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);

-- ============================================================================
-- 9. AUTOMATED TRIGGERS & FUNCTIONS
-- ============================================================================

-- Generic updated_at timestamp refresher
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger updated_at on profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger updated_at on categories
DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger updated_at on products
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger updated_at on addresses
DROP TRIGGER IF EXISTS trg_addresses_updated_at ON public.addresses;
CREATE TRIGGER trg_addresses_updated_at
    BEFORE UPDATE ON public.addresses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger updated_at on orders
DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Connect handle_new_user trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function for RLS: check if current authenticated user is an admin
-- SECURITY DEFINER bypasses RLS on profiles to avoid recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
    RETURN (user_role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ============================================================================
-- VELORA E-COMMERCE PLATFORM - ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enables RLS on all 7 tables and sets up strict, battle-tested access policies:
-- 1. Public can read active categories and active products.
-- 2. Customers can read/update their own profile, addresses, wishlist, and orders.
-- 3. Customers CANNOT modify products, categories, or other users' private data.
-- 4. Admins (profiles.role = 'admin') have full management access.
-- ============================================================================

-- Enable RLS on all public tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND (role = 'customer' OR public.is_admin()));

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- ============================================================================
-- CATEGORIES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
CREATE POLICY "Anyone can view active categories"
    ON public.categories FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
CREATE POLICY "Admins can insert categories"
    ON public.categories FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can update categories"
    ON public.categories FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
CREATE POLICY "Admins can delete categories"
    ON public.categories FOR DELETE
    USING (public.is_admin());

-- ============================================================================
-- PRODUCTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products"
    ON public.products FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products"
    ON public.products FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
    ON public.products FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products"
    ON public.products FOR DELETE
    USING (public.is_admin());

-- ============================================================================
-- ADDRESSES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own addresses" ON public.addresses;
CREATE POLICY "Users can view own addresses"
    ON public.addresses FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
CREATE POLICY "Users can insert own addresses"
    ON public.addresses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
CREATE POLICY "Users can update own addresses"
    ON public.addresses FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;
CREATE POLICY "Users can delete own addresses"
    ON public.addresses FOR DELETE
    USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- WISHLIST POLICIES
-- ============================================================================
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

-- ============================================================================
-- ORDERS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
CREATE POLICY "Users can insert own orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL));

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
    ON public.orders FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
    ON public.orders FOR DELETE
    USING (public.is_admin());

-- ============================================================================
-- ORDER_ITEMS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE public.orders.id = public.order_items.order_id
            AND (public.orders.user_id = auth.uid() OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "Users can insert own order items" ON public.order_items;
CREATE POLICY "Users can insert own order items"
    ON public.order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE public.orders.id = public.order_items.order_id
            AND (public.orders.user_id = auth.uid() OR public.orders.user_id IS NULL)
        )
    );


-- ============================================================================
-- VELORA E-COMMERCE PLATFORM - DEMO SEED DATA (IN INDIAN RUPEES)
-- ============================================================================
-- Realistic seed catalog for testing storefront and admin panel.
-- All prices are stored as raw NUMERIC values in Indian Rupees (INR).
-- Clearly treated as demo seed data.
-- ============================================================================

-- 1. SEED CATEGORIES (8 core categories)
INSERT INTO public.categories (id, name, slug, description, image_url, is_active)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Shoes & Footwear', 'shoes', 'Sneakers, Boots & Loafers handcrafted for everyday luxury.', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000002', 'Luxury Watches', 'watches', 'Timepieces & Chronographs precision engineered with sapphire glass.', 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000003', 'Designer Caps', 'caps', 'Snapbacks, Beanies & Hats in premium organic cotton twill.', 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000004', 'Bags & Backpacks', 'bags', 'Duffels, Totes & Crossbody bags tailored with Tuscan leather.', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000005', 'Modern Clothing', 'clothing', 'Jackets, Hoodies & Knits spun from extrafine wool and terry.', 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000006', 'Minimal Accessories', 'accessories', 'Eyewear, Belts & Wallets crafted with RFID protection.', 'https://images.unsplash.com/photo-1509319117193-57bab727e09d?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000007', 'Smart Audio & Tech', 'electronics', 'Headphones & Smart Gadgets featuring Hybrid ANC.', 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80', true),
    ('c0000000-0000-0000-0000-000000000008', 'Curated Living', 'seasonal', 'Fragrances & Lifestyle Picks for refined modern spaces.', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    is_active = EXCLUDED.is_active;

-- 2. SEED PRODUCTS (24 realistic catalog items matching frontend)
INSERT INTO public.products (
    id, category_id, name, brand, slug, description,
    price, original_price, discount_percentage, rating, review_count, stock,
    sizes, colors, images, source_url, source_name,
    is_featured, is_new, is_deal, is_active
) VALUES
-- SHOES & FOOTWEAR
(
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'AeroGlide Runner Pro V2',
    'Aero Athletics',
    'aeroglide-runner-pro-v2',
    'Ultra-responsive athletic footwear engineered with aerodynamic cloud foam cushioning, breathable knit mesh, and durable grip traction.',
    3499.00, 4499.00, 22, 4.9, 342, 18,
    '["UK 7", "UK 8", "UK 9", "UK 10", "UK 11"]'::jsonb,
    '["Crimson Red", "Obsidian Black", "Pure White"]'::jsonb,
    '["https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/shoes/aeroglide-v2', 'VELORA Official Catalog',
    true, false, false, true
),
(
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'Veloce Minimalist Leather Sneaker',
    'VELORA Atelier',
    'veloce-minimalist-leather-sneaker',
    'Low-profile luxury sneaker crafted from smooth nappa leather with margom-style vulcanized rubber cupsole and memory-foam arch support.',
    3299.00, 3999.00, 18, 4.9, 165, 27,
    '["UK 7", "UK 8", "UK 9", "UK 10", "UK 11"]'::jsonb,
    '["Pristine White", "Chalk & Gum", "Midnight Monochrome"]'::jsonb,
    '["https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/shoes/veloce-sneaker', 'VELORA Official Catalog',
    true, false, false, true
),
(
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000001',
    'Artisan Tuscan Leather Chelsea Boot',
    'Tuscan Goods',
    'artisan-tuscan-leather-chelsea-boot',
    'Goodyear-welted Chelsea boots crafted from waxed Italian suede with elasticated side gussets and durable Dainite studded rubber soles.',
    4999.00, 6499.00, 23, 4.9, 134, 15,
    '["UK 7", "UK 8", "UK 9", "UK 10", "UK 11"]'::jsonb,
    '["Snuff Suede Brown", "Pitch Black Leather"]'::jsonb,
    '["https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/shoes/chelsea-boot', 'VELORA Official Catalog',
    false, true, false, true
),
(
    'd0000000-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000001',
    'StreetEdge Suede High-Top Trainer',
    'Aero Athletics',
    'streetedge-suede-high-top-trainer',
    'Retro street-inspired high top constructed with contrast hairy suede and tumbled leather accents, padded collar, and gum-rubber traction sole.',
    2499.00, 4999.00, 50, 4.8, 312, 4,
    '["UK 7", "UK 8", "UK 9", "UK 10"]'::jsonb,
    '["Vintage Clay & Sail", "Shadow Gray"]'::jsonb,
    '["https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/shoes/streetedge-trainer', 'VELORA Official Catalog',
    false, false, true, true
),
(
    'd0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000000001',
    'Nordic Oxford Leather Derby',
    'Tuscan Goods',
    'nordic-oxford-leather-derby',
    'Hand-burnished calfskin leather Derby shoe with blind eyelets, tonal welt stitching, and natural leather sole with rubber heel insert.',
    4299.00, 5499.00, 22, 4.7, 88, 12,
    '["UK 7", "UK 8", "UK 9", "UK 10"]'::jsonb,
    '["Deep Cognac", "Onyx Black"]'::jsonb,
    '["https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/shoes/nordic-oxford', 'VELORA Official Catalog',
    false, false, false, true
),

-- LUXURY WATCHES
(
    'd0000000-0000-0000-0000-000000000006',
    'c0000000-0000-0000-0000-000000000002',
    'Chronos Heritage Automatic Watch',
    'Chronos Haute',
    'chronos-heritage-automatic-watch',
    'Exquisite automatic mechanical timepiece featuring sapphire crystal glass, 50m water resistance, and hand-stitched Italian leather strap.',
    9999.00, 14999.00, 33, 4.9, 189, 9,
    '["40mm Case", "42mm Case"]'::jsonb,
    '["Brushed Rose Gold", "Silver Slate", "Stealth Onyx"]'::jsonb,
    '["https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/watches/chronos-heritage', 'VELORA Official Catalog',
    true, false, false, true
),
(
    'd0000000-0000-0000-0000-000000000007',
    'c0000000-0000-0000-0000-000000000002',
    'Aura Matte Black Chronograph',
    'Chronos Haute',
    'aura-matte-black-chronograph',
    'Limited Edition matte black DLC coated stainless steel timepiece with dual sub-dials, tactical luminous hands, and quick-release mesh band.',
    6999.00, 13999.00, 50, 4.9, 245, 6,
    '["42mm Case"]'::jsonb,
    '["All-Black Tactical"]'::jsonb,
    '["https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/watches/aura-chronograph', 'VELORA Official Catalog',
    false, false, true, true
),
(
    'd0000000-0000-0000-0000-000000000008',
    'c0000000-0000-0000-0000-000000000002',
    'Horizon Classic Minimalist Watch',
    'Chronos Haute',
    'horizon-classic-minimalist-watch',
    'Ultra-slim 7mm profile watch with sunray silver dial, polished stainless steel case, and quick-change genuine leather strap.',
    4999.00, 6499.00, 23, 4.8, 120, 18,
    '["38mm Case", "40mm Case"]'::jsonb,
    '["Silver & Tan Leather", "Gold & Black Leather"]'::jsonb,
    '["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/watches/horizon-classic', 'VELORA Official Catalog',
    false, false, false, true
),

-- DESIGNER CAPS & HEADWEAR
(
    'd0000000-0000-0000-0000-000000000009',
    'c0000000-0000-0000-0000-000000000003',
    'Apex Raw Cotton Minimalist Cap',
    'Apex Studio',
    'apex-raw-cotton-minimalist-cap',
    'Structured 6-panel silhouette crafted from heavyweight 100% organic cotton twill with an adjustable antique brass clasp.',
    999.00, 1299.00, 23, 4.8, 215, 45,
    '["Adjustable One Size"]'::jsonb,
    '["Desert Khaki", "Midnight Navy", "Washed Olive"]'::jsonb,
    '["https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/caps/apex-cotton', 'VELORA Official Catalog',
    true, false, false, true
),
(
    'd0000000-0000-0000-0000-000000000010',
    'c0000000-0000-0000-0000-000000000003',
    'Urban Stealth Snapback Cap',
    'Apex Studio',
    'urban-stealth-snapback-cap',
    'Flat-brim structured cap in water-repellent ripstop fabric with matte tonal 3D embroidery and moisture-wicking internal sweatband.',
    1199.00, 1499.00, 20, 4.7, 142, 28,
    '["Adjustable One Size"]'::jsonb,
    '["Pitch Black", "Smoke Gray"]'::jsonb,
    '["https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/caps/urban-stealth', 'VELORA Official Catalog',
    false, true, false, true
),
(
    'd0000000-0000-0000-0000-000000000011',
    'c0000000-0000-0000-0000-000000000003',
    'Nordic Ribbed Merino Beanie',
    'VELORA Atelier',
    'nordic-ribbed-merino-beanie',
    'Chunky fisherman-style ribbed beanie knitted in Scotland from 100% extrafine merino wool for itch-free warmth.',
    899.00, 1199.00, 25, 4.9, 180, 35,
    '["One Size"]'::jsonb,
    '["Charcoal", "Oatmeal", "Forest Green"]'::jsonb,
    '["https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/caps/nordic-merino-beanie', 'VELORA Official Catalog',
    false, false, false, true
),

-- BAGS & LUGGAGE
(
    'd0000000-0000-0000-0000-000000000012',
    'c0000000-0000-0000-0000-000000000004',
    'Monolith Leather Weekender Bag',
    'Monolith Luggage',
    'monolith-leather-weekender-bag',
    'Handcrafted from full-grain vegetable-tanned leather. Includes padded 16-inch laptop compartment and reinforced brass hardware.',
    6999.00, 8999.00, 22, 4.9, 174, 12,
    '["45L Standard Capacity"]'::jsonb,
    '["Espresso Brown", "Cognac Tan", "Pitch Black"]'::jsonb,
    '["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/bags/monolith-weekender', 'VELORA Official Catalog',
    true, false, false, true
),
(
    'd0000000-0000-0000-0000-000000000013',
    'c0000000-0000-0000-0000-000000000004',
    'Vanguard Commuter Weatherproof Pack',
    'Monolith Luggage',
    'vanguard-commuter-weatherproof-pack',
    'Engineered for urban commuters with ballistic 1000D Cordura, AquaGuard sealed zippers, magnetic Fidlock buckle, and hidden passport sleeve.',
    3999.00, 4999.00, 20, 4.7, 89, 20,
    '["26L Capacity"]'::jsonb,
    '["Stealth Black", "Cadet Olive", "Graphite Gray"]'::jsonb,
    '["https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/bags/vanguard-commuter', 'VELORA Official Catalog',
    false, true, false, true
),
(
    'd0000000-0000-0000-0000-000000000014',
    'c0000000-0000-0000-0000-000000000004',
    'Sienna Crossbody Saddle Bag',
    'VELORA Atelier',
    'sienna-crossbody-saddle-bag',
    'Timeless saddle silhouette in burnished saddle leather with gold-tone hardware, magnetic front flap, and detachable woven crossbody strap.',
    2499.00, 4599.00, 46, 4.9, 162, 8,
    '["Medium (24 x 18 x 7 cm)"]'::jsonb,
    '["Saddle Brown", "Forest Emerald"]'::jsonb,
    '["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/bags/sienna-crossbody', 'VELORA Official Catalog',
    false, false, true, true
),

-- MODERN CLOTHING & APPAREL
(
    'd0000000-0000-0000-0000-000000000015',
    'c0000000-0000-0000-0000-000000000005',
    'Nomad Relaxed Wool Overcoat',
    'Nomad Studio',
    'nomad-relaxed-wool-overcoat',
    'Tailored double-faced melton wool overcoat offering exceptional thermal insulation, notch lapels, and horn-style buttons.',
    5499.00, 7499.00, 27, 4.8, 96, 14,
    '["S", "M", "L", "XL", "XXL"]'::jsonb,
    '["Camel Sand", "Charcoal Gray", "Deep Black"]'::jsonb,
    '["https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/clothing/nomad-overcoat', 'VELORA Official Catalog',
    true, false, false, true
),
(
    'd0000000-0000-0000-0000-000000000016',
    'c0000000-0000-0000-0000-000000000005',
    'Heavyweight Boxy Fleece Hoodie',
    'VELORA Atelier',
    'heavyweight-boxy-fleece-hoodie',
    'Custom-milled 480 GSM French terry fleece hoodie with dropped shoulders, kangaroo pocket, and double-layered hood without drawstrings.',
    2499.00, 3199.00, 22, 4.9, 78, 40,
    '["S", "M", "L", "XL"]'::jsonb,
    '["Washed Sage", "Oatmeal Melange", "Washed Black"]'::jsonb,
    '["https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/clothing/fleece-hoodie', 'VELORA Official Catalog',
    false, true, false, true
),
(
    'd0000000-0000-0000-0000-000000000017',
    'c0000000-0000-0000-0000-000000000005',
    'Tailored Italian Linen Blazer',
    'Nomad Studio',
    'tailored-italian-linen-blazer',
    'Deconstructed unstructured blazer spun from breathable Normandy flax linen with patch pockets and buggy lining for warm-weather elegance.',
    4499.00, 5999.00, 25, 4.8, 64, 11,
    '["38R", "40R", "42R", "44R"]'::jsonb,
    '["Sand Dune", "Navy Azure"]'::jsonb,
    '["https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/clothing/linen-blazer', 'VELORA Official Catalog',
    false, false, false, true
),

-- MINIMAL ACCESSORIES
(
    'd0000000-0000-0000-0000-000000000018',
    'c0000000-0000-0000-0000-000000000006',
    'Lucent Polarized Aviator Eyewear',
    'Lucent Optics',
    'lucent-polarized-aviator-eyewear',
    'Classic teardrop aviators equipped with high-clarity polarized lenses offering 100% UVA/UVB barrier and lightweight titanium alloy frame.',
    2499.00, 3299.00, 24, 4.7, 310, 32,
    '["55mm Lens Width"]'::jsonb,
    '["Gold & Dark Olive", "Silver & Ice Blue", "Matte Gunmetal"]'::jsonb,
    '["https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/accessories/lucent-aviator', 'VELORA Official Catalog',
    true, false, false, true
),
(
    'd0000000-0000-0000-0000-000000000019',
    'c0000000-0000-0000-0000-000000000006',
    'Tuscan Leather Slim Bifold Wallet',
    'Tuscan Goods',
    'tuscan-leather-slim-bifold-wallet',
    'Slimline 6mm profile crafted from pull-up cowhide leather with 8 card slots, currency compartment, and RFID blocking security shield.',
    1299.00, 2499.00, 48, 4.8, 520, 11,
    '["Standard Slim"]'::jsonb,
    '["Whiskey Tan", "Carbon Black", "Dark Walnut"]'::jsonb,
    '["https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/accessories/slim-bifold', 'VELORA Official Catalog',
    false, false, true, true
),
(
    'd0000000-0000-0000-0000-000000000020',
    'c0000000-0000-0000-0000-000000000006',
    'Solstice Sterling Silver Cuff Bracelet',
    'VELORA Atelier',
    'solstice-sterling-silver-cuff-bracelet',
    'Solid 925 sterling silver open cuff bracelet with brushed satin finish, beveled edges, and engraved interior hallmark.',
    1999.00, 2499.00, 20, 4.9, 94, 19,
    '["Medium (6.5")", "Large (7.5")"]'::jsonb,
    '["Brushed Silver"]'::jsonb,
    '["https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/accessories/silver-cuff', 'VELORA Official Catalog',
    false, false, false, true
),

-- SMART TECH & ELECTRONICS
(
    'd0000000-0000-0000-0000-000000000021',
    'c0000000-0000-0000-0000-000000000007',
    'Aura Acoustic ANC Studio Headphones',
    'Aura Acoustics',
    'aura-acoustic-anc-studio-headphones',
    'Flagship wireless over-ear headphones featuring Hybrid Active Noise Cancellation, 40-hour battery life, and custom 40mm beryllium drivers.',
    5999.00, 7999.00, 25, 5.0, 428, 22,
    '["Standard Adjustable"]'::jsonb,
    '["Matte Black", "Cream Linen", "Silver Mist"]'::jsonb,
    '["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/tech/aura-headphones', 'VELORA Official Catalog',
    true, false, false, true
),
(
    'd0000000-0000-0000-0000-000000000022',
    'c0000000-0000-0000-0000-000000000007',
    'Pulse Smartwatch Ceramic Edition',
    'Pulse Wearables',
    'pulse-smartwatch-ceramic-edition',
    'Zirconia ceramic bezel smartwatch featuring high-contrast AMOLED retina display, ECG sensor, GPS tracking, and 7-day battery stamina.',
    7999.00, 9999.00, 20, 4.8, 112, 16,
    '["44mm Case"]'::jsonb,
    '["Polished Ceramic White", "Obsidian Black"]'::jsonb,
    '["https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/tech/pulse-smartwatch', 'VELORA Official Catalog',
    false, true, false, true
),
(
    'd0000000-0000-0000-0000-000000000023',
    'c0000000-0000-0000-0000-000000000007',
    'Sonic Boom High-Res Portable Speaker',
    'Aura Acoustics',
    'sonic-boom-high-res-portable-speaker',
    '360-degree cylindrical Bluetooth speaker packed with dual passive radiators, 24-hour battery, and aircraft-grade aluminum chassis.',
    3499.00, 4599.00, 24, 4.9, 204, 25,
    '["Standard"]'::jsonb,
    '["Anodized Gunmetal", "Desert Sand"]'::jsonb,
    '["https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/tech/sonic-boom-speaker', 'VELORA Official Catalog',
    false, false, false, true
),
(
    'd0000000-0000-0000-0000-000000000024',
    'c0000000-0000-0000-0000-000000000007',
    'Velora Ceramic Magnetic Wireless Pad',
    'VELORA Atelier',
    'velora-ceramic-magnetic-wireless-pad',
    'Solid matte ceramic 15W Qi2 fast wireless charging pad with braided aramid cable and non-slip weighted cork base.',
    1499.00, 1999.00, 25, 4.8, 156, 0,
    '["Standard (90mm diameter)"]'::jsonb,
    '["Glazed Off-White", "Basalt Charcoal"]'::jsonb,
    '["https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=700&q=80"]'::jsonb,
    'https://demo.velora.internal/catalog/tech/ceramic-wireless-pad', 'VELORA Official Catalog',
    false, true, false, true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    brand = EXCLUDED.brand,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    original_price = EXCLUDED.original_price,
    discount_percentage = EXCLUDED.discount_percentage,
    stock = EXCLUDED.stock,
    sizes = EXCLUDED.sizes,
    colors = EXCLUDED.colors,
    images = EXCLUDED.images,
    is_featured = EXCLUDED.is_featured,
    is_new = EXCLUDED.is_new,
    is_deal = EXCLUDED.is_deal,
    is_active = EXCLUDED.is_active;
