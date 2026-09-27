/**
 * POST /api/razorpay/refund
 * Initiates Razorpay Refund for an online-paid order (Full Online or Advance COD).
 * Strictly server-side; calls Razorpay Refunds API and updates Supabase orders.
 */

const { createRazorpayRefund } = require('../_lib/razorpay');
const { updateOrder, supabaseRest } = require('../_lib/supabaseAdmin');

async function fetchOrderDirect(orderIdOrNumber) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrNumber);
  const filter = isUuid ? `id=eq.${encodeURIComponent(orderIdOrNumber)}` : `order_number=eq.${encodeURIComponent(orderIdOrNumber)}`;
  const data = await supabaseRest(`orders?${filter}&select=*&limit=1`);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    const { order_id, amount, reason } = body || {};

    if (!order_id) {
      return res.status(400).json({ success: false, error: 'order_id is required.' });
    }

    const order = await fetchOrderDirect(order_id);
    if (!order) {
      return res.status(404).json({ success: false, error: `Order "${order_id}" not found.` });
    }

    // Resolve Razorpay payment ID
    let paymentId = order.razorpay_payment_id;
    if (!paymentId && typeof order.transaction_reference === 'string' && order.transaction_reference.startsWith('pay_')) {
      paymentId = order.transaction_reference;
    }
    if (!paymentId && order.tracking_data && typeof order.tracking_data === 'object') {
      paymentId = order.tracking_data.razorpay_payment_id;
    }

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'This order does not have an associated Razorpay online payment (or was purely COD).'
      });
    }

    // Check if already fully refunded
    if (order.refund_status === 'processed') {
      return res.status(400).json({
        success: false,
        error: `Order has already been refunded (Refund ID: ${order.refund_id || 'N/A'}).`
      });
    }

    // Determine max refundable online amount in INR
    const maxRefundable = order.is_full_online_payment || order.advance_amount === 0
      ? Number(order.total)
      : Number(order.advance_paid || order.advance_amount);

    let refundAmountInInr = amount ? Number(amount) : maxRefundable;
    if (refundAmountInInr <= 0 || refundAmountInInr > maxRefundable) {
      return res.status(400).json({
        success: false,
        error: `Invalid refund amount ₹${refundAmountInInr}. Maximum online refundable amount is ₹${maxRefundable}.`
      });
    }

    const amountInPaise = Math.round(refundAmountInInr * 100);

    // Call Razorpay Refund API
    const refundData = await createRazorpayRefund({
      paymentId,
      amountInPaise,
      notes: {
        order_id: order.id,
        order_number: order.order_number,
        reason: reason || 'Customer cancellation / return'
      }
    });

    // Update order in Supabase
    const updatePayload = {
      refund_id: refundData.id,
      refund_status: 'processed',
      refund_amount: refundAmountInInr,
      refund_notes: reason || 'Processed via Admin Panel',
      refunded_at: new Date().toISOString(),
      order_status: order.order_status === 'delivered' ? 'returned' : 'cancelled'
    };

    try {
      await updateOrder(order.id, updatePayload);
    } catch (uErr) {
      console.warn('[API refund] Supabase update warning:', uErr.message);
    }

    return res.status(200).json({
      success: true,
      refund_id: refundData.id,
      payment_id: paymentId,
      amount_refunded: refundAmountInInr,
      status: refundData.status || 'processed',
      order_number: order.order_number
    });
  } catch (error) {
    console.error('[API refund] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Refund processing failed.'
    });
  }
};
