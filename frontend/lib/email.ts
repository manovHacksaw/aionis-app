export async function sendWelcomeEmail(
  email: string,
  followerAddress: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[email] Resend API key is missing. Skipping email dispatch.');
    return false;
  }

  // Resend free tier/test accounts must send from "onboarding@resend.dev"
  const from = 'Aionis Copy Trading <onboarding@resend.dev>';
  const subject = 'Welcome to Aionis Copy Trading!';
  
  const html = `
    <div style="font-family: sans-serif; background-color: #0d0d0d; color: #ffffff; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b; font-weight: 300; border-bottom: 1px solid #27272a; padding-bottom: 12px; margin-bottom: 20px;">Welcome to Aionis</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa;">
        Your wallet address <strong>${followerAddress}</strong> has successfully configured notification settings.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa;">
        You will receive real-time updates when your deployed copy-trading agents open or settle virtual positions on the Somnia Testnet.
      </p>
      <div style="margin: 30px 0; background-color: #141414; border: 1px solid #27272a; padding: 15px; border-radius: 8px;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #71717a; display: block; margin-bottom: 4px;">Registered Wallet</span>
        <code style="font-family: monospace; font-size: 13.5px; color: #f59e0b;">${followerAddress}</code>
      </div>
      <p style="font-size: 12px; color: #52525b; border-top: 1px solid #27272a; padding-top: 15px; margin-top: 30px;">
        Aionis is built on Somnia Shannon Testnet. All assets, including aUSD and STT, are simulated.
      </p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
      }),
    });

    if (res.ok) {
      console.log(`[email] Welcome email successfully sent via Resend to: ${email}`);
      return true;
    } else {
      const errorText = await res.text();
      console.error(
        `[email] Resend API error (status ${res.status}):`,
        errorText
      );
      return false;
    }
  } catch (err) {
    console.error('[email] Failed to dispatch email via Resend:', err);
    return false;
  }
}

export async function sendVerificationCode(
  email: string,
  code: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[email] Resend API key is missing. Skipping verification email.');
    return false;
  }

  const from = 'Aionis Copy Trading <onboarding@resend.dev>';
  const subject = `${code} is your Aionis verification code`;

  const html = `
    <div style="font-family: sans-serif; background-color: #0d0d0d; color: #ffffff; padding: 40px 20px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b; font-weight: 300; border-bottom: 1px solid #27272a; padding-bottom: 12px; margin-bottom: 20px;">Verify your email</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa;">
        Enter the code below in Aionis to confirm this email address. It expires in 10 minutes.
      </p>
      <div style="margin: 30px 0; background-color: #141414; border: 1px solid #27272a; padding: 18px; border-radius: 8px; text-align: center;">
        <span style="font-family: monospace; font-size: 28px; letter-spacing: 0.3em; color: #f59e0b;">${code}</span>
      </div>
      <p style="font-size: 12px; color: #52525b; border-top: 1px solid #27272a; padding-top: 15px; margin-top: 30px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
      }),
    });

    if (res.ok) {
      console.log(`[email] Verification code sent via Resend to: ${email}`);
      return true;
    } else {
      const errorText = await res.text();
      console.error(
        `[email] Resend API error (status ${res.status}):`,
        errorText
      );
      return false;
    }
  } catch (err) {
    console.error('[email] Failed to dispatch verification email via Resend:', err);
    return false;
  }
}
