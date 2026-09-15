-- ============================================================================
-- VELORA - ZERO-TRUST & DATA-MINIMIZATION SECURITY HARDENING MIGRATION
-- ============================================================================
-- 1. Hardens SECURITY DEFINER functions with search_path protection.
-- 2. Closes signup privilege escalation by forcing role = 'customer'.
-- 3. Adds trigger preventing non-admins from updating profile role.
-- 4. Overhauls RLS policies across online_gift_offers, gift_items, store_settings, coupons, orders.
-- 5. Adds tracking_data and idempotency_key to orders table.
-- 6. Enforces PostgreSQL least-privilege object grants for anon and authenticated.
-- 7. Implements server-authoritative validate_coupon & create_customer_order RPCs.
-- 8. Configures Supabase Storage bucket policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER SEARCH PATH HARDENING & ADMIN FUNCTIONS
-- ----------------------------------------------------------------------------

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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Generic updated_at timestamp refresher
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 2. PRIVILEGE ESCALATION PREVENTION ON SIGNUP & PROFILE UPDATES
-- ----------------------------------------------------------------------------

-- Always default role to 'customer' upon user signup; never trust raw_user_meta_data for role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        'customer' -- Explicitly enforced: clients cannot self-promote to admin
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Connect handle_new_user trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger preventing non-admins from changing their role or arbitrary fields
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent non-admins from altering role
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
        NEW.role := OLD.role;
    END IF;
    -- ID cannot be changed
    NEW.id := OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- ----------------------------------------------------------------------------
-- 3. ORDERS TABLE ENHANCEMENTS (TRACKING & IDEMPOTENCY)
-- ----------------------------------------------------------------------------

DO $$ 
BEGIN
    -- Add tracking_data JSONB to orders table for isolated customer tracking info
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tracking_data'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN tracking_data JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- Add idempotency_key to orders table to eliminate double-orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN idempotency_key TEXT UNIQUE;
    END IF;
END $$;

COMMENT ON COLUMN public.orders.tracking_data IS 'Per-order courier tracking details isolated to the order owner';
COMMENT ON COLUMN public.orders.idempotency_key IS 'Client-supplied unique token preventing duplicate order creation';

-- ----------------------------------------------------------------------------
-- 4. COMPREHENSIVE ROW LEVEL SECURITY (RLS) HARDENING
-- ----------------------------------------------------------------------------

-- Enable RLS on all relevant tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_gift_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_gift_items ENABLE ROW LEVEL SECURITY;

-- 4a. Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- 4b. Store Settings Policies (Data Minimization: Public can only view safe storefront keys)
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public can view safe store settings" ON public.store_settings;
CREATE POLICY "Public can view safe store settings"
    ON public.store_settings FOR SELECT
    USING (public.is_admin() OR key IN ('general', 'shipping', 'social', 'gift_offers_config'));

DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can manage store settings" ON public.store_settings;
CREATE POLICY "Admins can manage store settings"
    ON public.store_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4c. Online Gift Offers & Items Policies (Close USING (true) flaw)
DROP POLICY IF EXISTS "Public can view active gift offers" ON public.online_gift_offers;
CREATE POLICY "Public can view active gift offers" 
    ON public.online_gift_offers FOR SELECT 
    USING (
        (is_active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()))
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Admins can manage gift offers" ON public.online_gift_offers;
CREATE POLICY "Admins can manage gift offers" 
    ON public.online_gift_offers FOR ALL 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public can view gift items" ON public.online_gift_items;
CREATE POLICY "Public can view gift items" 
    ON public.online_gift_items FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.online_gift_offers o
            WHERE o.id = public.online_gift_items.offer_id
            AND (o.is_active = true OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "Admins can manage gift items" ON public.online_gift_items;
CREATE POLICY "Admins can manage gift items" 
    ON public.online_gift_items FOR ALL 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4d. Coupons Policies (Admin manages; customers validate via RPC)
DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins have full CRUD on coupons" ON public.coupons;
CREATE POLICY "Public can view active coupons"
    ON public.coupons FOR SELECT
    USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins have full CRUD on coupons"
    ON public.coupons FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4e. Orders & Order Items (Strict User Isolation)
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

-- ----------------------------------------------------------------------------
-- 5. SECURE RPCs FOR STOREFRONT OPERATIONS
-- ----------------------------------------------------------------------------

-- 5a. Secure Coupon Validation RPC (Exposes ONLY customer-safe fields)
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_cart_subtotal NUMERIC)
RETURNS JSONB AS $$
DECLARE
    v_coupon RECORD;
    v_discount NUMERIC := 0.00;
