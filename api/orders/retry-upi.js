/**
 * POST /api/orders/retry-upi
 * Customer Payment Retry Endpoint
 * 
 * Generates a fresh UPI payment intent for an existing pending or rejected order.
 * Strictly prevents creating duplicate orders.
 */

const {
  findOrderByTransactionReference,
  recordPaymentTransaction,
  updateOrder
} = require('../_lib/supabaseAdmin');

const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || 'vadii@ptaxis';
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'VALORA';

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

    const { order_id, order_number } = body || {};
    const ref = order_id || order_number;

    if (!ref) {
      return res.status(400).json({ success: false, error: 'Order reference is required.' });
    }

    const order = await findOrderByTransactionReference(ref);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const isAdvCod = Number(order.advance_amount || 0) > 0;
    const payableAmount = isAdvCod ? Number(order.advance_amount) : Number(order.total);
    const amtStr = payableAmount.toFixed(2);
    const noteStr = encodeURIComponent(`Order ${order.order_number}`);

    const upiUri = `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amtStr}&cu=INR&tn=${noteStr}`;
    const newAttemptRef = `VADI-RETRY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Reset status back to PAYMENT_PENDING
    const existingTracking = (order.tracking_data && typeof order.tracking_data === 'object') ? order.tracking_data : {};
    const attempts = Array.isArray(existingTracking.payment_attempts) ? existingTracking.payment_attempts : [];
    attempts.push({
      attempt_ref: newAttemptRef,
      created_at: new Date().toISOString(),
      amount: payableAmount
    });

    const updatedTracking = {
      ...existingTracking,
      payment_attempts: attempts,
      payment_verification_status: 'pending',
      last_retry_at: new Date().toISOString()
    };

    try {
      await updateOrder(order.id, {
        order_status: 'placed',
        payment_status: 'pending',
        tracking_data: updatedTracking
      });
    } catch (_) {}

    // Record new attempt in payment_transactions
    await recordPaymentTransaction({
      transaction_reference: newAttemptRef,
      order_id: order.id,
      order_number: order.order_number,
      customer_phone: order.delivery_phone || '',
      customer_email: order.customer_email || '',
      merchant_vpa: MERCHANT_UPI_ID,
      merchant_name: MERCHANT_NAME,
      amount: payableAmount,
      currency: 'INR',
      payment_type: isAdvCod ? 'advance' : 'full',
      upi_app: 'Direct UPI (Retry)',
      status: 'pending',
      upi_uri: upiUri,
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        is_retry: true,
        attempt_ref: newAttemptRef
      }
    });

    return res.status(200).json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      payable_now: payableAmount,
      advance_amount: Number(order.advance_amount || 0),
      cod_balance: Number(order.cod_balance || 0),
      total: Number(order.total),
      upi_uri: upiUri,
      merchant_upi_id: MERCHANT_UPI_ID,
      merchant_name: MERCHANT_NAME,
      payment_method: order.payment_method,
      attempt_reference: newAttemptRef
    });

  } catch (error) {
    console.error('[API retry-upi] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate retry payment.'
    });
  }
};
