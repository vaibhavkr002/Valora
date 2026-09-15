-- ============================================================================
-- VELORA - PRODUCT SPECIFICATIONS & CUSTOMER ANALYTICS MIGRATION
-- ============================================================================
-- 1. Creates public.product_specifications with RLS and indexing.
-- 2. Creates public.customer_analytics with privacy-hardened INSERT-only customer RLS.
-- 3. Implements server-authoritative aggregation RPCs for Admin Analytics (IST aware).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PRODUCT SPECIFICATIONS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT 'General',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.product_specifications IS 'Dynamic technical specifications per individual product';
COMMENT ON COLUMN public.product_specifications.group_name IS 'Optional category/grouping header (e.g. General, Materials, Dimensions, Performance)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prod_specs_product_id 
    ON public.product_specifications(product_id);

CREATE INDEX IF NOT EXISTS idx_prod_specs_active_order 
    ON public.product_specifications(product_id, is_active, display_order);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_prod_specs_updated_at ON public.product_specifications;
CREATE TRIGGER trg_prod_specs_updated_at
    BEFORE UPDATE ON public.product_specifications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.product_specifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view active specs of active products" ON public.product_specifications;
DROP POLICY IF EXISTS "Admins can manage all product specifications" ON public.product_specifications;

-- Public can view ONLY active specifications for active products
CREATE POLICY "Public can view active specs of active products"
    ON public.product_specifications
    FOR SELECT
    TO public
    USING (
        is_active = true AND
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_specifications.product_id AND p.is_active = true
        )
    );

-- Admins have full access to manage all specifications
CREATE POLICY "Admins can manage all product specifications"
    ON public.product_specifications
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Object permissions
GRANT SELECT ON public.product_specifications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_specifications TO authenticated;
GRANT ALL ON public.product_specifications TO service_role;


