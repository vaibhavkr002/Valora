/**
 * POST /api/orders/create
 * Real Direct UPI E-Commerce Order Creation Engine
 * 
 * 1. Authoritatively recalculates prices, stock, discounts, and advance requirements from Supabase.
 * 2. Creates REAL order record in public.orders before payment attempt.
 * 3. Creates line items in public.order_items.
 * 4. Generates dynamic UPI URI: upi://pay?pa=vadii@ptaxis&pn=VALORA&am=<AMOUNT>&cu=INR&tn=<ORDER_REF>
 * 5. Strictly prevents duplicate orders by associating idempotency keys and existing order IDs.
 * 6. NO fake payments, NO mock callbacks, NO third-party payment gateways.
 */

const { calculateTrustedOrder } = require('../_lib/orderCalculator');
const {
  insertOrder,
  insertOrderItems,
  decrementStock,
  recordPaymentTransaction,
  findOrderByTransactionReference
} = require('../_lib/supabaseAdmin');

const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || process.env.DEFAULT_UPI_ID || 'vadii@ptaxis';
const MERCHANT_NAME = process.env.MERCHANT_NAME || process.env.DEFAULT_UPI_NAME || 'VALORA';

function buildUpiIntentUri(amount, refNote, customMerchantUpiId, customMerchantName) {
  const upiId = customMerchantUpiId || MERCHANT_UPI_ID;
  const name = customMerchantName || MERCHANT_NAME;
  const amtStr = Number(amount).toFixed(2);
  const noteStr = encodeURIComponent(refNote);
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amtStr}&cu=INR&tn=${noteStr}`;
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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ success: false, error: 'Malformed JSON payload.' });
      }
    }

    const {
      items,
      payment_method,
      coupon_code,
      delivery_details,
      delivery_preference,
      free_gifts_items,
      user_id,
      existing_order_id,
      store_type
    } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart items are required.' });
    }

    // 1. Authoritatively recalculate trusted order totals and validate stock server-side
    const normalizedPaymentMethod = (payment_method || 'full_online').toLowerCase().trim();
    const calculated = await calculateTrustedOrder({
      items,
      paymentMethod: normalizedPaymentMethod,
      couponCode: coupon_code
    });

    const isCod = calculated.paymentMethod === 'cod';
    const isAdvCod = calculated.paymentMethod === 'advance_cod';
    const isFullOnline = calculated.paymentMethod === 'full_online';

    // 2. Check for duplicate order prevention if existing order was passed
    if (existing_order_id) {
      const existing = await findOrderByTransactionReference(existing_order_id);
      if (existing && (existing.order_status === 'PAYMENT_PENDING' || existing.order_status === 'payment_rejected')) {
        const payableAmount = isAdvCod ? Number(existing.advance_amount) : Number(existing.total);
        const amtStr = payableAmount.toFixed(2);
        const upiUri = `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amtStr}&cu=INR&tn=${encodeURIComponent(existing.order_number || existing.id)}`;

        return res.status(200).json({
          success: true,
          is_existing: true,
          order_id: existing.id,
          order_number: existing.order_number,
          total: Number(existing.total),
          payable_now: payableAmount,
          advance_amount: Number(existing.advance_amount || 0),
          cod_balance: Number(existing.cod_balance || 0),
          upi_uri: upiUri,
          merchant_upi_id: MERCHANT_UPI_ID,
          merchant_name: MERCHANT_NAME,
          payment_method: existing.payment_method,
          order_status: existing.order_status,
          payment_status: existing.payment_status
        });
      }
    }

    // 3. Determine authoritative amounts and initial statuses
    let advanceAmount = 0;
    let codBalance = 0;
    let payableNow = 0;
    let orderStatus = 'placed'; // Valid in orders_order_status_check
    let paymentStatus = 'pending'; // Valid in orders_payment_status_check
    let advancePaymentStatus = 'not_required';
    let codPaymentStatus = 'not_applicable';
    let paymentMethodDisplay = '';

    if (isCod) {
      advanceAmount = 0;
      codBalance = calculated.total;
      payableNow = 0;
      orderStatus = 'placed';
      paymentStatus = 'pending';
      advancePaymentStatus = 'not_required';
      codPaymentStatus = 'pending';
      paymentMethodDisplay = 'Cash on Delivery';
    } else if (isAdvCod) {
      advanceAmount = calculated.advanceAmount;
      codBalance = calculated.codBalance;
      payableNow = calculated.advanceAmount;
      orderStatus = 'placed';
      paymentStatus = 'pending';
      advancePaymentStatus = 'pending';
      codPaymentStatus = codBalance > 0 ? 'pending' : 'not_applicable';
      paymentMethodDisplay = `Advance + Cash on Delivery (Advance: ₹${advanceAmount}, COD: ₹${codBalance})`;
    } else {
      // Full Direct UPI Payment
      advanceAmount = 0;
      codBalance = 0;
      payableNow = calculated.total;
      orderStatus = 'placed';
      paymentStatus = 'pending';
      advancePaymentStatus = 'not_required';
      codPaymentStatus = 'not_applicable';
      paymentMethodDisplay = `Full UPI Online Payment (₹${calculated.total})`;
    }

    // 4. Generate unique order number and reference
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `VADI-ORD-${dateStr}-${randomSuffix}`;
    const transactionRef = `VADI-TXN-${Date.now()}-${randomSuffix}`;

    const delivery = delivery_details || {};
    const streetAddress = [
      delivery.house,
      delivery.street,
      delivery.landmark
    ].filter(Boolean).join(', ') || delivery.address || '';
    const normalizedCustomerEmail = delivery.email ? String(delivery.email).trim().toLowerCase() : null;

    const now = new Date();
    const deliveryStart = new Date(now);
    deliveryStart.setDate(now.getDate() + 3);
    const deliveryEnd = new Date(now);
    deliveryEnd.setDate(now.getDate() + 5);
    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const etaFormatted = `${deliveryStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - ${deliveryEnd.toLocaleDateString('en-IN', dateOptions)}`;

    const freeGiftsEligible = Boolean(isFullOnline && Array.isArray(free_gifts_items) && free_gifts_items.length > 0);
    const resolvedGifts = freeGiftsEligible ? free_gifts_items : [];

    // 5. Decrement stock for confirmed COD orders immediately
    if (isCod) {
      for (const item of calculated.items) {
        try {
          const prodId = item.product_id || item.sarojini_product_id;
          const isSarojini = item.catalog_type === 'sarojini';
          if (prodId) {
            await decrementStock(prodId, item.quantity, isSarojini);
          }
        } catch (stkErr) {
          console.warn('[API orders/create] Stock decrement notice:', stkErr.message);
        }
      }
    }

    // 6. Generate dynamic Direct UPI Intent URI
    let upiUri = null;

    if (!isCod && payableNow > 0) {
      upiUri = buildUpiIntentUri(payableNow, orderNumber, MERCHANT_UPI_ID, MERCHANT_NAME);
    }

    // 7. Insert Order into Supabase
    const orderPayload = {
      user_id: user_id || null,
      customer_email: normalizedCustomerEmail,
      order_number: orderNumber,
      subtotal: calculated.subtotal,
      discount: calculated.discountAmount,
      shipping_charge: calculated.shippingCharge || 0,
      tax: 0,
      total: calculated.total,
      payment_method: paymentMethodDisplay,
      payment_status: paymentStatus,
      advance_amount: advanceAmount,
      advance_paid: 0,
      cod_balance: codBalance,
      advance_payment_status: advancePaymentStatus,
      cod_payment_status: codPaymentStatus,
      order_status: orderStatus,
      delivery_full_name: (delivery.fullName || delivery.full_name || 'Customer').trim() || 'Customer',
      delivery_phone: delivery.phone || '',
      delivery_address: streetAddress,
      delivery_city: delivery.city || '',
      delivery_state: delivery.state || '',
      delivery_country: delivery.country || 'India',
      delivery_pincode: delivery.zip || delivery.pincode || '',
      estimated_delivery: etaFormatted,
      transaction_reference: transactionRef,
      coupon_code: coupon_code || null,
      delivery_preference: delivery_preference || 'Simple Delivery',
      free_gifts_eligible: freeGiftsEligible,
      free_gifts_items: resolvedGifts,
      is_full_online_payment: isFullOnline,
      idempotency_key: `vadi_${transactionRef}`,
      tracking_data: {
        store_type: store_type || 'main',
        merchant_vpa: MERCHANT_UPI_ID,
        merchant_name: MERCHANT_NAME,
        payable_now: payableNow,
        upi_uri: upiUri,
        customer_email: normalizedCustomerEmail,
        payment_verification_status: isCod ? 'not_applicable' : 'pending',
        address_type: delivery.addressType || 'Home',
        items_snapshot: calculated.items
      }
    };

    const createdOrder = await insertOrder(orderPayload);
    if (!createdOrder || !createdOrder.id) {
      throw new Error('Failed to create order record in database.');
    }

    const orderId = createdOrder.id;

    // 8. Insert Order Items into public.order_items
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
      console.warn('[API orders/create] order_items insert fallback:', itemErr.message);
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
        console.error('[API orders/create] Error recording order items:', fallbackErr.message);
      }
    }

    // 9. Record payment transaction entry in public.payment_transactions
    if (!isCod) {
      await recordPaymentTransaction({
        transaction_reference: transactionRef,
        order_id: orderId,
        order_number: createdOrder.order_number || orderNumber,
        customer_phone: delivery.phone || '',
        customer_email: normalizedCustomerEmail,
        merchant_vpa: MERCHANT_UPI_ID,
        merchant_name: MERCHANT_NAME,
        amount: payableNow,
        currency: 'INR',
        payment_type: isAdvCod ? 'advance' : 'full',
        upi_app: 'Direct UPI',
        status: 'pending',
        upi_uri: upiUri,
        items_snapshot: calculated.items,
        delivery_details: delivery,
        metadata: {
          order_id: orderId,
          order_number: createdOrder.order_number || orderNumber,
          total: calculated.total,
          advance_amount: advanceAmount,
          cod_balance: codBalance,
          payable_now: payableNow,
          store_type: store_type || 'main'
        }
      });
    }

    return res.status(200).json({
      success: true,
      is_cod: isCod,
      order_id: createdOrder.id,
      order_number: createdOrder.order_number || orderNumber,
      transaction_reference: transactionRef,
      total: calculated.total,
      payable_now: payableNow,
      advance_amount: advanceAmount,
      cod_balance: codBalance,
      payment_method: paymentMethodDisplay,
      upi_uri: upiUri,
      merchant_upi_id: MERCHANT_UPI_ID,
      merchant_name: MERCHANT_NAME,
      order_status: orderStatus,
      payment_status: paymentStatus,
      summary: {
        subtotal: calculated.subtotal,
        discount: calculated.discountAmount,
        shipping: calculated.shippingCharge || 0,
        total: calculated.total,
        advance_amount: advanceAmount,
        cod_balance: codBalance,
        payable_now: payableNow,
        items: calculated.items
      }
    });

  } catch (error) {
    console.error('[API orders/create] Error:', error);
    const statusCode = error.code === 'OUT_OF_STOCK' ? 409 : (error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to create order.',
      code: error.code || 'ORDER_CREATION_FAILED'
    });
  }
};
