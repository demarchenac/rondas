import { action } from './_generated/server';
import { v } from 'convex/values';

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('Unreachable');
}

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (_ctx, args) => {
    await withRetry(async () => {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      const { error } = await resend.emails.send({
        from: 'Rondas <noreply@rondas.app>',
        to: args.to,
        subject: args.subject,
        html: args.html,
      });

      if (error) {
        throw new Error(`Email send failed: ${error.message}`);
      }
    });
  },
});

export const sendWhatsApp = action({
  args: {
    to: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, args) => {
    return await withRetry(async () => {
      const token = process.env.WHATSAPP_API_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: args.to,
            type: 'text',
            text: { body: args.message },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.status}`);
      }

      return await response.json();
    });
  },
});
