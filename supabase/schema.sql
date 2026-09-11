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
