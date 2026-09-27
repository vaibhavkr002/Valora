/**
 * POST /api/razorpay/webhook
 * Handles asynchronous webhooks from Razorpay:
 * - payment.captured
 * - payment.failed
 * - order.paid
 * - refund.processed
 *
 * Verifies webhook signature against RAZORPAY_WEBHOOK_SECRET using the exact
 * raw request body. Never parses or re-stringifies the body prior to verification.
 */

const { verifyWebhookSignature } = require('../_lib/razorpay');
const {
  findOrderByRazorpayOrderId,
  findOrderByRazorpayPaymentId,
  updateOrder,
  updatePaymentTransaction
} = require('../_lib/supabaseAdmin');

// In-memory LRU cache for idempotent event processing
const processedEventCache = new Map();
const MAX_CACHE_SIZE = 2000;
const EVENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isEventAlreadyProcessed(eventId) {
  if (!eventId) return false;
  const processedAt = processedEventCache.get(eventId);
  if (processedAt) {
    if (Date.now() - processedAt < EVENT_TTL_MS) {
      return true;
    }
    processedEventCache.delete(eventId);
  }
  return false;
}

function markEventProcessed(eventId) {
  if (!eventId) return;
  if (processedEventCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = processedEventCache.keys().next().value;
    processedEventCache.delete(oldestKey);
  }
  processedEventCache.set(eventId, Date.now());
}

/**
 * Extracts raw body string from incoming request.
 * Supports Vercel Serverless Functions with bodyParser: false as well as
 * pre-buffered or string bodies.
 */
async function getRawBody(req) {
  // 1. Direct raw body string or buffer if already present
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');

  // 2. Read from Node.js stream if readable and not ended
  if (typeof req.on === 'function') {
    try {
      const streamData = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
        req.on('error', err => reject(err));
      });
      if (typeof streamData === 'string' && streamData.length > 0) {
        return streamData;
      }
    } catch (_) {}
  }

  // 3. Fallback for async iterable streams
  if (typeof req[Symbol.asyncIterator] === 'function') {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      if (chunks.length > 0) {
        return Buffer.concat(chunks).toString('utf8');
      }
    } catch (_) {}
  }

  // 4. If req.body is already string or Buffer
  if (typeof req.body === 'string' && req.body.length > 0) {
    return req.body;
  }
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    return req.body.toString('utf8');
  }

  return '';
}

/**
 * Main Webhook Handler
 */
