// api/webhook.js — Vercel serverless function
// Proxies Lemon Squeezy webhooks to the Railway backend, which handles
// plan generation and sends the welcome email with the correct plan URL.

const RAILWAY = 'https://web-production-c136a.up.railway.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const signature =
      req.headers['x-signature'] ||
      req.headers['x-lemon-squeezy-signature'] ||
      '';

    const upstream = await fetch(`${RAILWAY}/webhook/lemonsqueezy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: rawBody,
    });

    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error('Webhook proxy error:', err);
    return res.status(500).json({ error: 'Failed to forward webhook', detail: err.message });
  }
}

// Extend timeout to 60s — Railway may need time for cold start + plan generation
export const config = { maxDuration: 60 };
