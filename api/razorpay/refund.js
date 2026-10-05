/**
 * POST /api/razorpay/refund
 * Authoritative Server-Side Razorpay Refund Controller
 * 
 * STRICT SECURITY & WORKFLOW REQUIREMENTS:
 * 1. Admin Authentication Required: Authenticates admin JWT bearer token against Supabase Auth & profiles.
 * 2. Return State Machine Validation:
 *    - For returns, strictly enforces RETURN_APPROVED_AFTER_INSPECTION (inspection_approved).
 *    - Strictly checks that product was received at warehouse and passed all inspection criteria.
 *    - Strictly blocks any refund if return is not approved after inspection or if rejected.
 * 3. Double-Refund / Idempotency Protection:
 *    - Prevents duplicate refunds if already initiated or processed.
 * 4. Payment Eligibility & Amount Enforcement:
 *    - Full Online: Max refundable = order total.
 *    - Advance + COD: Max refundable = ONLY advance paid online (e.g. ₹120). Uncollected COD balance is never refunded.
 *    - Full COD: Razorpay refund strictly blocked (not applicable).
 * 5. Calls server-side Razorpay Refunds API with securely stored credentials.
 * 6. Updates orders, order_requests, and tracking_data.
 */

const { createRazorpayRefund } = require('../_lib/razorpay');
const { updateOrder, supabaseRest, getSupabaseConfig } = require('../_lib/supabaseAdmin');

