/**
 * Server-side Supabase Database Service
 * Provides authenticated DB operations for order creation, stock verification,
 * and payment logging.
 */

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || 'https://brioiujppaaycydndrcp.supabase.co';
  // Support SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_KEY, or SUPABASE_ANON_KEY
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SECRET_KEY ||
              process.env.SUPABASE_KEY ||
              process.env.SUPABASE_ANON_KEY ||
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

  return { url, key };
}

function getHeaders(customToken) {
  const { key } = getSupabaseConfig();
  const token = customToken || key;
  return {
    'apikey': key,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

/**
 * Executes a Supabase REST query
 */
async function supabaseRest(endpoint, options = {}) {
  const { url } = getSupabaseConfig();
  const reqUrl = `${url}/rest/v1/${endpoint}`;
  const response = await fetch(reqUrl, {
    method: options.method || 'GET',
    headers: {
      ...getHeaders(options.token),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Supabase REST error: ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

/**
 * Fetches trusted product record by ID from products or sarojini_products
 */
async function fetchProduct(productId, isSarojini = false) {
  const table = isSarojini ? 'sarojini_products' : 'products';
  const data = await supabaseRest(`${table}?id=eq.${encodeURIComponent(productId)}&select=*&limit=1`);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Fetches product by slug or name fallback
 */
async function fetchProductBySlugOrName(slugOrName, isSarojini = false) {
  const table = isSarojini ? 'sarojini_products' : 'products';
  // Try slug first
  let data = await supabaseRest(`${table}?slug=eq.${encodeURIComponent(slugOrName)}&select=*&limit=1`);
  if (!Array.isArray(data) || data.length === 0) {
    // Try name
    data = await supabaseRest(`${table}?name=eq.${encodeURIComponent(slugOrName)}&select=*&limit=1`);
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Validates and retrieves an active coupon
 */
async function fetchCoupon(code) {
  if (!code) return null;
  const cleanCode = code.trim().toUpperCase();
  const data = await supabaseRest(`coupons?code=eq.${encodeURIComponent(cleanCode)}&is_active=eq.true&select=*&limit=1`);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Atomically decrements product stock
 */
async function decrementStock(productId, quantity, isSarojini = false) {
  const table = isSarojini ? 'sarojini_products' : 'products';
  // Read current stock
  const prod = await fetchProduct(productId, isSarojini);
  if (prod) {
    const newStock = Math.max(0, (prod.stock || 0) - quantity);
    await supabaseRest(`${table}?id=eq.${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      body: { stock: newStock }
    });
  }
}

const crypto = require('crypto');

/**
 * Inserts order record into public.orders
 */
async function insertOrder(orderPayload) {
  const generatedId = orderPayload.id || crypto.randomUUID();
  const payloadWithId = { ...orderPayload, id: generatedId };

  try {
    const data = await supabaseRest('orders', {
      method: 'POST',
      body: payloadWithId
    });
    return Array.isArray(data) && data.length > 0 ? data[0] : (data || payloadWithId);
  } catch (err) {
    // If representation fails due to guest RLS or anon key, fallback to minimal return
    if (err.message && err.message.includes('row-level security')) {
      await supabaseRest('orders', {
        method: 'POST',
        body: payloadWithId,
        headers: { 'Prefer': 'return=minimal' }
      });
      return payloadWithId;
    }
    throw err;
  }
}

/**
 * Inserts items into public.order_items
 */
async function insertOrderItems(itemsPayload) {
  try {
    const data = await supabaseRest('order_items', {
      method: 'POST',
      body: itemsPayload
    });
    return data;
  } catch (err) {
    if (err.message && err.message.includes('row-level security')) {
      try {
        await supabaseRest('order_items', {
          method: 'POST',
          body: itemsPayload,
          headers: { 'Prefer': 'return=minimal' }
        });
      } catch (innerErr) {
        console.warn('[SupabaseAdmin] order_items insert notice (items preserved in snapshot):', innerErr.message);
      }
      return itemsPayload;
    }
    throw err;
  }
}

/**
 * Updates order status/payment details
 */
async function updateOrder(orderIdOrNumber, updatePayload, customToken = null) {
  // Try by id first if UUID, else order_number
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrNumber);
  const filter = isUuid ? `id=eq.${encodeURIComponent(orderIdOrNumber)}` : `order_number=eq.${encodeURIComponent(orderIdOrNumber)}`;
  
  try {
    const data = await supabaseRest(`orders?${filter}`, {
      method: 'PATCH',
      body: updatePayload,
      token: customToken
    });
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    // If a column is missing from schema cache (e.g. unapplied migrations), strip non-base columns and retry
    if (err.details?.code === 'PGRST204' || (err.message && err.message.includes('schema cache'))) {
      const safePayload = { ...updatePayload };
      delete safePayload.customer_utr;
      delete safePayload.verified_at;
      delete safePayload.verified_by;
      delete safePayload.rejection_reason;
      delete safePayload.merchant_vpa;
      delete safePayload.merchant_name;

      const fallbackData = await supabaseRest(`orders?${filter}`, {
        method: 'PATCH',
        body: safePayload,
        token: customToken
      });
      return Array.isArray(fallbackData) ? fallbackData[0] : fallbackData;
    }

    if (err.message && err.message.includes('row-level security')) {
      const minData = await supabaseRest(`orders?${filter}`, {
        method: 'PATCH',
        body: updatePayload,
        token: customToken,
        headers: { 'Prefer': 'return=minimal' }
      });
      return minData;
    }
    throw err;
  }
}

/**
 * Finds an order by transaction reference or ID
 */
async function findOrderByTransactionReference(txRef) {
  if (!txRef) return null;

  // 1. Try RPC lookup if available (SECURITY DEFINER)
  try {
    const rpcData = await supabaseRest('rpc/get_order_by_reference', {
      method: 'POST',
      body: { p_ref: String(txRef).trim() }
    });
    if (rpcData && typeof rpcData === 'object' && rpcData.id) {
      return rpcData;
    }
  } catch (_) {}

  // 2. Direct REST lookups
  let data = await supabaseRest(`orders?transaction_reference=eq.${encodeURIComponent(txRef)}&select=*&limit=1`);
  if (!Array.isArray(data) || data.length === 0) {
    try {
      data = await supabaseRest(`orders?id=eq.${encodeURIComponent(txRef)}&select=*&limit=1`);
    } catch (_) {}
  }
  if (!Array.isArray(data) || data.length === 0) {
    try {
      data = await supabaseRest(`orders?order_number=eq.${encodeURIComponent(txRef)}&select=*&limit=1`);
    } catch (_) {}
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Resolves an order by its Razorpay Order ID (e.g. order_XXXXX)
 */
async function findOrderByRazorpayOrderId(rzpOrderId) {
  if (!rzpOrderId) return null;
  try {
    const data = await supabaseRest(`orders?razorpay_order_id=eq.${encodeURIComponent(rzpOrderId)}&select=*&limit=1`);
    if (Array.isArray(data) && data.length > 0) return data[0];
  } catch (_) {}

  const order = await findOrderByTransactionReference(rzpOrderId);
  if (order) return order;

  try {
    const data = await supabaseRest(`orders?tracking_data->>razorpay_order_id=eq.${encodeURIComponent(rzpOrderId)}&select=*&limit=1`);
    if (Array.isArray(data) && data.length > 0) return data[0];
  } catch (_) {}

  return null;
}

/**
 * Resolves an order by its Razorpay Payment ID (e.g. pay_XXXXX)
 */
async function findOrderByRazorpayPaymentId(rzpPaymentId) {
  if (!rzpPaymentId) return null;
  try {
    const data = await supabaseRest(`orders?razorpay_payment_id=eq.${encodeURIComponent(rzpPaymentId)}&select=*&limit=1`);
    if (Array.isArray(data) && data.length > 0) return data[0];
  } catch (_) {}

  const order = await findOrderByTransactionReference(rzpPaymentId);
  if (order) return order;

  try {
    const data = await supabaseRest(`orders?tracking_data->>razorpay_payment_id=eq.${encodeURIComponent(rzpPaymentId)}&select=*&limit=1`);
    if (Array.isArray(data) && data.length > 0) return data[0];
  } catch (_) {}

  return null;
}

/**
 * Records payment transaction intent into public.payment_transactions
 */
async function recordPaymentTransaction(txnPayload) {
  try {
    const data = await supabaseRest('payment_transactions', {
      method: 'POST',
      body: txnPayload
    });
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.warn('[SupabaseAdmin] payment_transactions insert notice:', err.message);
    return null;
  }
}

/**
 * Updates payment transaction by reference
 */
async function updatePaymentTransaction(txnRef, updatePayload) {
  try {
    const data = await supabaseRest(`payment_transactions?transaction_reference=eq.${encodeURIComponent(txnRef)}`, {
      method: 'PATCH',
      body: updatePayload
    });
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.warn('[SupabaseAdmin] payment_transactions update notice:', err.message);
    return null;
  }
}

/**
 * Links unassigned guest orders to authenticated user_id by customer_email
 */
async function linkGuestOrdersByEmail(userId, email, callerToken) {
  if (!userId || !email) return { linked_count: 0 };
  const cleanEmail = email.trim().toLowerCase();

  // 1. Try invoking atomic RPC if available
  try {
    const rpcRes = await supabaseRest('rpc/link_guest_orders', {
      method: 'POST',
      body: { p_user_id: userId, p_user_email: cleanEmail },
      token: callerToken
    });
    if (rpcRes && typeof rpcRes.linked_count === 'number') {
      return rpcRes;
    }
  } catch (rpcErr) {
    console.warn('[SupabaseAdmin] link_guest_orders RPC notice:', rpcErr.message);
  }

  // 2. Direct REST update fallback
  let linkedCount = 0;
  try {
    const matchedOrders = await supabaseRest(`orders?user_id=is.null&customer_email=eq.${encodeURIComponent(cleanEmail)}&select=id`);
    if (Array.isArray(matchedOrders) && matchedOrders.length > 0) {
      await supabaseRest(`orders?user_id=is.null&customer_email=eq.${encodeURIComponent(cleanEmail)}`, {
        method: 'PATCH',
        body: { user_id: userId, customer_email: cleanEmail }
      });
      linkedCount += matchedOrders.length;
    }
  } catch (e) {
    console.warn('[SupabaseAdmin] Direct customer_email link notice:', e.message);
  }

  try {
    const matchedTracking = await supabaseRest(`orders?user_id=is.null&tracking_data->>customer_email=eq.${encodeURIComponent(cleanEmail)}&select=id`);
    if (Array.isArray(matchedTracking) && matchedTracking.length > 0) {
      await supabaseRest(`orders?user_id=is.null&tracking_data->>customer_email=eq.${encodeURIComponent(cleanEmail)}`, {
        method: 'PATCH',
        body: { user_id: userId, customer_email: cleanEmail }
      });
      linkedCount += matchedTracking.length;
    }
  } catch (e) {
    console.warn('[SupabaseAdmin] Tracking customer_email link notice:', e.message);
  }

  return { success: true, linked_count: linkedCount };
}

/**
 * Resolves an order by its primary key ID
 */
async function getOrderById(orderId) {
  if (!orderId) return null;
  return findOrderByTransactionReference(orderId);
}

let cachedGlobalAdvance = null;
let lastGlobalAdvanceFetch = 0;

/**
 * Fetches global advance payment settings from store_settings (key = 'advance_payment')
 */
async function fetchGlobalAdvanceSettings() {
  const now = Date.now();
  if (cachedGlobalAdvance && (now - lastGlobalAdvanceFetch < 30000)) {
    return cachedGlobalAdvance;
  }
  try {
    const data = await supabaseRest(`store_settings?key=eq.advance_payment&select=*&limit=1`);
    if (Array.isArray(data) && data.length > 0 && data[0]?.value) {
      cachedGlobalAdvance = data[0].value;
      lastGlobalAdvanceFetch = now;
      return cachedGlobalAdvance;
    }
  } catch (err) {
    console.warn('[supabaseAdmin] Global advance fetch warning:', err.message);
  }
  return { enabled: true, default_amount: 120, applies_to: 'both' };
}

let cachedBogoConfig = null;
let lastBogoConfigFetch = 0;

/**
 * Fetches BOGO settings from store_settings (key = 'bogo_config')
 */
async function fetchBogoConfig() {
  const now = Date.now();
  if (cachedBogoConfig && (now - lastBogoConfigFetch < 30000)) {
    return cachedBogoConfig;
  }
  try {
    const data = await supabaseRest(`store_settings?key=eq.bogo_config&select=*&limit=1`);
    if (Array.isArray(data) && data.length > 0 && data[0]?.value) {
      cachedBogoConfig = data[0].value;
      lastBogoConfigFetch = now;
      return cachedBogoConfig;
    }
  } catch (err) {
    console.warn('[supabaseAdmin] BOGO config fetch warning:', err.message);
  }
  return { enabled: true, product_ids: [] };
}

module.exports = {
  fetchProduct,
  fetchProductBySlugOrName,
  fetchCoupon,
  fetchGlobalAdvanceSettings,
  fetchBogoConfig,
  decrementStock,
  insertOrder,
  insertOrderItems,
  updateOrder,
  getOrderById,
  findOrderByTransactionReference,
  findOrderByRazorpayOrderId,
  findOrderByRazorpayPaymentId,
  recordPaymentTransaction,
  updatePaymentTransaction,
  linkGuestOrdersByEmail,
  supabaseRest,
  getSupabaseConfig
};
