const RAILWAY = 'https://web-production-c136a.up.railway.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const upstream = await fetch(`${RAILWAY}/api/plan/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(503).json({ error: 'Backend unavailable', detail: err.message });
  }
}

export const config = { maxDuration: 60 };