BEGIN
    IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Coupon code is required.');
    END IF;

    SELECT * INTO v_coupon FROM public.coupons
    WHERE UPPER(code) = UPPER(trim(p_code))
      AND is_active = true
      AND (expiry_date IS NULL OR expiry_date >= NOW())
      AND (usage_limit IS NULL OR used_count < usage_limit);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Invalid, inactive, or expired coupon code.');
    END IF;

    IF p_cart_subtotal IS NOT NULL AND p_cart_subtotal < COALESCE(v_coupon.min_order_amount, 0) THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', format('Coupon requires a minimum cart value of ₹%s.', round(v_coupon.min_order_amount))
        );
    END IF;

    -- Calculate discount amount
    IF v_coupon.discount_type = 'percentage' THEN
        v_discount := round((COALESCE(p_cart_subtotal, 0) * (v_coupon.discount_value / 100.0)), 2);
        IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
            v_discount := v_coupon.max_discount;
        END IF;
    ELSE
        v_discount := LEAST(v_coupon.discount_value, COALESCE(p_cart_subtotal, 0));
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'id', v_coupon.id,
        'code', v_coupon.code,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value,
        'max_discount', v_coupon.max_discount,
        'min_order_amount', v_coupon.min_order_amount,
        'calculated_discount', v_discount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5b. Server-Authoritative Order Creation RPC
