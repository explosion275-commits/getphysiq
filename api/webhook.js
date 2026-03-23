const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple password generator
function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

// Determine plan key from product name
function getPlanKey(productName) {
  const n = productName.toLowerCase();
  if (n.includes('complete')) return 'complete';
  if (n.includes('nutrition')) return 'nutrition';
  if (n.includes('fitness')) return 'fitness';
  return 'complete';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;
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

    const planKey  = getPlanKey(productName);
    const password = generatePassword();
    const firstName = customerName.split(' ')[0];

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
    <div style="font-size:.72rem;color:#3a3a46;margin-top:10px;line-height:1.6;">Save this password — you'll need it to log in to GetPhysIQ.</div>
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin:28px 0;">
    <a href="https://getphysiq.fit?plan=ready" style="display:inline-block;background:linear-gradient(135deg,#5b8af0,#8b5cf6);color:#fff;font-weight:800;font-size:.95rem;padding:16px 40px;border-radius:50px;text-decoration:none;letter-spacing:-.01em;">View My Plan →</a>
  </div>

  <div style="background:#0d0d12;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:20px;margin-bottom:24px;">
    <div style="font-size:.72rem;font-weight:700;color:#737380;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">What happens next</div>
    <div style="font-size:.82rem;color:#737380;line-height:2;">
      ✅ Log in with the password above<br/>
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

    // Store user credentials in KV or just return them
    // Since we have no DB, we store the hashed password in the webhook response
    // The main app reads from localStorage — but we need to pre-create the user
    // We do this by calling a special endpoint on the same app
    // For now: store in a Vercel KV if available, otherwise the email IS the credential
    // The app will auto-create the user on first login with this password

    return res.status(200).json({
      success: true,
      // Return for debugging only — remove in production
      _debug: { email: customerEmail, plan: planKey, period }
    });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