async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Razorpay-Signature, X-Razorpay-Event-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Extract signature and event id headers (case-insensitive check)
  const signature = req.headers['x-razorpay-signature'] || req.headers['X-Razorpay-Signature'];
  const eventIdHeader = req.headers['x-razorpay-event-id'] || req.headers['X-Razorpay-Event-Id'] || null;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Extract the EXACT raw request body
  let rawBody = '';
  try {
    rawBody = await getRawBody(req);
  } catch (readErr) {
    console.error('[Razorpay Webhook] Failed to read request body stream:', readErr.message);
    return res.status(400).json({ success: false, error: 'Failed to read request body stream.' });
  }

  const rawBodyLength = rawBody ? Buffer.byteLength(rawBody, 'utf8') : 0;
  const hasSignature = Boolean(signature && signature.trim().length > 0);

  // Requirement: return HTTP 400 for empty or missing body
  if (!rawBody || rawBody.trim().length === 0) {
    console.warn(`[Razorpay Webhook Diagnostic] method=${req.method} hasSignatureHeader=${hasSignature} rawBodyLength=0 eventId=${eventIdHeader || 'none'} eventType=none verified=false error=empty_body`);
    return res.status(400).json({ success: false, error: 'Empty or missing request body.' });
  }

  // Requirement: return HTTP 400 for missing signature
  if (!hasSignature) {
    console.warn(`[Razorpay Webhook Diagnostic] method=${req.method} hasSignatureHeader=false rawBodyLength=${rawBodyLength} eventId=${eventIdHeader || 'none'} eventType=none verified=false error=missing_signature`);
    return res.status(400).json({ success: false, error: 'Missing x-razorpay-signature header.' });
  }

  // Check if webhook secret is configured on server
  if (!webhookSecret) {
    console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured in server environment.');
    return res.status(500).json({ success: false, error: 'Webhook secret is not configured on server.' });
  }

  // Verify HMAC-SHA256 signature using the exact raw body string
  let isSignatureValid = false;
  try {
    isSignatureValid = verifyWebhookSignature({ rawBody, signature: signature.trim() });
  } catch (sigErr) {
    console.error('[Razorpay Webhook] Signature verification exception:', sigErr.message);
    isSignatureValid = false;
  }

  if (!isSignatureValid) {
    console.warn(`[Razorpay Webhook Diagnostic] method=${req.method} hasSignatureHeader=true rawBodyLength=${rawBodyLength} eventId=${eventIdHeader || 'none'} eventType=none verified=false error=invalid_signature`);
    return res.status(400).json({ success: false, error: 'Invalid webhook signature.' });
  }

  // Parse raw body JSON AFTER signature verification passes
  let eventPayload;
  try {
    eventPayload = JSON.parse(rawBody);
  } catch (parseErr) {
    console.error('[Razorpay Webhook] JSON parse error after signature verification:', parseErr.message);
    return res.status(400).json({ success: false, error: 'Malformed JSON payload.' });
  }

  if (!eventPayload || typeof eventPayload !== 'object' || !eventPayload.event) {
    console.warn('[Razorpay Webhook] Malformed webhook event payload structure.');
    return res.status(400).json({ success: false, error: 'Invalid webhook payload structure.' });
  }

  const eventName = eventPayload.event;
  const canonicalEventId = eventIdHeader || eventPayload.event_id || eventPayload.id || `evt_${Date.now()}`;

  // Safe server-side diagnostic log (never prints secret, signature, or payment secrets)
  console.log(`[Razorpay Webhook Diagnostic] method=${req.method} hasSignatureHeader=true rawBodyLength=${rawBodyLength} eventId=${canonicalEventId} eventType=${eventName} verified=true`);

  // Idempotency check: if already processed, return 200 immediately
  if (isEventAlreadyProcessed(canonicalEventId)) {
    console.log(`[Razorpay Webhook] Duplicate event ignored (idempotent): ${canonicalEventId}`);
    return res.status(200).json({
      success: true,
      duplicate: true,
      event_id: canonicalEventId,
      message: 'Event was already processed.'
    });
  }

  // Mark event as processed in idempotency cache
  markEventProcessed(canonicalEventId);

  // Process supported Razorpay events
  try {
    switch (eventName) {
      // 1. PAYMENT CAPTURED
      case 'payment.captured': {
        const payment = eventPayload.payload?.payment?.entity;
        if (payment) {
          const rzpPaymentId = payment.id;
          const rzpOrderId = payment.order_id;

          try {
            let order = null;
            if (rzpOrderId) order = await findOrderByRazorpayOrderId(rzpOrderId);
            if (!order && rzpPaymentId) order = await findOrderByRazorpayPaymentId(rzpPaymentId);

            if (order) {
              const isFullOnline = Boolean(order.is_full_online_payment || Number(order.advance_amount || 0) === 0);
              const updatePayload = {
                payment_status: isFullOnline ? 'paid' : order.payment_status,
                advance_payment_status: Number(order.advance_amount || 0) > 0 ? 'paid' : (order.advance_payment_status || 'not_required'),
                transaction_reference: rzpPaymentId
              };
              if (order.razorpay_payment_id !== rzpPaymentId) {
                updatePayload.razorpay_payment_id = rzpPaymentId;
              }
              await updateOrder(order.id, updatePayload);
            }

            if (rzpOrderId) {
              await updatePaymentTransaction(rzpOrderId, {
                status: 'captured',
                razorpay_payment_id: rzpPaymentId,
                metadata: {
                  payment_id: rzpPaymentId,
                  webhook_event_id: canonicalEventId,
                  captured_at: new Date().toISOString()
                }
              });
            }
          } catch (dbErr) {
            console.warn('[Razorpay Webhook] Database sync notice for payment.captured:', dbErr.message);
          }
        }
        break;
      }

      // 2. ORDER PAID
      case 'order.paid': {
        const orderEntity = eventPayload.payload?.order?.entity;
        if (orderEntity) {
          const rzpOrderId = orderEntity.id;
          try {
            const order = await findOrderByRazorpayOrderId(rzpOrderId);
            if (order) {
              const isFullOnline = Boolean(order.is_full_online_payment || Number(order.advance_amount || 0) === 0);
              await updateOrder(order.id, {
                payment_status: isFullOnline ? 'paid' : order.payment_status,
                advance_payment_status: Number(order.advance_amount || 0) > 0 ? 'paid' : (order.advance_payment_status || 'not_required')
              });
            }
            if (rzpOrderId) {
              await updatePaymentTransaction(rzpOrderId, {
                status: 'order_paid',
                metadata: {
                  webhook_event_id: canonicalEventId,
                  paid_at: new Date().toISOString()
                }
              });
            }
          } catch (dbErr) {
            console.warn('[Razorpay Webhook] Database sync notice for order.paid:', dbErr.message);
          }
        }
        break;
      }

      // 3. PAYMENT FAILED
      case 'payment.failed': {
        const payment = eventPayload.payload?.payment?.entity;
        if (payment) {
          const rzpPaymentId = payment.id;
          const rzpOrderId = payment.order_id;

          try {
            if (rzpOrderId) {
              const order = await findOrderByRazorpayOrderId(rzpOrderId);
              if (order && order.payment_status !== 'paid') {
                await updateOrder(order.id, {
                  payment_status: 'failed',
                  notes: `Payment failed (${payment.error_code || 'unknown'}): ${payment.error_description || 'Gateway error'}`
                });
              }

              await updatePaymentTransaction(rzpOrderId, {
                status: 'failed',
                razorpay_payment_id: rzpPaymentId,
                metadata: {
                  error_code: payment.error_code,
                  error_description: payment.error_description,
                  webhook_event_id: canonicalEventId,
                  failed_at: new Date().toISOString()
                }
              });
            }
          } catch (dbErr) {
            console.warn('[Razorpay Webhook] Database sync notice for payment.failed:', dbErr.message);
          }
        }
        break;
      }

      // 4. REFUND PROCESSED
      case 'refund.processed': {
        const refund = eventPayload.payload?.refund?.entity;
        if (refund) {
          const rzpPaymentId = refund.payment_id;
          const refundId = refund.id;
          const refundAmount = Number(refund.amount || 0) / 100;

          try {
            const order = await findOrderByRazorpayPaymentId(rzpPaymentId);
            if (order) {
              await updateOrder(order.id, {
                refund_id: refundId,
                refund_status: 'completed',
                refund_amount: refundAmount,
                refunded_at: new Date().toISOString()
              });
            }
          } catch (dbErr) {
            console.warn('[Razorpay Webhook] Database sync notice for refund.processed:', dbErr.message);
          }
        }
        break;
      }

      default:
        // Acknowledge other Razorpay events cleanly
        console.log(`[Razorpay Webhook] Unhandled event type acknowledged: ${eventName}`);
        break;
    }

    return res.status(200).json({
      success: true,
      event: eventName,
      event_id: canonicalEventId
    });
  } catch (procErr) {
    console.error('[Razorpay Webhook] Processing error:', procErr.message);
    return res.status(500).json({
      success: false,
      error: 'Error processing webhook event'
    });
  }
}

// Disable Vercel automatic body parsing so we receive the raw unconsumed byte stream
handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