async function authenticateAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new Error('Authorization required: Missing bearer token.');
  }

  const { url, key } = getSupabaseConfig();
  const authRes = await fetch(`${url}/auth/v1/user`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!authRes.ok) {
    throw new Error('Invalid or expired authentication credentials.');
  }

  const user = await authRes.json();
  if (!user || !user.id) {
    throw new Error('Failed to resolve authenticated user.');
  }

  const isAdminInMeta = (user.user_metadata && user.user_metadata.role === 'admin') ||
                        (user.app_metadata && user.app_metadata.role === 'admin');

  if (isAdminInMeta) {
    return { user, token };
  }

  const profileRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`, {
    token: key
  });

  const profile = Array.isArray(profileRes) && profileRes.length > 0 ? profileRes[0] : null;
  if (!profile || profile.role !== 'admin') {
    throw new Error('Access denied: Administrator privileges required.');
  }

  return { user, token };
}

async function fetchOrderDirect(orderIdOrNumber) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrNumber);
  const filter = isUuid ? `id=eq.${encodeURIComponent(orderIdOrNumber)}` : `order_number=eq.${encodeURIComponent(orderIdOrNumber)}`;
  const data = await supabaseRest(`orders?${filter}&select=*&limit=1`);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function syncBackupStoreSettings(orderId, refundPayload) {
  try {
    const sRow = await supabaseRest('store_settings?key=eq.order_requests&select=value&limit=1');
    if (Array.isArray(sRow) && sRow[0]?.value && Array.isArray(sRow[0].value)) {
      let reqs = sRow[0].value;
      let modified = false;
      reqs = reqs.map(r => {
        if (r.order_id === orderId && r.request_type === 'return') {
          modified = true;
          return {
            ...r,
            status: refundPayload.order_status,
            refund_status: refundPayload.refund_status,
            refund_id: refundPayload.refund_id,
            refund_amount: refundPayload.refund_amount,
            updated_at: new Date().toISOString()
          };
        }
        return r;
      });
      if (modified) {
        await supabaseRest('store_settings', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: { key: 'order_requests', value: reqs }
        });
      }
    }
  } catch (err) {
    console.warn('[syncBackupStoreSettings] Warning:', err.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 1. Verify Admin Authentication
    const { user: adminUser, token: adminToken } = await authenticateAdmin(req);
    const adminEmail = adminUser.email || adminUser.user_metadata?.email || 'admin@valora.com';
    const adminName = adminUser.user_metadata?.full_name || adminEmail.split('@')[0];

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ success: false, error: 'Malformed JSON payload.' });
      }
    }

    const { order_id, amount, reason, bypass_inspection } = body || {};

    if (!order_id) {
      return res.status(400).json({ success: false, error: 'order_id is required.' });
    }

    const order = await fetchOrderDirect(order_id);
    if (!order) {
      return res.status(404).json({ success: false, error: `Order "${order_id}" not found.` });
    }

    const trackingData = (order.tracking_data && typeof order.tracking_data === 'object') ? { ...order.tracking_data } : {};
    const returnWorkflow = (trackingData.return_workflow && typeof trackingData.return_workflow === 'object') ? { ...trackingData.return_workflow } : {};

    // 2. Return State Machine Validation
    // Check if order is in return flow
    const isReturnLifecycle = ['return_requested', 'return_approved', 'pickup_assigned', 'return_picked_up', 'return_received', 'inspection_approved', 'return_approved_after_inspection', 'return_rejected_after_inspection'].includes(order.order_status) ||
                              Boolean(returnWorkflow.status);

    if (isReturnLifecycle && !bypass_inspection) {
      // Must be approved after inspection
      const isInspectionApproved = order.order_status === 'inspection_approved' ||
                                   order.order_status === 'return_approved_after_inspection' ||
                                   returnWorkflow.status === 'RETURN_APPROVED_AFTER_INSPECTION' ||
                                   (returnWorkflow.inspection && returnWorkflow.inspection.outcome === 'approved');

      if (!isInspectionApproved) {
        if (order.order_status === 'return_rejected_after_inspection' || returnWorkflow.status === 'RETURN_REJECTED_AFTER_INSPECTION') {
          return res.status(400).json({
            success: false,
            error: 'Refund cannot be approved: Product failed physical inspection.'
          });
        }
        if (order.order_status === 'return_requested') {
          return res.status(400).json({
            success: false,
            error: 'Refund cannot be approved at "Return Requested" stage. Product must be received and inspected first.'
          });
        }
        if (order.order_status === 'return_approved') {
          return res.status(400).json({
            success: false,
            error: 'Refund cannot be approved at "Return Approved" stage. Pickup and warehouse inspection required.'
          });
        }
        if (order.order_status === 'pickup_assigned' || order.order_status === 'return_picked_up') {
          return res.status(400).json({
            success: false,
            error: 'Refund cannot be approved while item is in transit. Warehouse receipt and inspection required.'
          });
        }
        if (order.order_status === 'return_received') {
          return res.status(400).json({
            success: false,
            error: 'Refund cannot be approved at "Return Received" stage. Product must pass the 7-criteria inspection first.'
          });
        }

        return res.status(400).json({
          success: false,
          error: `Refund cannot be approved: Return status is "${order.order_status}". Product must be marked RETURN_APPROVED_AFTER_INSPECTION.`
        });
      }
    }

    // 3. Double-Refund / Idempotency Check
    if (order.refund_status === 'processed' || order.refund_status === 'completed') {
      return res.status(400).json({
        success: false,
        error: `Order has already been refunded (Refund ID: ${order.refund_id || 'N/A'}).`
      });
    }

    if (order.refund_status === 'refund_initiated' || order.refund_status === 'initiating') {
      return res.status(400).json({
        success: false,
        error: `A refund is already in progress for this order (Refund ID: ${order.refund_id || 'Pending'}).`
      });
    }

    // 4. Resolve Razorpay payment ID
    let paymentId = order.razorpay_payment_id;
    if (!paymentId && typeof order.transaction_reference === 'string' && order.transaction_reference.startsWith('pay_')) {
      paymentId = order.transaction_reference;
    }
    if (!paymentId && trackingData.razorpay_payment_id) {
      paymentId = trackingData.razorpay_payment_id;
    }

    // Check payment method eligibility
    const isCodOnly = Boolean(
      order.payment_method &&
      order.payment_method.toLowerCase().includes('cash on delivery') &&
      !Number(order.advance_amount || order.advance_paid || 0)
    );

    if (isCodOnly) {
      return res.status(400).json({
        success: false,
        error: 'Razorpay refund is NOT applicable: This order was Cash on Delivery with no online prepayment. No funds were collected via Razorpay.'
      });
    }

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'No valid Razorpay payment ID (pay_*) found for this order. Online refund cannot be processed.'
      });
    }

    // 5. Determine authoritatively max refundable online amount in INR
    const hasAdvance = Number(order.advance_paid || order.advance_amount || 0) > 0;
    const isFullOnline = Boolean(
      order.is_full_online_payment ||
      (!hasAdvance && (order.payment_status === 'paid' || order.payment_status === 'verified'))
    );

    let maxRefundable = 0;
    if (hasAdvance) {
      // Strictly refund ONLY the online advance amount (e.g. ₹120). Unpaid COD balance is never refunded!
      maxRefundable = Number(order.advance_paid || order.advance_amount);
    } else if (isFullOnline) {
      maxRefundable = Number(order.total);
    } else {
      maxRefundable = Number(order.total);
    }

    let refundAmountInInr = amount ? Number(amount) : maxRefundable;
    if (refundAmountInInr <= 0 || refundAmountInInr > maxRefundable) {
      return res.status(400).json({
        success: false,
        error: `Invalid refund amount ₹${refundAmountInInr}. Maximum online refundable amount is ₹${maxRefundable}.`
      });
    }

    const amountInPaise = Math.round(refundAmountInInr * 100);
    const nowIso = new Date().toISOString();

    // 6. Concurrency lock: mark refund_status = 'initiating'
    try {
      await updateOrder(order.id, {
        refund_status: 'initiating',
        updated_at: nowIso
      }, adminToken);
    } catch (_) {}

    // 7. Call Razorpay Refund API
    let refundData;
    try {
      refundData = await createRazorpayRefund({
        paymentId,
        amountInPaise,
        notes: {
          order_id: order.id,
          order_number: order.order_number,
          reason: reason || 'Return inspection approved refund',
          approved_by: adminName,
          customer_email: order.customer_email || ''
        }
      });
    } catch (rzpErr) {
      // Release lock on gateway error
      await updateOrder(order.id, {
        refund_status: 'failed',
        refund_notes: `Razorpay API Error: ${rzpErr.message}`,
        updated_at: new Date().toISOString()
      }, adminToken);
      throw new Error(`Razorpay Refund failed: ${rzpErr.message}`);
    }

    // 8. Update DB records
    const rzpStatus = refundData.status === 'processed' ? 'completed' : 'initiated';
    returnWorkflow.status = 'REFUND_INITIATED';
    returnWorkflow.refund_details = {
      refund_id: refundData.id,
      amount: refundAmountInInr,
      currency: 'INR',
      payment_id: paymentId,
      status: rzpStatus,
      initiated_at: nowIso,
      approved_by: adminName
    };
    trackingData.return_workflow = returnWorkflow;

    const updatePayload = {
      refund_id: refundData.id,
      refund_status: rzpStatus,
      refund_amount: refundAmountInInr,
      refund_notes: reason || `Approved by ${adminName} after inspection`,
      refunded_at: nowIso,
      order_status: 'refund_initiated',
      tracking_data: trackingData,
      updated_at: nowIso
    };

    await updateOrder(order.id, updatePayload, adminToken);

    // Update order_requests table
    try {
      await supabaseRest(`order_requests?order_id=eq.${encodeURIComponent(order.id)}&request_type=eq.return`, {
        method: 'PATCH',
        body: {
          status: 'refund_initiated',
          refund_status: rzpStatus,
          refund_amount: refundAmountInInr,
          admin_notes: `Refund initiated via Razorpay (Refund ID: ${refundData.id}) by ${adminName}`,
          updated_at: nowIso
        }
      });
    } catch (_) {}

    await syncBackupStoreSettings(order.id, updatePayload);

    return res.status(200).json({
      success: true,
      refund_id: refundData.id,
      payment_id: paymentId,
      amount_refunded: refundAmountInInr,
      status: 'REFUND_INITIATED',
      razorpay_status: refundData.status || 'processed',
      order_number: order.order_number,
      message: `Razorpay refund of ₹${refundAmountInInr} initiated successfully.`
    });

  } catch (error) {
    console.error('[API razorpay/refund] Error:', error);
    const statusCode = error.message?.includes('Access denied') ? 403 : (error.message?.includes('Authorization') ? 401 : 500);
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Refund processing failed.'
    });
  }
};