CREATE OR REPLACE FUNCTION public.create_customer_order(
    p_items JSONB,
    p_payment_method TEXT,
    p_coupon_code TEXT DEFAULT NULL,
    p_delivery_details JSONB DEFAULT '{}'::jsonb,
    p_delivery_preference TEXT DEFAULT 'Simple Delivery',
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_existing_order RECORD;
    v_subtotal NUMERIC(12, 2) := 0.00;
    v_discount NUMERIC(12, 2) := 0.00;
    v_shipping NUMERIC(12, 2) := 0.00;
    v_tax NUMERIC(12, 2) := 0.00;
    v_total NUMERIC(12, 2) := 0.00;
    v_advance_amount NUMERIC(12, 2) := 0.00;
    v_advance_paid NUMERIC(12, 2) := 0.00;
    v_cod_balance NUMERIC(12, 2) := 0.00;
    v_is_full_online BOOLEAN := false;
    v_free_gifts_eligible BOOLEAN := false;
    v_free_gifts_items JSONB := '[]'::jsonb;
    v_order_id UUID;
    v_order_number TEXT;
    v_item JSONB;
    v_product RECORD;
    v_item_qty INTEGER;
    v_item_price NUMERIC(12, 2);
    v_item_subtotal NUMERIC(12, 2);
    v_item_adv NUMERIC(12, 2);
    v_item_cod NUMERIC(12, 2);
    v_coupon_res JSONB;
    v_coupon_id UUID;
    v_eta TEXT;
BEGIN
    v_user_id := auth.uid();

    -- 1. Idempotency Check
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        SELECT id, order_number, total, payment_method, payment_status, order_status, created_at
        INTO v_existing_order
        FROM public.orders
        WHERE idempotency_key = trim(p_idempotency_key)
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'order_id', v_existing_order.id,
                'order_number', v_existing_order.order_number,
                'total', v_existing_order.total,
                'payment_method', v_existing_order.payment_method,
                'payment_status', v_existing_order.payment_status,
                'order_status', v_existing_order.order_status
            );
        END IF;
    END IF;

    -- Validate Items
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order must contain at least one item.');
    END IF;

    -- Determine online vs COD
    IF p_payment_method IN ('UPI / QR Payment', 'Credit / Debit Card', 'Net Banking', 'online') THEN
        v_is_full_online := true;
    END IF;

    -- 2. Process Items against Authoritative Product Prices
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_qty := COALESCE((v_item->>'quantity')::INTEGER, 1);
        IF v_item_qty < 1 THEN v_item_qty := 1; END IF;

        -- Fetch authoritative product details from database
        SELECT * INTO v_product
        FROM public.products
        WHERE id = (v_item->>'product_id')::UUID
          AND is_active = true;

        IF NOT FOUND THEN
            -- Try searching by slug
            SELECT * INTO v_product
            FROM public.products
            WHERE slug = (v_item->>'slug')::TEXT
              AND is_active = true;
        END IF;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Product not available or inactive: ' || COALESCE(v_item->>'name', 'Unknown'));
        END IF;

        -- Authoritative price
        v_item_price := v_product.price;
        v_item_subtotal := round(v_item_price * v_item_qty, 2);
        v_subtotal := v_subtotal + v_item_subtotal;

        -- Authoritative Advance Calculation (only if COD)
        IF NOT v_is_full_online THEN
            IF v_product.advance_payment_enabled THEN
                IF v_product.advance_payment_type = 'percentage' THEN
                    v_item_adv := round(v_item_subtotal * (LEAST(100.0, v_product.advance_payment_value) / 100.0), 2);
                ELSE
                    v_item_adv := round(LEAST(v_item_subtotal, v_product.advance_payment_value * v_item_qty), 2);
                END IF;
            ELSE
                v_item_adv := 0.00;
            END IF;
            v_advance_amount := v_advance_amount + v_item_adv;
        END IF;
    END LOOP;

    -- 3. Authoritative Coupon Verification
    IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
        v_coupon_res := public.validate_coupon(p_coupon_code, v_subtotal);
        IF (v_coupon_res->>'valid')::BOOLEAN THEN
            v_discount := (v_coupon_res->>'calculated_discount')::NUMERIC;
            v_coupon_id := (v_coupon_res->>'id')::UUID;
            -- Increment coupon used_count atomically
            UPDATE public.coupons SET used_count = used_count + 1 WHERE id = v_coupon_id;
        END IF;
    END IF;

    -- 4. Calculate Final Financials
    v_total := GREATEST(0.00, v_subtotal - v_discount + v_shipping + v_tax);

    IF v_is_full_online THEN
        v_advance_amount := 0.00;
        v_advance_paid := v_total;
        v_cod_balance := 0.00;
        v_free_gifts_eligible := true;

        -- Resolve Free Gifts for Full Online Payment
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'name', gi.name,
                    'quantity', gi.quantity,
                    'description', gi.description,
                    'icon_or_image', gi.icon_or_image
                )
            ),
            '[]'::jsonb
        ) INTO v_free_gifts_items
        FROM public.online_gift_items gi
        JOIN public.online_gift_offers go ON go.id = gi.offer_id
        WHERE go.is_active = true
          AND (go.start_date IS NULL OR go.start_date <= NOW())
          AND (go.end_date IS NULL OR go.end_date >= NOW())
          AND (
              go.target_type = 'category' AND go.category_id IN (
                  SELECT category_id FROM public.products WHERE id IN (
                      SELECT (elem->>'product_id')::UUID FROM jsonb_array_elements(p_items) elem WHERE elem->>'product_id' IS NOT NULL
                  )
              )
              OR go.target_type = 'product' AND go.product_id IN (
                  SELECT (elem->>'product_id')::UUID FROM jsonb_array_elements(p_items) elem WHERE elem->>'product_id' IS NOT NULL
              )
          );
    ELSE
        v_advance_amount := LEAST(v_total, v_advance_amount);
        v_advance_paid := 0.00;
        v_cod_balance := GREATEST(0.00, v_total - v_advance_amount);
        v_free_gifts_eligible := false;
        v_free_gifts_items := '[]'::jsonb;
    END IF;

    -- 5. Generate unique order number
    v_order_number := 'VEL-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 5));
    v_eta := to_char(NOW() + INTERVAL '4 days', 'Dy, DD Mon');

    -- 6. Insert Order Atomically
    INSERT INTO public.orders (
        user_id,
        order_number,
        subtotal,
        discount,
        shipping_charge,
        tax,
        total,
        payment_method,
        payment_status,
        order_status,
        advance_amount,
        advance_paid,
        cod_balance,
        advance_payment_status,
        cod_payment_status,
        delivery_full_name,
        delivery_phone,
        delivery_address,
        delivery_city,
        delivery_state,
        delivery_country,
        delivery_pincode,
        estimated_delivery,
        delivery_preference,
        free_gifts_eligible,
        free_gifts_items,
        is_full_online_payment,
        idempotency_key
    ) VALUES (
        v_user_id,
        v_order_number,
        v_subtotal,
        v_discount,
        v_shipping,
        v_tax,
        v_total,
        p_payment_method,
        CASE WHEN v_is_full_online THEN 'paid' ELSE 'pending' END,
        'placed',
        v_advance_amount,
        v_advance_paid,
        v_cod_balance,
        CASE WHEN v_is_full_online THEN 'paid' WHEN v_advance_amount > 0 THEN 'pending' ELSE 'not_required' END,
        CASE WHEN v_is_full_online THEN 'not_applicable' ELSE 'pending' END,
        COALESCE(p_delivery_details->>'full_name', 'Valued Customer'),
        COALESCE(p_delivery_details->>'phone', ''),
        COALESCE(p_delivery_details->>'address', ''),
        COALESCE(p_delivery_details->>'city', ''),
        COALESCE(p_delivery_details->>'state', ''),
        COALESCE(p_delivery_details->>'country', 'India'),
        COALESCE(p_delivery_details->>'pincode', ''),
        v_eta,
        COALESCE(p_delivery_preference, 'Simple Delivery'),
        v_free_gifts_eligible,
        v_free_gifts_items,
        v_is_full_online,
        p_idempotency_key
    ) RETURNING id INTO v_order_id;

    -- 7. Insert Order Items Atomically
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_qty := COALESCE((v_item->>'quantity')::INTEGER, 1);
        SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::UUID OR slug = (v_item->>'slug')::TEXT LIMIT 1;
        
        IF FOUND THEN
            v_item_price := v_product.price;
            v_item_subtotal := round(v_item_price * v_item_qty, 2);
            
            INSERT INTO public.order_items (
                order_id,
                product_id,
                product_name,
                product_image,
                price,
                quantity,
                selected_size,
                selected_color,
                subtotal,
                advance_payment_enabled,
                advance_payment_type,
                advance_payment_value,
                advance_amount,
                cod_balance
            ) VALUES (
                v_order_id,
                v_product.id,
                v_product.name,
                CASE WHEN jsonb_array_length(v_product.images) > 0 THEN v_product.images->>0 ELSE NULL END,
                v_item_price,
                v_item_qty,
                v_item->>'selected_size',
                v_item->>'selected_color',
                v_item_subtotal,
                v_product.advance_payment_enabled,
                v_product.advance_payment_type,
                v_product.advance_payment_value,
                CASE WHEN v_is_full_online THEN 0.00 ELSE round(LEAST(v_item_subtotal, v_product.advance_payment_value * v_item_qty), 2) END,
                CASE WHEN v_is_full_online THEN 0.00 ELSE round(GREATEST(0.00, v_item_subtotal - (v_product.advance_payment_value * v_item_qty)), 2) END
            );

            -- Atomically decrement stock if available
            UPDATE public.products 
            SET stock = GREATEST(0, stock - v_item_qty)
            WHERE id = v_product.id;
        END IF;
    END LOOP;

    -- Return strictly customer-safe order summary
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'discount', v_discount,
        'shipping_charge', v_shipping,
        'total', v_total,
        'payment_method', p_payment_method,
        'payment_status', CASE WHEN v_is_full_online THEN 'paid' ELSE 'pending' END,
        'order_status', 'placed',
        'advance_amount', v_advance_amount,
        'advance_paid', v_advance_paid,
        'cod_balance', v_cod_balance,
        'delivery_preference', COALESCE(p_delivery_preference, 'Simple Delivery'),
        'free_gifts_eligible', v_free_gifts_eligible,
        'free_gifts_items', v_free_gifts_items,
        'estimated_delivery', v_eta
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 6. POSTGRESQL LEAST PRIVILEGE OBJECT GRANTS
-- ----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Customers can view catalogs and insert orders/reviews
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT SELECT ON public.delivery_partners TO anon, authenticated;
GRANT SELECT ON public.online_gift_offers TO anon, authenticated;
GRANT SELECT ON public.online_gift_items TO anon, authenticated;
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.reviews TO authenticated;

