const { Resend } = require('resend');
const crypto = require('crypto');

const resend = new Resend(process.env.RESEND_API_KEY);

// ── HELPERS ──────────────────────────────────────────────────────

// Cryptographically secure password generator (replaces Math.random)
function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  return pwd;
}

// Generate a signed autologin token (no password in URL)
function generateAutologinToken(email, plan, period) {
  const secret = process.env.AUTOLOGIN_SECRET;
  if (!secret) throw new Error('AUTOLOGIN_SECRET env var not set');
  const exp = Date.now() + 48 * 60 * 60 * 1000; // 48 hours
  const payload = `${email}|${plan}|${period}|${exp}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return { exp, sig };
}

// Verify Lemon Squeezy webhook signature
function verifyLemonSqueezySignature(rawBody, signature) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('LEMON_SQUEEZY_WEBHOOK_SECRET not set — skipping signature check');
    return true; // Allow in dev; set the secret in production
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature || '', 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch (_) {
    return false;
  }
}

// Determine plan key from product name
function getPlanKey(productName) {
  const n = productName.toLowerCase();
  if (n.includes('complete')) return 'complete';
  if (n.includes('nutrition')) return 'nutrition';
  if (n.includes('fitness')) return 'fitness';
  return 'complete';
}

// ── HANDLER ──────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify signature before touching any data
  const signature = req.headers['x-signature'] || req.headers['x-lemon-squeezy-signature'] || '';
  const rawBody   = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (!verifyLemonSqueezySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  try {
    const event     = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventName = event?.meta?.event_name;

    if (eventName !== 'subscription_created' && eventName !== 'order_created') {
      return res.status(200).json({ received: true });
    }

    const customerEmail = event?.data?.attributes?.user_email;
    const customerName  = event?.data?.attributes?.user_name || 'there';
    const productName   = event?.data?.attributes?.product_name || 'GetPhysIQ Plan';
    const variantName   = event?.data?.attributes?.variant_name || '';
    const period        = variantName.toLowerCase().includes('year') ? 'yearly' : 'monthly';

    if (!customerEmail) {
      return res.status(400).json({ error: 'No customer email' });
    }

    const planKey   = getPlanKey(productName);
    const password  = generatePassword();
    const firstName = customerName.split(' ')[0];

    // Build signed autologin token for the email CTA link
    let autologinParams = '';
    try {
      const { exp, sig } = generateAutologinToken(customerEmail, planKey, period);
      autologinParams = `?autologin=1&e=${encodeURIComponent(customerEmail)}&plan=${planKey}&period=${period}&exp=${exp}&sig=${sig}`;
    } catch (tokenErr) {
      console.warn('Could not generate autologin token:', tokenErr.message);
      autologinParams = '?plan=ready';
    }

    const planUrl = `https://getphysiq.fit/plans.html${autologinParams}`;

    const isComplete  = planKey === 'complete';
    const isNutrition = planKey === 'nutrition';
    const isFitness   = planKey === 'fitness';

    const workoutSection = (isComplete || isFitness) ? `
      <div style="background:#0d0d12;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:18px 20px;margin-bottom:12px;">
        <div style="font-size:.95rem;font-weight:800;color:#f2f2f8;margin-bottom:6px;">💪 Workout Plan Included</div>
        <div style="font-size:.82rem;color:#737380;line-height:1.6;">Personalised weekly workout schedule built around your body, goals and schedule.</div>
      </div>` : '';

    const nutritionSection = (isComplete || isNutrition) ? `
      <div style="background:#0d0d12;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:18px 20px;margin-bottom:12px;">
        <div style="font-size:.95rem;font-weight:800;color:#f2f2f8;margin-bottom:6px;">🥗 Nutrition Plan Included</div>
        <div style="font-size:.82rem;color:#737380;line-height:1.6;">Daily meal plan with macros, calories and recipes matched to your targets.</div>
      </div>` : '';

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#07070b;font-family:Arial,sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:40px 24px;">

  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:1.6rem;font-weight:800;letter-spacing:-.03em;background:linear-gradient(135deg,#5b8af0,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block;">GetPhysIQ</div>
  </div>

  <div style="background:linear-gradient(135deg,rgba(91,138,240,.15),rgba(139,92,246,.15));border:1px solid rgba(91,138,240,.25);border-radius:20px;padding:28px 24px;text-align:center;margin-bottom:24px;">
    <div style="font-size:2.2rem;margin-bottom:12px;">🎉</div>
    <div style="font-size:1.3rem;font-weight:800;color:#f2f2f8;margin-bottom:8px;">You're in, ${firstName}!</div>
    <div style="font-size:.85rem;color:#737380;line-height:1.6;">Your <strong style="color:#f2f2f8;">${productName}</strong> is now active.<br/>Your transformation starts today.</div>
  </div>

  ${workoutSection}
  ${nutritionSection}

  <!-- LOGIN CREDENTIALS -->
  <div style="background:#0d0d12;border:1.5px solid rgba(91,138,240,.3);border-radius:16px;padding:22px 20px;margin-bottom:24px;">
    <div style="font-size:.7rem;font-weight:700;color:#737380;text-transform:uppercase;letter-spacing:.09em;margin-bottom:14px;">Your Login Details</div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.85rem;">
      <span style="color:#737380;">Email</span>
      <span style="color:#f2f2f8;font-weight:700;">${customerEmail}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;font-size:.85rem;">
      <span style="color:#737380;">Password</span>
      <span style="color:#5b8af0;font-weight:800;font-size:1.1rem;letter-spacing:.08em;">${password}</span>
    </div>
    <div style="font-size:.72rem;color:#3a3a46;margin-top:10px;line-height:1.6;">Save this password — you'll need it if you log in on a new device.</div>
  </div>

  <!-- CTA — signed token link, no password in URL -->
  <div style="text-align:center;margin:28px 0;">
    <a href="${planUrl}" style="display:inline-block;background:linear-gradient(135deg,#5b8af0,#8b5cf6);color:#fff;font-weight:800;font-size:.95rem;padding:16px 40px;border-radius:50px;text-decoration:none;letter-spacing:-.01em;">View My Plan →</a>
  </div>

  <div style="background:#0d0d12;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:20px;margin-bottom:24px;">
    <div style="font-size:.72rem;font-weight:700;color:#737380;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">What happens next</div>
    <div style="font-size:.82rem;color:#737380;line-height:2;">
      ✅ Click the button above for instant one-click access<br/>
      💪 Your personalised plan is generated instantly<br/>
      🔄 Plans regenerate every 4 weeks automatically<br/>
      ↩️ Cancel anytime from your Lemon Squeezy receipt
    </div>
  </div>

  <div style="text-align:center;font-size:.72rem;color:#3a3a46;line-height:1.8;">
    Questions? <a href="mailto:hello@getphysiq.fit" style="color:#5b8af0;">hello@getphysiq.fit</a>
  </div>

</div>
</body>
</html>`;

    await resend.emails.send({
      from: 'GetPhysIQ <plans@getphysiq.fit>',
      to: customerEmail,
      subject: `🎉 Your ${productName} is ready — here's your login`,
      html: emailHtml,
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
