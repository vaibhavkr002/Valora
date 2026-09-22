-- ============================================================================
-- MIGRATION: 20260918_order_cancellation_and_return_system.sql
-- DESCRIPTION:
-- 1. Create public.order_requests table for cancellation and return management.
-- 2. Indexes on order_id, user_id, status, and request_type.
-- 3. Update public.orders order_status check constraint safely.
-- 4. Row Level Security (RLS) policies for customers and administrators.
-- 5. Atomic admin processing RPC for cancellation and return requests.
-- ============================================================================

-- 1. CREATE ORDER REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.order_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('cancellation', 'return')),
    reason TEXT NOT NULL,
    custom_reason TEXT,
    description TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
        'requested',
        'approved',
        'rejected',
        'pickup_scheduled',
        'in_transit',
        'received',
        'refund_processing',
        'refunded',
        'closed',
        'cancelled'
    )),
    admin_notes TEXT,
    refund_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (refund_amount >= 0),
    refund_status TEXT DEFAULT 'not_applicable' CHECK (refund_status IN (
        'not_applicable',
        'pending',
        'processing',
        'refunded',
        'rejected'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.order_requests IS 'Customer cancellation and return requests linked to orders and items';

-- 2. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_order_requests_order_id ON public.order_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_order_requests_user_id ON public.order_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_order_requests_status ON public.order_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_requests_type ON public.order_requests(request_type);

-- 3. UPDATE ORDERS ORDER_STATUS CONSTRAINT SAFELY
DO $$
BEGIN
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check 
        CHECK (order_status IN ('placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'cancellation_requested', 'return_requested', 'returned'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 4. ROW LEVEL SECURITY POLICIES
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;

-- Customers can view their own order requests
DROP POLICY IF EXISTS "Users can view their own order requests" ON public.order_requests;
CREATE POLICY "Users can view their own order requests"
    ON public.order_requests FOR SELECT
    USING (
        auth.uid() = user_id 
        OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
        OR public.is_admin()
    );

-- Customers can insert cancellation/return requests for their own orders
DROP POLICY IF EXISTS "Users can create requests for their own orders" ON public.order_requests;
CREATE POLICY "Users can create requests for their own orders"
    ON public.order_requests FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()))
        OR public.is_admin()
    );

-- Admins have full CRUD on order requests
DROP POLICY IF EXISTS "Admins have full CRUD on order requests" ON public.order_requests;
CREATE POLICY "Admins have full CRUD on order requests"
    ON public.order_requests FOR ALL
    USING (public.is_admin());

GRANT SELECT, INSERT ON public.order_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_requests TO authenticated;
GRANT SELECT ON public.order_requests TO anon;

-- 5. ATOMIC ADMIN PROCESSING RPC
CREATE OR REPLACE FUNCTION public.admin_process_order_request(
    p_request_id UUID,
    p_action TEXT,              -- 'approve', 'reject', 'update_status'
    p_target_status TEXT,       -- new status for order_requests
    p_admin_notes TEXT,
    p_refund_amount NUMERIC DEFAULT NULL,
    p_refund_status TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
    v_order RECORD;
    v_new_order_status TEXT;
    v_new_payment_status TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied. Only administrators can process order requests.';
    END IF;

    SELECT * INTO v_req FROM public.order_requests WHERE id = p_request_id;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request not found');
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = v_req.order_id;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Linked order not found');
    END IF;

    -- Handle CANCELLATION actions
    IF v_req.request_type = 'cancellation' THEN
        IF p_action = 'approve' THEN
            p_target_status := 'approved';
            v_new_order_status := 'cancelled';
            
            -- Determine refund status for cancelled order
            IF v_order.advance_paid > 0 OR v_order.payment_status = 'paid' THEN
                v_new_payment_status := 'refunded';
            ELSE
                v_new_payment_status := v_order.payment_status;
            END IF;

            UPDATE public.orders
            SET order_status = v_new_order_status,
                payment_status = COALESCE(v_new_payment_status, payment_status),
                updated_at = NOW()
            WHERE id = v_order.id;

        ELSIF p_action = 'reject' THEN
            p_target_status := 'rejected';
            -- Revert order status back to processing/confirmed if it was cancellation_requested
            IF v_order.order_status = 'cancellation_requested' THEN
                UPDATE public.orders
                SET order_status = 'processing',
                    updated_at = NOW()
                WHERE id = v_order.id;
            END IF;
        END IF;

    -- Handle RETURN actions
    ELSIF v_req.request_type = 'return' THEN
        IF p_action = 'approve' THEN
            p_target_status := 'approved';
        ELSIF p_action = 'reject' THEN
            p_target_status := 'rejected';
        ELSIF p_target_status = 'refunded' THEN
            IF v_order.payment_status = 'paid' OR v_order.advance_paid > 0 THEN
                UPDATE public.orders
                SET payment_status = 'refunded',
                    updated_at = NOW()
                WHERE id = v_order.id;
            END IF;
        END IF;
    END IF;

    -- Update order_request record
    UPDATE public.order_requests
    SET status = COALESCE(p_target_status, status),
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        refund_amount = COALESCE(p_refund_amount, refund_amount),
        refund_status = COALESCE(p_refund_status, refund_status),
        processed_at = NOW(),
        processed_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'order_id', v_order.id,
        'status', p_target_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.admin_process_order_request(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

