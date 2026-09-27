/**
 * POST /api/razorpay/webhook
 * Handles asynchronous webhooks from Razorpay:
 * - payment.captured
 * - payment.failed
 * - order.paid
 * - refund.processed
 *
 * Verifies webhook signature against RAZORPAY_WEBHOOK_SECRET.
 */

const { verifyWebhookSignature } = require('../_lib/razorpay');
const {
  findOrderByRazorpayOrderId,
  findOrderByRazorpayPaymentId,
  updateOrder,
  updatePaymentTransaction
} = require('../_lib/supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Retrieve raw body string
  let rawBody = '';
  if (typeof req.body === 'string') {
    rawBody = req.body;
  } else if (Buffer.isBuffer(req.body)) {
    rawBody = req.body.toString('utf8');
  } else {
    rawBody = JSON.stringify(req.body);
  }

  // Signature verification (if webhook secret is configured)
  if (webhookSecret) {
    if (!signature) {
      console.warn('[Razorpay Webhook] Missing x-razorpay-signature header.');
      return res.status(400).json({ error: 'Missing webhook signature' });
    }

    try {
      const isValid = verifyWebhookSignature({ rawBody, signature });
      if (!isValid) {
        console.error('[Razorpay Webhook] Invalid webhook signature.');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    } catch (err) {
      console.error('[Razorpay Webhook] Webhook signature verification error:', err.message);
      return res.status(400).json({ error: 'Signature verification failed' });
    }
  }

  let eventPayload;
  try {
    eventPayload = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody);
  } catch (parseErr) {
    console.error('[Razorpay Webhook] Failed to parse JSON body:', parseErr.message);
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }

  const eventName = eventPayload.event;
  console.log(`[Razorpay Webhook] Received event: ${eventName}`);

  try {
    switch (eventName) {
      case 'payment.captured': {
        const payment = eventPayload.payload?.payment?.entity;
        if (payment) {
          const rzpPaymentId = payment.id;
          const rzpOrderId = payment.order_id;
          console.log(`[Razorpay Webhook] Payment captured: ${rzpPaymentId} for order: ${rzpOrderId}`);

          // Find order by razorpay_order_id or razorpay_payment_id
          let order = await findOrderByRazorpayOrderId(rzpOrderId);
          if (!order) {
            order = await findOrderByRazorpayPaymentId(rzpPaymentId);
          }

          if (order) {
            const isFullOnline = order.is_full_online_payment || order.advance_amount === 0;
            const updateData = {
              payment_status: isFullOnline ? 'paid' : order.payment_status,
              advance_payment_status: order.advance_amount > 0 ? 'paid' : order.advance_payment_status,
              transaction_reference: rzpPaymentId
            };
            await updateOrder(order.id, updateData);
          }

          if (rzpOrderId) {
            await updatePaymentTransaction(rzpOrderId, {
              status: 'captured',
              metadata: { payment_id: rzpPaymentId, captured_at: new Date().toISOString() }
            });
          }
        }
        break;
      }

      case 'payment.failed': {
        const payment = eventPayload.payload?.payment?.entity;
        if (payment && payment.order_id) {
          console.warn(`[Razorpay Webhook] Payment failed for order ${payment.order_id}:`, payment.error_description);
          await updatePaymentTransaction(payment.order_id, {
            status: 'failed',
            metadata: {
              error_code: payment.error_code,
              error_description: payment.error_description
            }
          });
        }
        break;
      }

      case 'refund.processed': {
        const refund = eventPayload.payload?.refund?.entity;
        if (refund) {
          console.log(`[Razorpay Webhook] Refund processed: ${refund.id} for payment: ${refund.payment_id}`);
          const paymentId = refund.payment_id;
          const order = await findOrderByRazorpayPaymentId(paymentId);
          if (order) {
            await updateOrder(order.id, {
              refund_id: refund.id,
              refund_status: 'processed',
              refund_amount: (refund.amount || 0) / 100,
              refunded_at: new Date().toISOString()
            });
          }
        }
        break;
      }

      default:
        console.log(`[Razorpay Webhook] Unhandled event type: ${eventName}`);
    }

    return res.status(200).json({ status: 'ok', received: true });
  } catch (processErr) {
    console.error('[Razorpay Webhook] Error processing webhook event:', processErr);
    return res.status(500).json({ error: 'Webhook processing failed', details: processErr.message });
  }
};
