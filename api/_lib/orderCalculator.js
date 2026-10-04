/**
 * Authoritative Server-side Order Calculation & Stock Validation Engine
 * Recalculates all pricing, product-specific advance payments, discounts,
 * and COD balances from trusted database records.
 * Never trusts frontend prices or advance amounts.
 */

const { fetchProduct, fetchProductBySlugOrName, fetchCoupon, fetchGlobalAdvanceSettings, fetchBogoConfig } = require('./supabaseAdmin');

/**
 * Validates cart items, verifies stock, and calculates canonical order totals.
 * @param {Object} params
 * @param {Array} params.items - Cart items [{ id, slug, quantity, selected_size, selected_color, catalog_type, is_free_bogo }]
 * @param {string} params.paymentMethod - 'cod' | 'full_online' | 'advance_cod'
 * @param {string} [params.couponCode]
 * @returns {Promise<Object>} Calculated order summary and resolved items
 */
async function calculateTrustedOrder({ items, paymentMethod, couponCode }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cart is empty. Please provide at least one item.');
  }

  const validPaymentMethods = ['cod', 'full_online', 'advance_cod'];
  const normalizedMethod = (paymentMethod || 'full_online').toLowerCase().trim();
  if (!validPaymentMethods.includes(normalizedMethod)) {
    throw new Error(`Invalid payment method: ${paymentMethod}. Must be one of: ${validPaymentMethods.join(', ')}.`);
  }

  let subtotal = 0;
  let totalProductAdvance = 0;
  const resolvedItems = [];
  const outOfStockItems = [];

  const globalAdvance = await fetchGlobalAdvanceSettings();
  const bogoConfig = await fetchBogoConfig();
  const bogoProductIds = (bogoConfig && Array.isArray(bogoConfig.product_ids)) ? bogoConfig.product_ids : [];

  for (const item of items) {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const isFreeBogo = Boolean(item.is_free_bogo);

    const isSarojini = item.catalog_type === 'sarojini' ||
      Boolean(item.sarojini_product_id) ||
      (typeof item.id === 'string' && item.id.startsWith('sarojini-')) ||
      (typeof item.image === 'string' && item.image.includes('sarojni'));

    const isUuid = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const targetId = isUuid(item.id) ? item.id
      : (isUuid(item.product_id) ? item.product_id
      : (isUuid(item.supabase_id) ? item.supabase_id
      : (isUuid(item.sarojini_product_id) ? item.sarojini_product_id : null)));

    let dbProduct = null;
    if (targetId) {
      dbProduct = await fetchProduct(targetId, isSarojini);
    }
    const searchIdentifier = item.slug || item.name || item.product_name;
    if (!dbProduct && searchIdentifier) {
      dbProduct = await fetchProductBySlugOrName(searchIdentifier, isSarojini);
    }

    // If product is still not found in designated catalog, attempt fallback check in other catalog
    if (!dbProduct && targetId) {
      dbProduct = await fetchProduct(targetId, !isSarojini);
    }

    if (!dbProduct) {
      throw new Error(`Product "${item.name || item.id}" could not be verified in store catalog.`);
    }

    // Verify BOGO pairing integrity if free item
    if (isFreeBogo) {
      const isPaired = items.some(p => p !== item && !p.is_free_bogo && (p.bogo_pair_id === item.bogo_pair_id || bogoProductIds.includes(p.id) || p.isBogo || p.is_bogo));
      if (!isPaired) {
        throw new Error(`Free complimentary gift "${item.name || item.id}" must be accompanied by an eligible paid product in the order.`);
      }
    }

    // Verify stock availability
    const availableStock = typeof dbProduct.stock === 'number' ? dbProduct.stock : 0;
    if (availableStock < qty) {
      outOfStockItems.push({
        id: dbProduct.id,
        name: dbProduct.name,
        requested: qty,
        available: availableStock
      });
    }

    const unitPrice = isFreeBogo ? 0 : Number(dbProduct.price);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    // Calculate line advance based on Authoritative Priority Precedence:
    // 1. Individual Product Advance Amount (Highest Priority)
    // 2. Global / Default Store Advance (Fallback if not explicitly set)
    // 3. Disabled / None (₹0)
    let unitAdvance = 0;
    if (!isFreeBogo) {
      const isAdvExplicit = dbProduct.advance_payment_enabled;
      const advType = dbProduct.advance_payment_type || 'fixed';
      const advVal = Number(dbProduct.advance_payment_value);

      if (isAdvExplicit === true && !isNaN(advVal) && advVal > 0) {
        // Individual Product Custom/Explicit Setting
        if (advType === 'percentage') {
          unitAdvance = Math.round(unitPrice * (advVal / 100));
        } else {
          unitAdvance = Math.min(unitPrice, Math.max(0, advVal));
        }
      } else if (isAdvExplicit === false) {
        // Explicitly disabled on product
        unitAdvance = 0;
      } else if (globalAdvance && globalAdvance.enabled) {
        // Global default store fallback
        const defAmt = Number(globalAdvance.default_amount) || 120;
        unitAdvance = Math.min(unitPrice, Math.max(0, defAmt));
      }
    }

    const lineAdvance = Math.min(lineTotal, unitAdvance * qty);
    totalProductAdvance += lineAdvance;

    resolvedItems.push({
      product_id: isSarojini ? null : dbProduct.id,
      sarojini_product_id: isSarojini ? dbProduct.id : null,
      catalog_type: isSarojini ? 'sarojini' : 'main',
      product_name: dbProduct.name,
      product_image: (Array.isArray(dbProduct.images) && dbProduct.images.length > 0) ? dbProduct.images[0] : (dbProduct.image || item.image || null),
      unit_price: unitPrice,
      price: unitPrice,
      quantity: qty,
      selected_size: item.selected_size || item.size || null,
      selected_color: item.selected_color || item.color || null,
      line_total: lineTotal,
      subtotal: lineTotal,
      unit_advance: unitAdvance,
      line_advance: lineAdvance,
      advance_amount: lineAdvance,
      line_cod_balance: Math.max(0, lineTotal - lineAdvance),
      cod_balance: Math.max(0, lineTotal - lineAdvance),
      advance_payment_enabled: Boolean(unitAdvance > 0),
      advance_payment_type: dbProduct.advance_payment_type || 'fixed',
      advance_payment_value: unitAdvance,
      is_free_bogo: isFreeBogo,
      bogo_pair_id: item.bogo_pair_id || null
    });
  }

  if (outOfStockItems.length > 0) {
    const itemNames = outOfStockItems.map(i => `"${i.name}" (only ${i.available} left)`).join(', ');
    const err = new Error(`Stock validation failed: ${itemNames} out of stock.`);
    err.code = 'OUT_OF_STOCK';
    err.details = outOfStockItems;
    throw err;
  }

  // Authoritative Coupon Validation
  let discountAmount = 0;
  let appliedCouponData = null;

  if (couponCode && couponCode.trim()) {
    const coupon = await fetchCoupon(couponCode.trim());
    if (coupon) {
      const minReq = Number(coupon.min_order_amount) || 0;
      const usageLimit = coupon.usage_limit;
      const usedCount = coupon.used_count || 0;
      const now = new Date();

      const isDateValid = (!coupon.start_date || new Date(coupon.start_date) <= now) &&
                          (!coupon.expiry_date || new Date(coupon.expiry_date) >= now);
      const isUsageValid = usageLimit === null || usedCount < usageLimit;
      const isMinMet = subtotal >= minReq;

      if (isDateValid && isUsageValid && isMinMet) {
        if (coupon.discount_type === 'fixed') {
          discountAmount = Math.min(subtotal, Number(coupon.discount_value) || 0);
        } else {
          // Percentage
          const pct = Number(coupon.discount_value) || 0;
          let disc = Math.round(subtotal * (pct / 100));
          if (coupon.max_discount && disc > Number(coupon.max_discount)) {
            disc = Number(coupon.max_discount);
          }
          discountAmount = Math.max(0, Math.min(subtotal, disc));
        }
        appliedCouponData = coupon;
      }
    }
  }

  // Shipping charge: ₹0 across India
  const shippingCharge = 0;

  // Final Order Total
  const finalTotal = Math.max(0, subtotal - discountAmount + shippingCharge);

  // Ensure total advance never exceeds final order total
  const cappedAdvance = Math.min(totalProductAdvance, finalTotal);
  const remainingCod = Math.max(0, finalTotal - cappedAdvance);

  // Determine payable amounts based on customer-selected payment method
  let payableNow = 0;
  let advanceAmount = 0;
  let advancePaid = 0;
  let codBalance = 0;
  let paymentStatus = 'pending';
  let advancePaymentStatus = 'not_required';
  let codPaymentStatus = 'not_applicable';

  if (normalizedMethod === 'cod') {
    // Pure Cash on Delivery
    payableNow = 0;
    advanceAmount = 0;
    advancePaid = 0;
    codBalance = finalTotal;
    paymentStatus = 'pending';
    advancePaymentStatus = 'not_required';
    codPaymentStatus = 'pending';
  } else if (normalizedMethod === 'full_online') {
    // 100% Online Payment via Direct UPI (vadii@ptaxis)
    payableNow = finalTotal;
    advanceAmount = 0;
    advancePaid = 0; // Set to finalTotal after successful admin verification
    codBalance = 0;
    paymentStatus = 'pending'; // Set to 'paid'/'verified' after admin verification
    advancePaymentStatus = 'not_required';
    codPaymentStatus = 'not_applicable';
  } else if (normalizedMethod === 'advance_cod') {
    // Advance Deposit via Direct UPI (vadii@ptaxis) + Remaining COD upon delivery
    payableNow = cappedAdvance;
    advanceAmount = cappedAdvance;
    advancePaid = 0; // Set to cappedAdvance after successful admin verification
    codBalance = remainingCod;
    paymentStatus = 'pending';
    advancePaymentStatus = 'pending';
    codPaymentStatus = codBalance > 0 ? 'pending' : 'not_applicable';
  }

  return {
    subtotal,
    discountAmount,
    shippingCharge,
    total: finalTotal,
    totalProductAdvance,
    advanceAmount,
    advancePaid,
    codBalance,
    payableNow,
    payableNowInPaise: Math.round(payableNow * 100),
    paymentMethod: normalizedMethod,
    paymentStatus,
    advancePaymentStatus,
    codPaymentStatus,
    appliedCoupon: appliedCouponData,
    items: resolvedItems
  };
}

module.exports = {
  calculateTrustedOrder
};
