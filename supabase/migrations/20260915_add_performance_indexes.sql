-- ============================================================================
-- VELORA E-COMMERCE PLATFORM - PRODUCTION PERFORMANCE & SCALABILITY INDEXES
-- ============================================================================
-- Adds composite, partial, and high-selectivity B-tree indexes for all 
-- frequently filtered, sorted, joined, and queried columns across products,
-- orders, order_items, reviews, coupons, banners, and categories.
-- ============================================================================

-- 1. PRODUCTS TABLE OPTIMIZATIONS
-- Speeds up active category filtering (shop sidebar, category pages)
CREATE INDEX IF NOT EXISTS idx_products_category_active 
ON public.products(category_id, is_active);

-- Speeds up primary storefront sort: newest active products (home, shop, new arrivals)
CREATE INDEX IF NOT EXISTS idx_products_active_created 
ON public.products(created_at DESC) 
WHERE is_active = true;

-- Speeds up active price sorting & price-range slider filters
CREATE INDEX IF NOT EXISTS idx_products_active_price 
ON public.products(price) 
WHERE is_active = true;

-- Speeds up high-traffic homepage sections (Trending, Deals, New Arrivals)
CREATE INDEX IF NOT EXISTS idx_products_active_featured 
ON public.products(is_featured, created_at DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_deal 
ON public.products(is_deal, created_at DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_active_new 
ON public.products(is_new, created_at DESC) 
WHERE is_active = true;

-- Speeds up text searches on product brand and name
CREATE INDEX IF NOT EXISTS idx_products_active_brand 
ON public.products(brand) 
WHERE is_active = true;

-- 2. ORDERS & ORDER ITEMS OPTIMIZATIONS
-- Speeds up customer profile "My Orders" queries
CREATE INDEX IF NOT EXISTS idx_orders_user_created 
ON public.orders(user_id, created_at DESC);

-- Speeds up admin orders list filtering by status and date
CREATE INDEX IF NOT EXISTS idx_orders_status_created 
ON public.orders(order_status, created_at DESC);

-- Speeds up admin order-details line item joins
CREATE INDEX IF NOT EXISTS idx_order_items_product_id 
ON public.order_items(product_id);

-- 3. MARKETING, OFFERS & STORE CONFIGURATION OPTIMIZATIONS
-- Speeds up active hero banners query
CREATE INDEX IF NOT EXISTS idx_banners_active_order 
ON public.banners(display_order ASC) 
WHERE is_active = true;

-- Speeds up active delivery partners query
CREATE INDEX IF NOT EXISTS idx_delivery_partners_active_order 
ON public.delivery_partners(display_order ASC) 
WHERE is_active = true;

-- Speeds up checkout coupon code validation
CREATE INDEX IF NOT EXISTS idx_coupons_code_active 
ON public.coupons(code) 
WHERE is_active = true;

-- Speeds up product reviews listing
CREATE INDEX IF NOT EXISTS idx_reviews_product_created 
ON public.reviews(product_id, created_at DESC);

