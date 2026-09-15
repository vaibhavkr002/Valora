-- ============================================================================
-- VELORA - DYNAMIC ONLINE PAYMENT GIFT OFFERS & ITEMS SCHEMA MIGRATION
-- ============================================================================
-- Creates tables for managing category and product-level free gift offers
-- awarded for 100% full online payments.
-- ============================================================================

-- 1. Table: online_gift_offers
CREATE TABLE IF NOT EXISTS public.online_gift_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'category' CHECK (target_type IN ('category', 'product')),
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table: online_gift_items
CREATE TABLE IF NOT EXISTS public.online_gift_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES public.online_gift_offers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon_or_image TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for rapid lookups
CREATE INDEX IF NOT EXISTS idx_gift_offers_cat ON public.online_gift_offers(category_id) WHERE target_type = 'category';
CREATE INDEX IF NOT EXISTS idx_gift_offers_prod ON public.online_gift_offers(product_id) WHERE target_type = 'product';
CREATE INDEX IF NOT EXISTS idx_gift_offers_active ON public.online_gift_offers(is_active);
CREATE INDEX IF NOT EXISTS idx_gift_items_offer ON public.online_gift_items(offer_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.online_gift_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_gift_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Public can view active gift offers" ON public.online_gift_offers;
CREATE POLICY "Public can view active gift offers" 
    ON public.online_gift_offers FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Public can view gift items" ON public.online_gift_items;
CREATE POLICY "Public can view gift items" 
    ON public.online_gift_items FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Admins can manage gift offers" ON public.online_gift_offers;
CREATE POLICY "Admins can manage gift offers" 
    ON public.online_gift_offers FOR ALL 
    USING (true);

DROP POLICY IF EXISTS "Admins can manage gift items" ON public.online_gift_items;
CREATE POLICY "Admins can manage gift items" 
    ON public.online_gift_items FOR ALL 
    USING (true);

-- 6. Initial Seed Data
-- Shoes & Footwear Gift Offer (Default Active)
DO $$
DECLARE
    shoes_cat_id UUID := 'c0000000-0000-0000-0000-000000000001';
    watches_cat_id UUID := 'c0000000-0000-0000-0000-000000000002';
    bags_cat_id UUID := 'c0000000-0000-0000-0000-000000000004';
    shoes_offer_id UUID;
    watches_offer_id UUID;
    bags_offer_id UUID;
BEGIN
    -- Check if shoes category exists
    IF EXISTS (SELECT 1 FROM public.categories WHERE id = shoes_cat_id) THEN
        IF NOT EXISTS (SELECT 1 FROM public.online_gift_offers WHERE category_id = shoes_cat_id) THEN
            INSERT INTO public.online_gift_offers (title, target_type, category_id, is_active, priority)
            VALUES ('Shoes & Footwear Luxury Pack', 'category', shoes_cat_id, true, 10)
            RETURNING id INTO shoes_offer_id;

            INSERT INTO public.online_gift_items (offer_id, name, description, icon_or_image, quantity, display_order)
            VALUES 
                (shoes_offer_id, 'Luxury Cotton Crew Socks', 'Premium combed cotton comfort socks', 'https://images.unsplash.com/photo-1582966772680-860e372bb558?w=200', 1, 1),
                (shoes_offer_id, 'Premium Extra Laces', 'Signature woven replacement laces', 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=200', 1, 2),
                (shoes_offer_id, 'Signature VELORA Keychain', 'Brushed stainless luxury metal accessory', 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=200', 1, 3);
        END IF;
    END IF;

    -- Watches category offer
    IF EXISTS (SELECT 1 FROM public.categories WHERE id = watches_cat_id) THEN
        IF NOT EXISTS (SELECT 1 FROM public.online_gift_offers WHERE category_id = watches_cat_id) THEN
            INSERT INTO public.online_gift_offers (title, target_type, category_id, is_active, priority)
            VALUES ('Watch Care & Storage Bundle', 'category', watches_cat_id, true, 10)
            RETURNING id INTO watches_offer_id;

            INSERT INTO public.online_gift_items (offer_id, name, description, icon_or_image, quantity, display_order)
            VALUES 
                (watches_offer_id, 'Premium Travel Watch Case', 'Cushioned protective leather watch pouch', 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=200', 1, 1),
                (watches_offer_id, 'Microfiber Polishing Cloth', 'High-density scratch-free watch cleaner', 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=200', 1, 2);
        END IF;
    END IF;

    -- Bags category offer
    IF EXISTS (SELECT 1 FROM public.categories WHERE id = bags_cat_id) THEN
        IF NOT EXISTS (SELECT 1 FROM public.online_gift_offers WHERE category_id = bags_cat_id) THEN
            INSERT INTO public.online_gift_offers (title, target_type, category_id, is_active, priority)
            VALUES ('Bag Organizer & Key Ring Kit', 'category', bags_cat_id, true, 10)
            RETURNING id INTO bags_offer_id;

            INSERT INTO public.online_gift_items (offer_id, name, description, icon_or_image, quantity, display_order)
            VALUES 
                (bags_offer_id, 'Compact Bag Organizer Insert', 'Multi-compartment organizer for totes & duffels', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200', 1, 1),
                (bags_offer_id, 'Signature VELORA Keychain', 'Luxury metal key ring with clip', 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=200', 1, 2);
        END IF;
    END IF;
END $$;

