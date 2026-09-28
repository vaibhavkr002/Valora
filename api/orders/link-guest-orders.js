/**
 * POST /api/orders/link-guest-orders
 * 
 * Secure Server-Authoritative Endpoint:
 * 1. Receives customer's Supabase JWT access token via Authorization header
 * 2. Verifies the token authoritatively with Supabase Auth (/auth/v1/user)
 * 3. Enforces that account email is verified (email_confirmed_at / confirmed_at / provider)
 * 4. Normalizes email (trim().toLowerCase())
 * 5. Finds and claims past guest orders (user_id IS NULL) matching this verified email
 * 6. Updates user_id = user.id safely and idempotently
 * 7. Returns { success: true, linked_count: N }
 */

const { getSupabaseConfig, linkGuestOrdersByEmail } = require('../_lib/supabaseAdmin');

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
    // Extract access token from Authorization header or body
    let token = null;
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token && req.body) {
      let parsedBody = req.body;
      if (typeof parsedBody === 'string') {
        try { parsedBody = JSON.parse(parsedBody); } catch (_) {}
      }
      token = parsedBody?.access_token || parsedBody?.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required.',
        code: 'UNAUTHENTICATED'
      });
    }

    const { url, key } = getSupabaseConfig();

    // 1. Authoritatively verify user token with Supabase Auth
    const userRes = await fetch(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!userRes.ok) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session. Please sign in again.',
        code: 'INVALID_TOKEN'
      });
    }

    const authUser = await userRes.json();
    if (!authUser || !authUser.id || !authUser.email) {
      return res.status(400).json({
        success: false,
        error: 'User profile does not contain a valid email address.',
        code: 'MISSING_EMAIL'
      });
    }

    // 2. Strict Email Verification Check
    const isConfirmed = Boolean(
      authUser.email_confirmed_at || 
      authUser.confirmed_at || 
      (authUser.app_metadata && authUser.app_metadata.provider && authUser.app_metadata.provider !== 'email')
    );

    // If email is not confirmed, forbid order linking to prevent unauthorized claims
    if (!isConfirmed) {
      return res.status(403).json({
        success: false,
        error: 'Email address is not yet verified. Please verify your email to view past guest orders.',
        code: 'EMAIL_NOT_VERIFIED',
        is_verified: false
      });
    }

    const normalizedEmail = authUser.email.trim().toLowerCase();
    const userId = authUser.id;

    // 3. Atomically and idempotently link past guest orders
    const result = await linkGuestOrdersByEmail(userId, normalizedEmail, token);

    return res.status(200).json({
      success: true,
      linked_count: result.linked_count || 0,
      user_id: userId,
      email: normalizedEmail
    });
  } catch (error) {
    console.error('[API link-guest-orders] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while linking orders.'
    });
  }
};
