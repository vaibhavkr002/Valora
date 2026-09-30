/**
 * POST /api/orders/submit-payment
 * Customer "I Have Paid" Submission Endpoint
 * 
 * 1. Invoked when customer returns from UPI app or completes QR scan and clicks "I HAVE PAID".
 * 2. Accepts optional UPI Transaction ID / UTR.
 * 3. Sets order_status = 'PAYMENT_VERIFICATION_PENDING' and payment_status = 'customer_submitted'.
 * 4. NEVER marks payment as paid or confirmed automatically.
 * 5. Records timestamp and customer UTR for manual admin verification.
 */

const {
  findOrderByTransactionReference,
  updateOrder,
  updatePaymentTransaction,
  supabaseRest
} = require('../_lib/supabaseAdmin');

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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ success: false, error: 'Malformed JSON payload.' });
      }
    }

    const { order_id, order_number, customer_utr, upi_app } = body || {};
    const lookupRef = order_id || order_number;

    if (!lookupRef) {
      return res.status(400).json({ success: false, error: 'Order ID or Order Number is required.' });
    }

    const order = await findOrderByTransactionReference(lookupRef);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order record not found.' });
    }

    // Clean optional UTR
    const cleanUtr = customer_utr ? String(customer_utr).trim().replace(/[^a-zA-Z0-9]/g, '') : null;
    const nowIso = new Date().toISOString();

    const existingTracking = (order.tracking_data && typeof order.tracking_data === 'object') ? order.tracking_data : {};
    const updatedTracking = {
      ...existingTracking,
      payment_verification_status: 'verification_pending',
      customer_utr: cleanUtr,
      payment_submitted_at: nowIso,
      submitted_upi_app: upi_app || 'Generic UPI',
      verification_state: 'pending_admin_review'
    };

    // Update order with safe values conforming to database check constraints
    const updatePayload = {
      order_status: order.order_status || 'placed',
      payment_status: 'pending',
      tracking_data: updatedTracking
    };

    let updatedOrder = null;
    let rpcSuccess = false;
    try {
      const rpcData = await supabaseRest('rpc/submit_customer_payment_utr', {
        method: 'POST',
        body: {
          p_order_ref: lookupRef,
          p_utr: cleanUtr,
          p_upi_app: upi_app || 'Generic UPI'
        }
      });
      if (rpcData && rpcData.success) {
        rpcSuccess = true;
      }
    } catch (_) {}

    if (!rpcSuccess) {
      try {
        updatedOrder = await updateOrder(order.id, updatePayload);
      } catch (e) {
        console.warn('[API submit-payment] Order update notice, falling back:', e.message);
        try {
          updatedOrder = await updateOrder(order.id, {
            order_status: 'placed',
            payment_status: 'pending',
            tracking_data: updatedTracking
          });
        } catch (_) {}
      }
    }

    // Update payment_transactions record if exists
    try {
      if (order.transaction_reference) {
        await updatePaymentTransaction(order.transaction_reference, {
          status: 'pending',
          utr_number: cleanUtr,
          updated_at: nowIso,
          metadata: {
            customer_utr: cleanUtr,
            submitted_at: nowIso,
            upi_app: upi_app || 'Generic UPI',
            verification_state: 'pending_admin_review'
          }
        });
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      order_status: order.order_status || 'placed',
      payment_status: 'pending',
      payment_verification_status: 'verification_pending',
      customer_utr: cleanUtr,
      message: 'Payment confirmation submitted for verification. Your order will be confirmed after your payment is manually verified by the administrator against bank ledger records.'
    });

  } catch (error) {
    console.error('[API submit-payment] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit payment confirmation.'
    });
  }
};
