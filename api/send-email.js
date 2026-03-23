// api/send-email.js — Vercel serverless function: Resend email proxy
// All email sends go through here so the Resend API key is never exposed in the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    // Email not configured — silently succeed so the UI flow isn't blocked
    console.warn('RESEND_API_KEY not set — skipping email');
    return res.status(200).json({ sent: false, reason: 'not_configured' });
  }

  const { to, subject, html, from, reply_to } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }

  try {
    const upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + resendKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || 'GetPhysIQ <plans@getphysiq.fit>',
        to,
        subject,
        html,
        ...(reply_to ? { reply_to } : {}),
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Resend error:', data);
      return res.status(upstream.status).json({ error: data?.message || 'Email send failed' });
    }

    return res.status(200).json({ sent: true, id: data.id });
  } catch (err) {
    console.error('Email proxy error:', err);
    return res.status(500).json({ error: 'Email request failed' });
  }
}
