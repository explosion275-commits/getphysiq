// api/plan.js — Vercel serverless proxy for Railway plan endpoint
// Fetches the plan from Railway server-side (no browser CORS restrictions),
// retrying through Railway cold-start 503s before giving up.

const RAILWAY = 'https://web-production-c136a.up.railway.app';

async function upstreamFetch(token, retries = 8, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${RAILWAY}/api/plan?token=${encodeURIComponent(token)}`);
    if (res.status === 503 && i < retries - 1) {
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    return res;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    const upstream = await upstreamFetch(token);
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(503).json({ error: 'Backend unavailable', detail: err.message });
  }
}