-- ----------------------------------------------------------------------------
-- 2. CUSTOMER ANALYTICS TABLE (FIRST-PARTY PRIVACY STOREFRONT TRACKING)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'search', 'add_to_cart', 'wishlist_action', 'checkout_started', 'order_completed', 'product_view')),
    page_path TEXT NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    category_slug TEXT,
    search_query TEXT,
    device_type TEXT NOT NULL DEFAULT 'desktop' CHECK (device_type IN ('mobile', 'desktop', 'tablet')),
    referrer TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.customer_analytics IS 'Storefront first-party customer interaction & conversion analytics';

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_customer_analytics_created_at 
    ON public.customer_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_analytics_event_created 
    ON public.customer_analytics(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_analytics_session 
    ON public.customer_analytics(session_id);

CREATE INDEX IF NOT EXISTS idx_customer_analytics_visitor 
    ON public.customer_analytics(visitor_id);

CREATE INDEX IF NOT EXISTS idx_customer_analytics_product 
    ON public.customer_analytics(product_id) 
    WHERE product_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.customer_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can insert analytics events" ON public.customer_analytics;
DROP POLICY IF EXISTS "Admins can manage analytics" ON public.customer_analytics;

-- Public / anon / authenticated can ONLY insert valid events.
-- ZERO SELECT/UPDATE/DELETE access for general public to safeguard customer privacy.
CREATE POLICY "Public can insert analytics events"
    ON public.customer_analytics
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Admins can view and query analytics
CREATE POLICY "Admins can manage analytics"
    ON public.customer_analytics
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Object permissions
GRANT INSERT ON public.customer_analytics TO anon, authenticated;
GRANT SELECT ON public.customer_analytics TO authenticated;
GRANT ALL ON public.customer_analytics TO service_role;


-- ----------------------------------------------------------------------------
-- 3. SERVER-AUTHORITATIVE ANALYTICS AGGREGATION RPCS (ADMIN ONLY, IST AWARE)
-- ----------------------------------------------------------------------------

-- RPC 1: High-level Summary Metrics & Conversion Funnel
CREATE OR REPLACE FUNCTION public.get_analytics_summary(
    start_time TIMESTAMPTZ DEFAULT NULL,
    end_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_today_start TIMESTAMPTZ;
    v_today_visitors BIGINT;
    v_unique_visitors BIGINT;
    v_total_page_views BIGINT;
    v_total_sessions BIGINT;
    v_product_views BIGINT;
    v_add_to_cart BIGINT;
    v_checkout_started BIGINT;
    v_orders_count BIGINT;
    v_total_revenue NUMERIC;
    v_active_visitors_now BIGINT;
    v_conversion_rate NUMERIC;
    v_peak_hour TEXT;
BEGIN
    -- Authorize admin only
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required to view analytics.';
    END IF;

    -- Defaults
    v_start := COALESCE(start_time, NOW() - INTERVAL '30 days');
    v_end := COALESCE(end_time, NOW());

    -- Today start in Indian Standard Time (Asia/Kolkata)
    v_today_start := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata';

    -- Today's Visitors
    SELECT COUNT(DISTINCT visitor_id)
    INTO v_today_visitors
    FROM public.customer_analytics
    WHERE created_at >= v_today_start;

    -- Active Visitors Now (last 10 minutes)
    SELECT COUNT(DISTINCT session_id)
    INTO v_active_visitors_now
    FROM public.customer_analytics
    WHERE created_at >= (NOW() - INTERVAL '10 minutes');

    -- Aggregations within requested timeframe
    SELECT 
        COUNT(DISTINCT visitor_id),
        COUNT(DISTINCT session_id),
        COUNT(*) FILTER (WHERE event_type = 'page_view'),
        COUNT(*) FILTER (WHERE event_type = 'product_view'),
        COUNT(*) FILTER (WHERE event_type = 'add_to_cart'),
        COUNT(*) FILTER (WHERE event_type = 'checkout_started')
    INTO 
        v_unique_visitors,
        v_total_sessions,
        v_total_page_views,
        v_product_views,
        v_add_to_cart,
        v_checkout_started
    FROM public.customer_analytics
    WHERE created_at BETWEEN v_start AND v_end;

    -- Actual Orders & Revenue from public.orders table within timeframe
    SELECT 
        COUNT(*),
        COALESCE(SUM(total), 0)
    INTO 
        v_orders_count,
        v_total_revenue
    FROM public.orders
    WHERE created_at BETWEEN v_start AND v_end
      AND order_status != 'cancelled';

    -- Conversion Rate = (Completed Orders / Sessions) * 100
    IF v_total_sessions > 0 THEN
        v_conversion_rate := ROUND(((v_orders_count::NUMERIC / v_total_sessions::NUMERIC) * 100), 2);
    ELSE
        v_conversion_rate := 0.00;
    END IF;

    -- Calculate Peak Traffic Hour in IST
    SELECT TO_CHAR(EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Kolkata')), 'FM00') || ':00 - ' ||
           TO_CHAR((EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Kolkata'))::INT + 1) % 24, 'FM00') || ':00 IST'
    INTO v_peak_hour
    FROM public.customer_analytics
    WHERE created_at BETWEEN v_start AND v_end
    GROUP BY EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Kolkata'))
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    RETURN jsonb_build_object(
        'today_visitors', COALESCE(v_today_visitors, 0),
        'active_visitors_now', COALESCE(v_active_visitors_now, 0),
        'unique_visitors', COALESCE(v_unique_visitors, 0),
        'total_sessions', COALESCE(v_total_sessions, 0),
        'total_page_views', COALESCE(v_total_page_views, 0),
        'product_views', COALESCE(v_product_views, 0),
        'add_to_cart', COALESCE(v_add_to_cart, 0),
        'checkout_started', COALESCE(v_checkout_started, 0),
        'orders_count', COALESCE(v_orders_count, 0),
        'total_revenue', COALESCE(v_total_revenue, 0),
        'conversion_rate', COALESCE(v_conversion_rate, 0),
        'peak_hour', COALESCE(v_peak_hour, 'N/A')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- RPC 2: Hourly Traffic for Current Day (IST Asia/Kolkata aware)
CREATE OR REPLACE FUNCTION public.get_hourly_traffic(
    target_date DATE DEFAULT NULL
)
RETURNS TABLE (
    hour_of_day INT,
    page_views BIGINT,
    unique_visitors BIGINT,
    cart_actions BIGINT,
    orders_count BIGINT
) AS $$
DECLARE
    v_date DATE;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required.';
    END IF;

    -- Target date in IST
    v_date := COALESCE(target_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE);
    v_start := v_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata';
    v_end := (v_date + INTERVAL '1 day')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata';

    RETURN QUERY
    WITH hours_series AS (
        SELECT generate_series(0, 23) AS hr
    ),
    analytics_agg AS (
        SELECT 
            EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Kolkata'))::INT AS hr,
            COUNT(*) FILTER (WHERE event_type = 'page_view') AS pv,
            COUNT(DISTINCT visitor_id) AS uv,
            COUNT(*) FILTER (WHERE event_type = 'add_to_cart') AS cart
        FROM public.customer_analytics
        WHERE created_at >= v_start AND created_at < v_end
        GROUP BY 1
    ),
    orders_agg AS (
        SELECT 
            EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Kolkata'))::INT AS hr,
            COUNT(*) AS ord
        FROM public.orders
        WHERE created_at >= v_start AND created_at < v_end
          AND order_status != 'cancelled'
        GROUP BY 1
    )
    SELECT 
        h.hr AS hour_of_day,
        COALESCE(a.pv, 0)::BIGINT AS page_views,
        COALESCE(a.uv, 0)::BIGINT AS unique_visitors,
        COALESCE(a.cart, 0)::BIGINT AS cart_actions,
        COALESCE(o.ord, 0)::BIGINT AS orders_count
    FROM hours_series h
    LEFT JOIN analytics_agg a ON a.hr = h.hr
    LEFT JOIN orders_agg o ON o.hr = h.hr
    ORDER BY h.hr ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- RPC 3: Daily Traffic for Last N Days (IST Asia/Kolkata aware)
CREATE OR REPLACE FUNCTION public.get_daily_traffic(
    days_count INT DEFAULT 30
)
RETURNS TABLE (
    report_date DATE,
    page_views BIGINT,
    unique_visitors BIGINT,
    sessions BIGINT,
    orders_count BIGINT
) AS $$
DECLARE
    v_end_date DATE;
    v_start_date DATE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required.';
    END IF;

    v_end_date := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_start_date := v_end_date - (GREATEST(1, LEAST(days_count, 90)) - 1);

    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(v_start_date, v_end_date, '1 day'::interval)::DATE AS dt
    ),
    analytics_daily AS (
        SELECT 
            (created_at AT TIME ZONE 'Asia/Kolkata')::DATE AS dt,
            COUNT(*) FILTER (WHERE event_type = 'page_view') AS pv,
            COUNT(DISTINCT visitor_id) AS uv,
            COUNT(DISTINCT session_id) AS sess
        FROM public.customer_analytics
        WHERE created_at >= (v_start_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')
          AND created_at < ((v_end_date + 1)::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')
        GROUP BY 1
    ),
    orders_daily AS (
        SELECT 
            (created_at AT TIME ZONE 'Asia/Kolkata')::DATE AS dt,
            COUNT(*) AS ord
        FROM public.orders
        WHERE created_at >= (v_start_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')
          AND created_at < ((v_end_date + 1)::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')
          AND order_status != 'cancelled'
        GROUP BY 1
    )
    SELECT 
        d.dt AS report_date,
        COALESCE(a.pv, 0)::BIGINT AS page_views,
        COALESCE(a.uv, 0)::BIGINT AS unique_visitors,
        COALESCE(a.sess, 0)::BIGINT AS sessions,
        COALESCE(o.ord, 0)::BIGINT AS orders_count
    FROM date_series d
    LEFT JOIN analytics_daily a ON a.dt = d.dt
    LEFT JOIN orders_daily o ON o.dt = d.dt
    ORDER BY d.dt ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- RPC 4: Top Pages, Products, Categories, Devices, and Searches
CREATE OR REPLACE FUNCTION public.get_top_pages_and_products(
    limit_count INT DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
    v_limit INT;
    v_top_pages JSONB;
    v_top_products JSONB;
    v_top_categories JSONB;
    v_device_breakdown JSONB;
    v_top_searches JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required.';
    END IF;

    v_limit := GREATEST(1, LEAST(limit_count, 50));

    -- Top Pages
    SELECT jsonb_agg(sub)
    INTO v_top_pages
    FROM (
        SELECT page_path, COUNT(*) AS views
        FROM public.customer_analytics
        WHERE event_type = 'page_view'
        GROUP BY page_path
        ORDER BY views DESC
        LIMIT v_limit
    ) sub;

    -- Top Products
    SELECT jsonb_agg(sub)
    INTO v_top_products
    FROM (
        SELECT 
            ca.product_id, 
            COALESCE(p.name, 'Product ' || ca.product_id::text) AS product_name,
            COUNT(*) AS views
        FROM public.customer_analytics ca
        LEFT JOIN public.products p ON p.id = ca.product_id
        WHERE ca.product_id IS NOT NULL AND ca.event_type IN ('product_view', 'page_view')
        GROUP BY ca.product_id, p.name
        ORDER BY views DESC
        LIMIT v_limit
    ) sub;

    -- Top Categories
    SELECT jsonb_agg(sub)
    INTO v_top_categories
    FROM (
        SELECT category_slug, COUNT(*) AS views
        FROM public.customer_analytics
        WHERE category_slug IS NOT NULL AND category_slug != ''
        GROUP BY category_slug
        ORDER BY views DESC
        LIMIT v_limit
    ) sub;

    -- Device breakdown
    SELECT jsonb_build_object(
        'mobile', COUNT(*) FILTER (WHERE device_type = 'mobile'),
        'desktop', COUNT(*) FILTER (WHERE device_type = 'desktop'),
        'tablet', COUNT(*) FILTER (WHERE device_type = 'tablet')
    )
    INTO v_device_breakdown
    FROM public.customer_analytics;

    -- Top Searches
    SELECT jsonb_agg(sub)
    INTO v_top_searches
    FROM (
        SELECT search_query, COUNT(*) AS search_count
        FROM public.customer_analytics
        WHERE event_type = 'search' AND search_query IS NOT NULL AND search_query != ''
        GROUP BY search_query
        ORDER BY search_count DESC
        LIMIT v_limit
    ) sub;

    RETURN jsonb_build_object(
        'top_pages', COALESCE(v_top_pages, '[]'::jsonb),
        'top_products', COALESCE(v_top_products, '[]'::jsonb),
        'top_categories', COALESCE(v_top_categories, '[]'::jsonb),
        'devices', COALESCE(v_device_breakdown, '{"mobile": 0, "desktop": 0, "tablet": 0}'::jsonb),
        'top_searches', COALESCE(v_top_searches, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- RPC 5: Active Visitors Now
CREATE OR REPLACE FUNCTION public.get_active_visitors_now()
RETURNS BIGINT AS $$
DECLARE
    v_count BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    SELECT COUNT(DISTINCT session_id)
    INTO v_count
    FROM public.customer_analytics
    WHERE created_at >= (NOW() - INTERVAL '10 minutes');

    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_analytics_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hourly_traffic TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_traffic TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_pages_and_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_visitors_now TO authenticated;

