import { action } from './_generated/server';
import { v, ConvexError } from 'convex/values';

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new ConvexError({ code: 'UNREACHABLE', message: 'Unreachable' });
}

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (_ctx, args) => {
    await withRetry(async () => {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) throw new ConvexError({ code: 'CONFIG_ERROR', message: 'RESEND_API_KEY not configured' });
      const { Resend } = await import('resend');
      const resend = new Resend(resendApiKey);

      const { error } = await resend.emails.send({
        from: 'Rondas <noreply@rondas.app>',
        to: args.to,
        subject: args.subject,
        html: args.html,
      });

      if (error) {
        throw new ConvexError({ code: 'EMAIL_FAILED', message: `Email send failed: ${error.message}` });
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
      if (!token) throw new ConvexError({ code: 'CONFIG_ERROR', message: 'WHATSAPP_API_TOKEN not configured' });
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!phoneNumberId) throw new ConvexError({ code: 'CONFIG_ERROR', message: 'WHATSAPP_PHONE_NUMBER_ID not configured' });

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
        throw new ConvexError({ code: 'WHATSAPP_FAILED', message: `WhatsApp API error: ${response.status}` });
      }

      return await response.json();
    });
  },
});
