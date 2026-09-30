/**
 * POST /api/admin/verify-payment
 * Admin Manual Payment Verification & Rejection Endpoint
 * 
 * 1. Strictly requires authenticated admin access.
 * 2. Admin manually checks real merchant UPI/bank account (vadii@ptaxis).
 * 3. On 'verify':
 *    - For Advance + COD: advance_paid = advance_amount, payment_status = 'verified', order_status = 'confirmed'
 *    - For Full Payment: advance_paid = total, payment_status = 'verified', order_status = 'confirmed'
 *    - Decrements inventory stock authoritatively.
 *    - Stores verified_at and verified_by audit records.
 * 4. On 'reject':
 *    - Sets payment_status = 'rejected', rejection_reason = reason.
 *    - Sets order_status = 'payment_rejected'.
 *    - Leaves order accessible for customer payment retry.
 */

const {
  findOrderByTransactionReference,
  updateOrder,
  updatePaymentTransaction,
  decrementStock,
  supabaseRest,
  getSupabaseConfig
} = require('../_lib/supabaseAdmin');

async function authenticateAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new Error('Authorization required.');
  }

  const { url, key } = getSupabaseConfig();
  // Validate token with Supabase Auth API
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

  // Check admin role in profiles or user metadata
  const isAdminInMeta = (user.user_metadata && user.user_metadata.role === 'admin') ||
                        (user.app_metadata && user.app_metadata.role === 'admin');

  if (isAdminInMeta) {
    return user;
  }

  // Check profiles table
  const profileRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`, {
    token: key
  });

  const profile = Array.isArray(profileRes) && profileRes.length > 0 ? profileRes[0] : null;
  if (!profile || profile.role !== 'admin') {
    throw new Error('Access denied: Administrator privileges required.');
  }

  return user;
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
    // 1. Authenticate caller as Admin
    const adminUser = await authenticateAdmin(req);
    const adminEmail = adminUser.email || adminUser.user_metadata?.email || 'admin@valora.com';

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ success: false, error: 'Malformed JSON payload.' });
      }
    }

    const { order_id, action, rejection_reason } = body || {};

    if (!order_id) {
      return res.status(400).json({ success: false, error: 'Order ID is required.' });
    }

    if (action !== 'verify' && action !== 'reject') {
      return res.status(400).json({ success: false, error: 'Action must be "verify" or "reject".' });
    }

    // 2. Fetch existing order
    const order = await findOrderByTransactionReference(order_id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const nowIso = new Date().toISOString();
    const existingTracking = (order.tracking_data && typeof order.tracking_data === 'object') ? order.tracking_data : {};

    // -------------------------------------------------------------------------
    // ACTION A: VERIFY PAYMENT
    // -------------------------------------------------------------------------
    if (action === 'verify') {
      const isAdvCod = Number(order.advance_amount || 0) > 0;
      const advancePaid = isAdvCod ? Number(order.advance_amount) : Number(order.total);
      const codBal = isAdvCod ? Number(order.cod_balance) : 0;

      const updatedTracking = {
        ...existingTracking,
        payment_verified: true,
        payment_verification_status: 'verified',
        verified_at: nowIso,
        verified_by: adminEmail,
        verification_method: 'manual_bank_ledger',
        merchant_upi_id: 'vadii@ptaxis'
      };

      const updatePayload = {
        order_status: 'confirmed',
        payment_status: 'paid',
        advance_paid: advancePaid,
        advance_payment_status: isAdvCod ? 'paid' : 'not_required',
        cod_payment_status: codBal > 0 ? 'pending' : 'not_applicable',
        verified_at: nowIso,
        verified_by: adminEmail,
        rejection_reason: null,
        tracking_data: updatedTracking
      };

      try {
        await updateOrder(order.id, updatePayload);
      } catch (e) {
        console.warn('[API verify-payment] Column update notice, falling back:', e.message);
        await updateOrder(order.id, {
          order_status: 'confirmed',
          payment_status: 'paid',
          advance_paid: advancePaid,
          advance_payment_status: isAdvCod ? 'paid' : 'not_required',
          cod_payment_status: codBal > 0 ? 'pending' : 'not_applicable',
          tracking_data: updatedTracking
        });
      }

      // Decrement stock upon admin verification
      if (Array.isArray(existingTracking.items_snapshot)) {
        for (const it of existingTracking.items_snapshot) {
          try {
            const prodId = it.product_id || it.sarojini_product_id;
            const isSarojini = it.catalog_type === 'sarojini';
            if (prodId) {
              await decrementStock(prodId, it.quantity || 1, isSarojini);
            }
          } catch (stkErr) {
            console.warn('[API verify-payment] Stock decrement error:', stkErr.message);
          }
        }
      }

      // Update payment_transactions record
      if (order.transaction_reference) {
        try {
          await updatePaymentTransaction(order.transaction_reference, {
            status: 'paid',
            verified_at: nowIso,
            verified_by: adminEmail,
            metadata: {
              ...existingTracking,
              verified_at: nowIso,
              verified_by: adminEmail
            }
          });
        } catch (_) {}
      }

      return res.status(200).json({
        success: true,
        action: 'verified',
        order_id: order.id,
        order_number: order.order_number,
        order_status: 'confirmed',
        payment_status: 'paid',
        payment_verification_status: 'verified',
        advance_paid: advancePaid,
        cod_balance: codBal,
        verified_by: adminEmail,
        verified_at: nowIso,
        message: 'Payment successfully verified against merchant UPI transaction. Order is confirmed.'
      });
    }

    // -------------------------------------------------------------------------
    // ACTION B: REJECT PAYMENT
    // -------------------------------------------------------------------------
    if (action === 'reject') {
      const reason = (rejection_reason && String(rejection_reason).trim()) || 'Payment transaction not found in merchant bank account';

      const updatedTracking = {
        ...existingTracking,
        payment_verified: false,
        payment_verification_status: 'rejected',
        rejection_reason: reason,
        rejected_at: nowIso,
        rejected_by: adminEmail
      };

      const updatePayload = {
        order_status: 'placed',
        payment_status: 'failed',
        rejection_reason: reason,
        verified_at: nowIso,
        verified_by: adminEmail,
        tracking_data: updatedTracking
      };

      try {
        await updateOrder(order.id, updatePayload);
      } catch (e) {
        console.warn('[API verify-payment] Column update notice on reject, falling back:', e.message);
        await updateOrder(order.id, {
          order_status: 'placed',
          payment_status: 'failed',
          tracking_data: updatedTracking
        });
      }

      // Update payment_transactions record
      if (order.transaction_reference) {
        try {
          await updatePaymentTransaction(order.transaction_reference, {
            status: 'failed',
            rejection_reason: reason,
            metadata: {
              ...existingTracking,
              rejection_reason: reason,
              rejected_at: nowIso,
              rejected_by: adminEmail
            }
          });
        } catch (_) {}
      }

      return res.status(200).json({
        success: true,
        action: 'rejected',
        order_id: order.id,
        order_number: order.order_number,
        order_status: 'placed',
        payment_status: 'failed',
        payment_verification_status: 'rejected',
        rejection_reason: reason,
        rejected_by: adminEmail,
        rejected_at: nowIso,
        message: 'Payment verification marked as rejected. Customer can retry payment.'
      });
    }

  } catch (error) {
    console.error('[API verify-payment] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Payment verification processing failed.'
    });
  }
};
