/**
 * POST /api/verify-payment
 * Standard Razorpay Web Checkout Verification Endpoint.
 *
 * Verifies:
 * - HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * - Timing-safe comparison with razorpay_signature
 * - Returns 400 if signature mismatch or missing fields
 * - If order details are provided, fulfills order and records into Supabase
 */

const crypto = require('crypto');
const { calculateTrustedOrder } = require('./_lib/orderCalculator');
const {
  insertOrder,
  insertOrderItems,
  decrementStock,
  findOrderByRazorpayPaymentId,
  updatePaymentTransaction
} = require('./_lib/supabaseAdmin');

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

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,
      payment_id,
      signature,
      payment_method,
      items,
      coupon_code,
      delivery_details,
      delivery_preference,
      free_gifts_items,
      user_id
    } = body || {};

    const resolvedOrderId = razorpay_order_id || order_id;
    const resolvedPaymentId = razorpay_payment_id || payment_id;
    const resolvedSignature = razorpay_signature || signature;
    const normalizedPaymentMethod = (payment_method || 'full_online').toLowerCase().trim();
    const isOnline = normalizedPaymentMethod === 'full_online' || normalizedPaymentMethod === 'advance_cod';

    // 1. Signature Verification for Online Payments
    if (isOnline || resolvedPaymentId || resolvedSignature) {
      if (!resolvedOrderId || !resolvedPaymentId || !resolvedSignature) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: order_id, payment_id, and signature are required.'
        });
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return res.status(500).json({
          success: false,
          error: 'RAZORPAY_KEY_SECRET is not configured on the server.'
        });
      }

      // Compute HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${resolvedOrderId}|${resolvedPaymentId}`)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(String(resolvedSignature).trim(), 'utf8');

      const isSignatureValid = expectedBuf.length === actualBuf.length &&
        crypto.timingSafeEqual(expectedBuf, actualBuf);

      if (!isSignatureValid) {
        console.warn(`[API verify-payment] Signature mismatch for order: ${resolvedOrderId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid payment signature. Verification failed.'
        });
      }
    }

    // If pure standalone verification (no cart items attached)
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully.',
        order_id: resolvedOrderId,
        payment_id: resolvedPaymentId
      });
    }

    // 2. Check Idempotency (prevent duplicate store order creation on double-submit)
    if (resolvedPaymentId) {
      const existingOrderByPayment = await findOrderByRazorpayPaymentId(resolvedPaymentId);
      if (existingOrderByPayment) {
        console.log(`[API verify-payment] Order already processed for payment ${resolvedPaymentId}. Returning existing.`);
        return res.status(200).json({
          success: true,
          is_duplicate: true,
          order_id: existingOrderByPayment.id,
          order_number: existingOrderByPayment.order_number,
          total: existingOrderByPayment.total,
          advance_paid: existingOrderByPayment.advance_paid,
          cod_balance: existingOrderByPayment.cod_balance
        });
      }
    }

    // 3. Recalculate trusted order totals from Supabase catalog
    const calculated = await calculateTrustedOrder({
      items,
      paymentMethod: normalizedPaymentMethod,
      couponCode: coupon_code
    });

    let paymentDetail = '';
    let advanceAmount = 0;
    let advancePaid = 0;
    let codBalance = 0;
    let paymentStatus = 'pending';
    let advancePaymentStatus = 'not_required';
    let codPaymentStatus = 'not_applicable';
    let isFullOnline = false;

    if (calculated.paymentMethod === 'full_online') {
      isFullOnline = true;
      advanceAmount = 0;
      advancePaid = calculated.total;
      codBalance = 0;
      paymentStatus = 'paid';
      advancePaymentStatus = 'not_required';
      codPaymentStatus = 'not_applicable';
      paymentDetail = `Razorpay Online Payment (Full Paid: ₹${calculated.total})`;
    } else if (calculated.paymentMethod === 'advance_cod') {
      isFullOnline = false;
      advanceAmount = calculated.advanceAmount;
      advancePaid = calculated.advanceAmount;
      codBalance = calculated.codBalance;
      paymentStatus = 'pending';
      advancePaymentStatus = 'paid';
      codPaymentStatus = codBalance > 0 ? 'pending' : 'not_applicable';
      paymentDetail = `Razorpay Advance (₹${advancePaid} Paid) + COD Balance (₹${codBalance})`;
    } else {
      isFullOnline = false;
      advanceAmount = 0;
      advancePaid = 0;
      codBalance = calculated.total;
      paymentStatus = 'pending';
      advancePaymentStatus = 'not_required';
      codPaymentStatus = 'pending';
      paymentDetail = 'Cash on Delivery';
    }

    const freeGiftsEligible = Boolean(isFullOnline && Array.isArray(free_gifts_items) && free_gifts_items.length > 0);
    const resolvedGifts = freeGiftsEligible ? free_gifts_items : [];

    // 4. Decrement Stock
    for (const item of calculated.items) {
      try {
        const prodId = item.product_id || item.sarojini_product_id;
        const isSarojini = item.catalog_type === 'sarojini';
        if (prodId) {
          await decrementStock(prodId, item.quantity, isSarojini);
        }
      } catch (stkErr) {
        console.warn(`[API verify-payment] Stock decrement notice for item ${item.product_name}:`, stkErr.message);
      }
    }

    // 5. Create Order Record
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `#VEL-${randomSuffix}`;

    const now = new Date();
    const deliveryStart = new Date(now);
    deliveryStart.setDate(now.getDate() + 3);
    const deliveryEnd = new Date(now);
    deliveryEnd.setDate(now.getDate() + 5);
    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const etaFormatted = `${deliveryStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - ${deliveryEnd.toLocaleDateString('en-IN', dateOptions)}`;

    const delivery = delivery_details || {};
    const streetAddress = [
      delivery.house,
      delivery.street,
      delivery.landmark
    ].filter(Boolean).join(', ') || delivery.address || '';
    const normalizedCustomerEmail = delivery.email ? String(delivery.email).trim().toLowerCase() : null;

    const basePayload = {
      user_id: user_id || null,
      customer_email: normalizedCustomerEmail,
      order_number: orderNumber,
      subtotal: calculated.subtotal,
      discount: calculated.discountAmount,
      shipping_charge: calculated.shippingCharge || 0,
      tax: 0,
      total: calculated.total,
      payment_method: paymentDetail,
      payment_status: paymentStatus,
      advance_amount: advanceAmount,
      advance_paid: advancePaid,
      cod_balance: codBalance,
      advance_payment_status: advancePaymentStatus,
      cod_payment_status: codPaymentStatus,
      order_status: 'placed',
      delivery_full_name: delivery.fullName || delivery.full_name || '',
      delivery_phone: delivery.phone || '',
      delivery_address: streetAddress,
      delivery_city: delivery.city || '',
      delivery_state: delivery.state || '',
      delivery_country: delivery.country || 'India',
      delivery_pincode: delivery.zip || delivery.pincode || '',
      estimated_delivery: etaFormatted,
      transaction_reference: resolvedPaymentId || `COD-${Date.now()}`,
      coupon_code: coupon_code || null,
      delivery_preference: delivery_preference || 'Simple Delivery',
      free_gifts_eligible: freeGiftsEligible,
      free_gifts_items: resolvedGifts,
      is_full_online_payment: isFullOnline,
      idempotency_key: resolvedPaymentId ? `rzp_${resolvedPaymentId}` : `cod_${Date.now()}_${randomSuffix}`,
      tracking_data: {
        razorpay_order_id: resolvedOrderId || null,
        razorpay_payment_id: resolvedPaymentId || null,
        razorpay_signature: resolvedSignature || null,
        payment_gateway: isOnline ? 'razorpay' : 'cod',
        customer_email: normalizedCustomerEmail,
        address_type: delivery.addressType || 'Home',
        items_snapshot: calculated.items
      }
    };

    let createdOrder = null;
    try {
      createdOrder = await insertOrder({
        ...basePayload,
        razorpay_order_id: resolvedOrderId || null,
        razorpay_payment_id: resolvedPaymentId || null,
        razorpay_signature: resolvedSignature || null,
        payment_gateway: isOnline ? 'razorpay' : 'cod'
      });
    } catch (_) {
      createdOrder = await insertOrder(basePayload);
    }

    if (!createdOrder || !createdOrder.id) {
      throw new Error('Failed to create order record in database.');
    }

    // 6. Record items
    const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
    const itemsPayload = calculated.items.map(item => {
      const price = Number(item.price !== undefined ? item.price : item.unit_price) || 0;
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (price * qty)) || 0;
      const advAmt = Number(item.line_advance !== undefined ? item.line_advance : (item.advance_amount || 0)) || 0;
      const codBal = Number(item.line_cod_balance !== undefined ? item.line_cod_balance : (item.cod_balance || 0)) || 0;

      return {
        order_id: createdOrder.id,
        product_id: isValidUUID(item.product_id) ? item.product_id : null,
        sarojini_product_id: isValidUUID(item.sarojini_product_id) ? item.sarojini_product_id : null,
        catalog_type: item.catalog_type || (item.sarojini_product_id ? 'sarojini' : 'main'),
        product_name: String(item.product_name || 'Product'),
        product_image: item.product_image || null,
        quantity: qty,
        price: price,
        subtotal: subtotal,
        selected_size: item.selected_size || null,
        selected_color: item.selected_color || null,
        advance_amount: advAmt,
        cod_balance: codBal
      };
    });

    try {
      await insertOrderItems(itemsPayload);
    } catch (itErr) {
      console.warn('[API verify-payment] Primary items insert fell back to core columns:', itErr.message);
      const corePayload = itemsPayload.map(item => ({
        order_id: item.order_id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        selected_size: item.selected_size,
        selected_color: item.selected_color
      }));
      await insertOrderItems(corePayload);
    }

    if (resolvedOrderId) {
      try {
        await updatePaymentTransaction(resolvedOrderId, {
          status: 'success',
          order_id: createdOrder.id,
          metadata: {
            order_number: createdOrder.order_number || orderNumber,
            razorpay_payment_id: resolvedPaymentId,
            razorpay_signature: resolvedSignature
          }
        });
      } catch (_) {}
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and order placed successfully.',
      order_id: createdOrder.id,
      order_number: createdOrder.order_number || orderNumber,
      total: calculated.total,
      advance_paid: advancePaid,
      cod_balance: codBalance,
      payment_method: calculated.paymentMethod,
      is_full_online_payment: isFullOnline
    });

  } catch (error) {
    console.error('[API verify-payment] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Payment verification failed.'
    });
  }
};
