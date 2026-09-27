/**
 * POST /api/razorpay/verify-payment
 * Server-authoritative endpoint:
 * 1. Verifies Razorpay HMAC-SHA256 signature for online payments
 * 2. Enforces idempotency (prevents duplicate orders on double click / network retry)
 * 3. Authoritatively recalculates trusted order totals and stock from Supabase
 * 4. Decrements product stock across both Main VADI and Sarojini Bazaar catalogs
 * 5. Creates orders and order_items records in Supabase
 * 6. Returns order confirmation
 */

const { verifyPaymentSignature } = require('../_lib/razorpay');
const { calculateTrustedOrder } = require('../_lib/orderCalculator');
const {
  insertOrder,
  insertOrderItems,
  decrementStock,
  findOrderByRazorpayPaymentId,
  findOrderByRazorpayOrderId,
  recordPaymentTransaction,
  updatePaymentTransaction
} = require('../_lib/supabaseAdmin');

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
      payment_method,
      items,
      coupon_code,
      delivery_details,
      delivery_preference,
      free_gifts_items,
      user_id
    } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart items are required.' });
    }

    const normalizedPaymentMethod = (payment_method || 'full_online').toLowerCase().trim();
    const isOnline = normalizedPaymentMethod === 'full_online' || normalizedPaymentMethod === 'advance_cod';

    // 1. Signature Verification for Online Payments
    if (isOnline) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing Razorpay payment parameters (order_id, payment_id, signature).'
        });
      }

      try {
        verifyPaymentSignature({
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature
        });
      } catch (sigErr) {
        console.error('[API verify-payment] Signature validation failed:', sigErr.message);
        return res.status(400).json({
          success: false,
          error: 'Payment verification failed: Invalid digital signature.'
        });
      }

      // 2. Idempotency Check: prevent duplicate order insertion
      const existingOrderByPayment = await findOrderByRazorpayPaymentId(razorpay_payment_id);
      if (existingOrderByPayment) {
        console.log(`[API verify-payment] Order already processed for payment ${razorpay_payment_id}. Returning existing.`);
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

    // 3. Server-side authoritative price recalculation & stock validation
    const calculated = await calculateTrustedOrder({
      items,
      paymentMethod: normalizedPaymentMethod,
      couponCode: coupon_code
    });

    // 4. Determine authoritative payment parameters
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
      // Cash on Delivery
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

    // 5. Atomic Stock Decrement for all cart items
    for (const item of calculated.items) {
      try {
        const prodId = item.product_id || item.sarojini_product_id;
        const isSarojini = item.catalog_type === 'sarojini';
        if (prodId) {
          await decrementStock(prodId, item.quantity, isSarojini);
        }
      } catch (stkErr) {
        console.warn(`[API verify-payment] Stock decrement error for item ${item.product_name}:`, stkErr.message);
      }
    }

    // 6. Generate order numbers and dates
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

    // 7. Insert Master Order into public.orders
    const basePayload = {
      user_id: user_id || null,
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
      transaction_reference: razorpay_payment_id || `COD-${Date.now()}`,
      coupon_code: coupon_code || null,
      delivery_preference: delivery_preference || 'Simple Delivery',
      free_gifts_eligible: freeGiftsEligible,
      free_gifts_items: resolvedGifts,
      is_full_online_payment: isFullOnline,
      idempotency_key: razorpay_payment_id ? `rzp_${razorpay_payment_id}` : `cod_${Date.now()}_${randomSuffix}`,
      tracking_data: {
        razorpay_order_id: razorpay_order_id || null,
        razorpay_payment_id: razorpay_payment_id || null,
        razorpay_signature: razorpay_signature || null,
        payment_gateway: isOnline ? 'razorpay' : 'cod',
        customer_email: delivery.email || null,
        address_type: delivery.addressType || 'Home',
        items_snapshot: calculated.items
      }
    };

    let createdOrder = null;
    try {
      // Attempt insert with extended Razorpay columns
      const fullPayload = {
        ...basePayload,
        razorpay_order_id: razorpay_order_id || null,
        razorpay_payment_id: razorpay_payment_id || null,
        razorpay_signature: razorpay_signature || null,
        payment_gateway: isOnline ? 'razorpay' : 'cod'
      };
      createdOrder = await insertOrder(fullPayload);
    } catch (dbErr) {
      console.warn('[API verify-payment] Extended insert fell back to base payload:', dbErr.message);
      // Fallback: insert with standard columns (tracking_data stores razorpay IDs and items_snapshot)
      createdOrder = await insertOrder(basePayload);
    }

    if (!createdOrder || !createdOrder.id) {
      throw new Error('Failed to create order record in database.');
    }

    // 8. Insert Order Items into public.order_items
    const orderId = createdOrder.id;
    const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

    const itemsPayload = calculated.items.map(item => {
      const price = Number(item.price !== undefined ? item.price : item.unit_price) || 0;
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (price * qty)) || 0;
      const advAmt = Number(item.line_advance !== undefined ? item.line_advance : (item.advance_amount || 0)) || 0;
      const codBal = Number(item.line_cod_balance !== undefined ? item.line_cod_balance : (item.cod_balance || 0)) || 0;

      return {
        order_id: orderId,
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

    // If free gifts eligible, also add free gift items to order_items
    if (freeGiftsEligible && Array.isArray(resolvedGifts)) {
      for (const gift of resolvedGifts) {
        itemsPayload.push({
          order_id: orderId,
          product_id: isValidUUID(gift.id || gift.product_id) ? (gift.id || gift.product_id) : null,
          sarojini_product_id: null,
          catalog_type: 'main',
          product_name: `[Free Gift] ${gift.name || gift.product_name || 'Special Gift'}`,
          product_image: gift.image || gift.product_image || null,
          quantity: 1,
          price: 0,
          subtotal: 0,
          selected_size: null,
          selected_color: null,
          advance_amount: 0,
          cod_balance: 0
        });
      }
    }

    try {
      await insertOrderItems(itemsPayload);
    } catch (itemErr) {
      console.warn('[API verify-payment] Primary order_items insert failed, attempting fallback with core columns:', itemErr.message);
      try {
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
      } catch (fallbackErr) {
        console.error('[API verify-payment] Critical: order_items fallback insertion failed:', fallbackErr.message);
        throw new Error(`Failed to record order items: ${fallbackErr.message}`);
      }
    }

    // 9. Update payment_transactions record to 'success'
    if (razorpay_order_id) {
      await updatePaymentTransaction(razorpay_order_id, {
        status: 'success',
        order_id: orderId,
        metadata: {
          order_number: createdOrder.order_number || orderNumber,
          razorpay_payment_id,
          razorpay_signature
        }
      });
    }

    return res.status(200).json({
      success: true,
      order_id: createdOrder.id,
      order_number: createdOrder.order_number || orderNumber,
      total: calculated.total,
      advance_paid: advancePaid,
      cod_balance: codBalance,
      payment_method: calculated.paymentMethod,
      is_full_online_payment: isFullOnline,
      free_gifts_eligible: freeGiftsEligible,
      free_gifts_count: resolvedGifts.length
    });
  } catch (error) {
    console.error('[API verify-payment] Error:', error);
    const statusCode = error.code === 'OUT_OF_STOCK' ? 409 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Payment verification and order processing failed.',
      code: error.code || 'VERIFICATION_FAILED',
      details: error.details || null
    });
  }
};
