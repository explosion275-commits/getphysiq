const RAILWAY = 'https://web-production-c136a.up.railway.app';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.query;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  try {
    const upstream = await fetch(
      `${RAILWAY}/api/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    );
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(503).json({ error: 'Backend unavailable', detail: err.message });
  }
}

export const config = { maxDuration: 30 };
