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

/**
 * Inserts order record into public.orders
 */
async function insertOrder(orderPayload) {
  const data = await supabaseRest('orders', {
    method: 'POST',
    body: orderPayload
  });
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Inserts items into public.order_items
 */
async function insertOrderItems(itemsPayload) {
  const data = await supabaseRest('order_items', {
    method: 'POST',
    body: itemsPayload
  });
  return data;
}

/**
 * Updates order status/payment details
 */
async function updateOrder(orderIdOrNumber, updatePayload) {
  // Try by id first if UUID, else order_number
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrNumber);
  const filter = isUuid ? `id=eq.${encodeURIComponent(orderIdOrNumber)}` : `order_number=eq.${encodeURIComponent(orderIdOrNumber)}`;
  const data = await supabaseRest(`orders?${filter}`, {
    method: 'PATCH',
    body: updatePayload
  });
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Finds an order by razorpay_order_id or transaction_reference
 */
async function findOrderByRazorpayOrderId(rzpOrderId) {
  // Check transaction_reference first
  let data = await supabaseRest(`orders?transaction_reference=eq.${encodeURIComponent(rzpOrderId)}&select=*&limit=1`);
  if (!Array.isArray(data) || data.length === 0) {
    // Check if razorpay_order_id column exists
    try {
      data = await supabaseRest(`orders?razorpay_order_id=eq.${encodeURIComponent(rzpOrderId)}&select=*&limit=1`);
    } catch (_) {}
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Finds an order by razorpay_payment_id
 */
async function findOrderByRazorpayPaymentId(rzpPaymentId) {
  let data = await supabaseRest(`orders?transaction_reference=eq.${encodeURIComponent(rzpPaymentId)}&select=*&limit=1`);
  if (!Array.isArray(data) || data.length === 0) {
    try {
      data = await supabaseRest(`orders?razorpay_payment_id=eq.${encodeURIComponent(rzpPaymentId)}&select=*&limit=1`);
    } catch (_) {}
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
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

module.exports = {
  fetchProduct,
  fetchProductBySlugOrName,
  fetchCoupon,
  decrementStock,
  insertOrder,
  insertOrderItems,
  updateOrder,
  findOrderByRazorpayOrderId,
  findOrderByRazorpayPaymentId,
  recordPaymentTransaction,
  updatePaymentTransaction,
  linkGuestOrdersByEmail,
  supabaseRest,
  getSupabaseConfig
};
