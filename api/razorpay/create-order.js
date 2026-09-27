/**
 * POST /api/razorpay/create-order
 * Authoritatively calculates order totals from the database and
 * creates a server-side Razorpay Order for either Full Online or Advance Amount.
 */

const { createRazorpayOrder } = require('../_lib/razorpay');
const { calculateTrustedOrder } = require('../_lib/orderCalculator');
const { recordPaymentTransaction } = require('../_lib/supabaseAdmin');

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

    const { items, payment_method, coupon_code, delivery_details, customer } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart items are required.' });
    }

    const normalizedPaymentMethod = (payment_method || 'full_online').toLowerCase().trim();

    // Recalculate trusted order totals and validate stock server-side
    const calculated = await calculateTrustedOrder({
      items,
      paymentMethod: normalizedPaymentMethod,
      couponCode: coupon_code
    });

    // 1. CASH ON DELIVERY (No Razorpay Order Created)
    if (calculated.paymentMethod === 'cod') {
      return res.status(200).json({
        success: true,
        is_cod: true,
        payable_now: 0,
        payable_now_in_paise: 0,
        total_amount: calculated.total,
        advance_amount: 0,
        cod_balance: calculated.total,
        summary: {
          subtotal: calculated.subtotal,
          discount: calculated.discountAmount,
          shipping: calculated.shippingCharge,
          total: calculated.total,
          advance_amount: 0,
          cod_balance: calculated.total,
          payable_now: 0
        }
      });
    }

    // 2. FULL ONLINE OR ADVANCE + COD (Requires Razorpay Order)
    const payableNowPaise = calculated.payableNowInPaise;

    if (payableNowPaise <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Calculated payable online amount is ₹0. Please choose Cash on Delivery.'
      });
    }

    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const isAdvCod = calculated.paymentMethod === 'advance_cod';

    // Create Razorpay Order strictly on server
    const rzpOrder = await createRazorpayOrder({
      amountInPaise: payableNowPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        payment_type: isAdvCod ? 'advance_cod' : 'full_online',
        customer_email: customer?.email || delivery_details?.email || '',
        customer_phone: customer?.phone || delivery_details?.phone || '',
        total_order_amount: calculated.total,
        advance_amount: calculated.advanceAmount,
        cod_balance: calculated.codBalance
      }
    });

    // Record transaction intent in database
    await recordPaymentTransaction({
      transaction_reference: rzpOrder.id,
      merchant_vpa: 'razorpay',
      merchant_name: 'VADI E-Commerce',
      amount: calculated.payableNow,
      currency: 'INR',
      payment_type: isAdvCod ? 'advance' : 'full',
      upi_app: 'Razorpay Gateway',
      status: 'pending',
      items_snapshot: calculated.items,
      delivery_details: delivery_details || {},
      metadata: {
        razorpay_order_id: rzpOrder.id,
        payment_method: calculated.paymentMethod,
        total_order: calculated.total,
        advance_required: isAdvCod,
        advance_amount: calculated.advanceAmount,
        cod_balance: calculated.codBalance
      }
    });

    return res.status(200).json({
      success: true,
      is_cod: false,
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount, // in paise
      amount_in_inr: calculated.payableNow,
      currency: rzpOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      payment_type: isAdvCod ? 'advance_cod' : 'full_online',
      summary: {
        subtotal: calculated.subtotal,
        discount: calculated.discountAmount,
        shipping: calculated.shippingCharge,
        total: calculated.total,
        advance_amount: calculated.advanceAmount,
        cod_balance: calculated.codBalance,
        payable_now: calculated.payableNow,
        items: calculated.items
      }
    });
  } catch (error) {
    console.error('[API create-order] Error:', error);
    const statusCode = error.code === 'OUT_OF_STOCK' ? 409 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to create payment order.',
      code: error.code || 'ORDER_CREATION_FAILED',
      details: error.details || null
    });
  }
};
