/**
 * Server-side Razorpay Service
 * Strictly executes on server/serverless environment.
 * Razorpay secret is never exposed to client-side code.
 */

const crypto = require('crypto');

function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID ? String(process.env.RAZORPAY_KEY_ID).trim() : null;
  const keySecret = process.env.RAZORPAY_KEY_SECRET ? String(process.env.RAZORPAY_KEY_SECRET).trim() : null;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ? String(process.env.RAZORPAY_WEBHOOK_SECRET).trim() : null;

  if (!keyId) {
    throw new Error('RAZORPAY_KEY_ID environment variable is missing.');
  }
  if (!keySecret) {
    throw new Error('RAZORPAY_KEY_SECRET environment variable is missing.');
  }

  const isTest = keyId.startsWith('rzp_test_');
  console.log(`[Razorpay Debug] MODE=${isTest ? 'TEST' : 'LIVE'} KEY_ID_PRESENT=true KEY_TYPE=${isTest ? 'TEST' : 'LIVE'} KEY_SECRET_PRESENT=true`);

  return { keyId, keySecret, webhookSecret };
}

/**
 * Creates an authoritative Razorpay Order
 * @param {Object} options
 * @param {number} options.amountInPaise - Exact amount in smallest currency unit (paise)
 * @param {string} [options.currency='INR']
 * @param {string} options.receipt - Merchant receipt ID
 * @param {Object} [options.notes={}]
 * @returns {Promise<Object>} Razorpay Order Object
 */
async function createRazorpayOrder({ amountInPaise, currency = 'INR', receipt, notes = {} }) {
  const { keyId, keySecret } = getRazorpayConfig();

  if (!amountInPaise || amountInPaise <= 0 || !Number.isInteger(amountInPaise)) {
    throw new Error(`Invalid amount in paise: ${amountInPaise}. Must be a positive integer.`);
  }

  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const payload = {
    amount: amountInPaise,
    currency: currency.toUpperCase(),
    receipt: (receipt || `rcpt_${Date.now()}`).slice(0, 40),
    payment_capture: 1, // Auto-capture payment upon authorization
    notes: {
      ...notes,
      platform: 'VALORA E-Commerce'
    }
  };

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error?.description || data?.error?.message || 'Failed to create Razorpay Order';
    const err = new Error(errorMsg);
    err.statusCode = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

/**
 * Verifies Razorpay Payment Signature using HMAC-SHA256
 * @param {Object} params
 * @param {string} params.orderId - razorpay_order_id
 * @param {string} params.paymentId - razorpay_payment_id
 * @param {string} params.signature - razorpay_signature
 * @returns {boolean} True if authentic, throws Error if invalid
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const { keySecret } = getRazorpayConfig();

  if (!orderId || !paymentId || !signature) {
    throw new Error('Missing required signature verification parameters (orderId, paymentId, signature).');
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const isAuthentic = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  );

  if (!isAuthentic) {
    throw new Error('Payment signature verification failed. Untrusted payment payload.');
  }

  return true;
}

/**
 * Verifies Webhook Signature
 * @param {string} rawBody - Raw unparsed webhook payload string
 * @param {string} signature - x-razorpay-signature header
 * @returns {boolean} True if authentic
 */
function verifyWebhookSignature({ rawBody, signature, customSecret }) {
  const webhookSecret = customSecret || process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured on the server.');
  }

  if (typeof rawBody !== 'string' || !rawBody) {
    return false;
  }

  if (typeof signature !== 'string' || !signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const signatureBuf = Buffer.from(signature.trim(), 'utf8');

    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch (_) {
    return false;
  }
}

/**
 * Creates a Refund via Razorpay API
 * @param {Object} params
 * @param {string} params.paymentId - razorpay_payment_id
 * @param {number} [params.amountInPaise] - Optional amount in paise. If omitted, full refund
 * @param {Object} [params.notes={}]
 * @returns {Promise<Object>} Razorpay Refund Object
 */
async function createRazorpayRefund({ paymentId, amountInPaise, notes = {} }) {
  const { keyId, keySecret } = getRazorpayConfig();

  if (!paymentId) {
    throw new Error('paymentId is required for refund.');
  }

  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const payload = {
    notes: {
      ...notes,
      platform: 'VALORA E-Commerce'
    }
  };

  if (amountInPaise && amountInPaise > 0) {
    payload.amount = Math.round(amountInPaise);
  }

  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error?.description || data?.error?.message || 'Failed to process Razorpay refund';
    const err = new Error(errorMsg);
    err.statusCode = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

/**
 * Fetches Razorpay Payment details directly from Razorpay
 * @param {string} paymentId
 * @returns {Promise<Object>}
 */
async function fetchPaymentDetails(paymentId) {
  const { keyId, keySecret } = getRazorpayConfig();
  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: { 'Authorization': authHeader }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.description || 'Failed to fetch payment details.');
  }
  return data;
}

module.exports = {
  getRazorpayConfig,
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  createRazorpayRefund,
  fetchPaymentDetails
};
