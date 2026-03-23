// api/verify-autologin.js — Vercel serverless function
// Validates a signed autologin token from the webhook email link.
// Token payload: `email|plan|period|expires_ms` signed with HMAC-SHA256.
// The frontend calls this to exchange a token for a verified session grant
// without ever putting a password in the URL.

import crypto from 'crypto';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { e, plan, period, exp, sig } = req.query;

  if (!e || !plan || !period || !exp || !sig) {
    return res.status(400).json({ ok: false, error: 'Missing parameters' });
  }

  // Check expiry (tokens are valid for 48 hours)
  if (Date.now() > Number(exp)) {
    return res.status(400).json({ ok: false, error: 'Link expired. Please log in manually.' });
  }

  const secret = process.env.AUTOLOGIN_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, error: 'Server misconfigured' });
  }

  // Recompute expected signature
  const payload  = `${e}|${plan}|${period}|${exp}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(sig.toLowerCase(), 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch (_) {
    valid = false;
  }

  if (!valid) {
    return res.status(400).json({ ok: false, error: 'Invalid or tampered link.' });
  }

  // All good — return verified grant (no password, no session created server-side)
  return res.status(200).json({
    ok: true,
    email: decodeURIComponent(e),
    plan,
    period,
  });
}
