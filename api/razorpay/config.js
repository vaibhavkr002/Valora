/**
 * GET /api/razorpay/config
 * Returns public Razorpay Key ID for client Checkout SDK.
 * Secrets are never exposed.
 */

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID ? String(process.env.RAZORPAY_KEY_ID).trim() : null;
  if (!keyId) {
    return res.status(500).json({
      success: false,
      error: 'RAZORPAY_KEY_ID is not configured on the server.'
    });
  }

  const isTest = keyId.startsWith('rzp_test_');

  return res.status(200).json({
    success: true,
    key_id: keyId,
    is_test: isTest
  });
};
