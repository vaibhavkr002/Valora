/**
 * POST /api/create-order
 * Standard Razorpay Web Checkout Order Creation Endpoint.
 * Supports:
 * 1. Standard amount-based creation: { amount (in paise), currency, receipt }
 * 2. VALORA full cart order creation: { items, payment_method, coupon_code, delivery_details, customer }
 */

const Razorpay = require('razorpay');
const { calculateTrustedOrder } = require('./_lib/orderCalculator');
const { recordPaymentTransaction } = require('./_lib/supabaseAdmin');

function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    const err = new Error('Razorpay credentials are not configured on the server.');
    err.statusCode = 500;
    throw err;
  }

  return new Razorpay({ key_id, key_secret });
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

    const { amount, currency = 'INR', receipt, items, payment_method, coupon_code, delivery_details, customer, notes } = body || {};

    const rzp = getRazorpayInstance();

    // 1. Direct amount-based order creation (Standard Web Checkout contract)
    if (amount !== undefined && amount !== null && !items) {
      const parsedAmount = Number(amount);

      // Validate amount >= 100 paise (Razorpay minimum ₹1.00)
      if (isNaN(parsedAmount) || parsedAmount < 100) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be at least 100 paise (₹1.00).'
        });
      }

      const receiptId = (receipt || `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`).slice(0, 40);

      try {
        const order = await rzp.orders.create({
          amount: Math.round(parsedAmount),
          currency: (currency || 'INR').toUpperCase(),
          receipt: receiptId,
          notes: {
            platform: 'VALORA E-Commerce',
            ...(notes || {})
          }
        });

        return res.status(200).json({
          success: true,
          order_id: order.id,
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: process.env.RAZORPAY_KEY_ID
        });
      } catch (rzpErr) {
        console.error('[API create-order] Razorpay API Error:', rzpErr);
        const status = rzpErr.statusCode === 401 ? 401 : 500;
        return res.status(status).json({
          success: false,
          error: rzpErr.error?.description || rzpErr.message || 'Razorpay order creation failed.'
        });
      }
    }

    // 2. Cart-based order calculation (Full Store Checkout flow)
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Either amount (>= 100 paise) or cart items are required.'
      });
    }

    const normalizedPaymentMethod = (payment_method || 'full_online').toLowerCase().trim();

    const calculated = await calculateTrustedOrder({
      items,
      paymentMethod: normalizedPaymentMethod,
      couponCode: coupon_code
    });

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

    const payableNowPaise = calculated.payableNowInPaise;
    if (payableNowPaise < 100) {
      return res.status(400).json({
        success: false,
        error: 'Calculated payable amount must be at least ₹1.00 (100 paise). Please choose Cash on Delivery.'
      });
    }

    const receiptId = (receipt || `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`).slice(0, 40);
    const isAdvCod = calculated.paymentMethod === 'advance_cod';

    let rzpOrder;
    try {
      rzpOrder = await rzp.orders.create({
        amount: payableNowPaise,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          payment_type: isAdvCod ? 'advance_cod' : 'full_online',
          customer_email: customer?.email || delivery_details?.email || '',
          customer_phone: customer?.phone || delivery_details?.phone || '',
          total_order_amount: calculated.total,
          advance_amount: calculated.advanceAmount,
          cod_balance: calculated.codBalance,
          platform: 'VALORA E-Commerce'
        }
      });
    } catch (rzpErr) {
      console.error('[API create-order] Razorpay Cart Order Error:', rzpErr);
      const status = rzpErr.statusCode === 401 ? 401 : 500;
      return res.status(status).json({
        success: false,
        error: rzpErr.error?.description || rzpErr.message || 'Razorpay order creation failed.'
      });
    }

    // Record transaction intent
    try {
      await recordPaymentTransaction({
        transaction_reference: rzpOrder.id,
        merchant_vpa: 'razorpay',
        merchant_name: 'VALORA E-Commerce',
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
    } catch (txErr) {
      console.warn('[API create-order] Transaction logging notice:', txErr.message);
    }

    return res.status(200).json({
      success: true,
      is_cod: false,
      order_id: rzpOrder.id,
      razorpay_order_id: rzpOrder.id,
      id: rzpOrder.id,
      amount: rzpOrder.amount,
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
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to create payment order.'
    });
  }
};
