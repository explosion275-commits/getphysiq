const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;
    const eventName = event?.meta?.event_name;

    // Only handle successful subscription payments
    if (eventName !== 'subscription_created' && eventName !== 'order_created') {
      return res.status(200).json({ received: true });
    }

    const customerEmail = event?.data?.attributes?.user_email;
    const customerName  = event?.data?.attributes?.user_name || 'there';
    const productName   = event?.data?.attributes?.product_name || 'GetPhysIQ Plan';
    const variantName   = event?.data?.attributes?.variant_name || '';

    if (!customerEmail) {
      return res.status(400).json({ error: 'No customer email' });
    }

    // Determine what they bought
    const isComplete  = productName.toLowerCase().includes('complete');
    const isNutrition = productName.toLowerCase().includes('nutrition');
    const isFitness   = productName.toLowerCase().includes('fitness');

    // Build plan sections
    const workoutSection = (isComplete || isFitness) ? `
      <div style="background:#0d0d12;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:20px;margin-bottom:16px;">
        <div style="font-size:1rem;font-weight:800;color:#f2f2f8;margin-bottom:8px;">💪 Your Workout Plan is Ready</div>
        <div style="font-size:.85rem;color:#737380;line-height:1.7;">Log in to <a href="https://getphysiq.fit" style="color:#5b8af0;">getphysiq.fit</a> to access your personalised weekly workout plan. It's been generated based on your quiz answers and is ready to view.</div>
      </div>` : '';

    const nutritionSection = (isComplete || isNutrition) ? `
      <div style="background:#0d0d12;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:20px;margin-bottom:16px;">
        <div style="font-size:1rem;font-weight:800;color:#f2f2f8;margin-bottom:8px;">🥗 Your Nutrition Plan is Ready</div>
        <div style="font-size:.85rem;color:#737380;line-height:1.7;">Your personalised meal plan with macros, calories and daily meals is ready. Log in to <a href="https://getphysiq.fit" style="color:#5b8af0;">getphysiq.fit</a> to view it.</div>
      </div>` : '';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#07070b;font-family:'Sora',sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:1.6rem;font-weight:800;letter-spacing:-.03em;background:linear-gradient(135deg,#5b8af0,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block;">GetPhysIQ</div>
    </div>

    <!-- Hero -->
    <div style="background:linear-gradient(135deg,rgba(91,138,240,.15),rgba(139,92,246,.15));border:1px solid rgba(91,138,240,.25);border-radius:20px;padding:28px 24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:2.5rem;margin-bottom:12px;">🎉</div>
      <div style="font-size:1.4rem;font-weight:800;color:#f2f2f8;margin-bottom:8px;letter-spacing:-.03em;">You're in, ${customerName.split(' ')[0]}!</div>
      <div style="font-size:.85rem;color:#737380;line-height:1.6;">Your <strong style="color:#f2f2f8;">${productName}</strong> is now active.<br/>Your transformation starts today.</div>
    </div>

    <!-- Plans -->
    ${workoutSection}
    ${nutritionSection}

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="https://getphysiq.fit?plan=ready" style="display:inline-block;background:linear-gradient(135deg,#5b8af0,#8b5cf6);color:#fff;font-weight:800;font-size:.95rem;padding:16px 40px;border-radius:50px;text-decoration:none;letter-spacing:-.01em;">View My Plan →</a>
    </div>

    <!-- What's next -->
    <div style="background:#0d0d12;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:20px;margin-bottom:24px;">
      <div style="font-size:.75rem;font-weight:700;color:#737380;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">What happens next</div>
      <div style="font-size:.82rem;color:#737380;line-height:2;">
        ✅ Your plan is live at getphysiq.fit<br/>
        🔄 Plans regenerate every 4 weeks automatically<br/>
        📱 Access anytime from any device<br/>
        ↩️ Cancel anytime from your Lemon Squeezy receipt
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;font-size:.72rem;color:#3a3a46;line-height:1.8;">
      You're receiving this because you subscribed to GetPhysIQ.<br/>
      Questions? Reply to this email or contact <a href="mailto:hello@getphysiq.fit" style="color:#5b8af0;">hello@getphysiq.fit</a>
    </div>

  </div>
</body>
</html>`;

    await resend.emails.send({
      from: 'GetPhysIQ <plans@getphysiq.fit>',
      to: customerEmail,
      subject: `🎉 Your ${productName} is ready, ${customerName.split(' ')[0]}!`,
      html: emailHtml,
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