-- Order placement and ownership
GRANT SELECT, INSERT ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT ON public.order_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.wishlist TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- RPC execution
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order(JSONB, TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Revoke destructive access from anon and ordinary authenticated
REVOKE UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE DELETE, TRUNCATE ON public.products, public.categories, public.coupons, public.banners, public.delivery_partners, public.store_settings FROM authenticated;

-- ----------------------------------------------------------------------------
-- 7. SUPABASE STORAGE BUCKET POLICIES (DEFENSE-IN-DEPTH)
-- ----------------------------------------------------------------------------

-- Ensure storage schema policies are applied if storage extension is active
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        -- Allow public to read public bucket objects
        DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
        CREATE POLICY "Public can view product images" ON storage.objects
            FOR SELECT USING (bucket_id = 'product-images');

        -- Only admins can upload product images
        DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
        CREATE POLICY "Admins can upload product images" ON storage.objects
            FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

        -- Private customer bucket: only owner can read/write their own folder
        DROP POLICY IF EXISTS "Customers can access own documents" ON storage.objects;
        CREATE POLICY "Customers can access own documents" ON storage.objects
            FOR ALL USING (
                bucket_id = 'customer-documents' AND
                auth.uid()::text = (storage.foldername(name))[1]
            );
    END IF;
END $$;

