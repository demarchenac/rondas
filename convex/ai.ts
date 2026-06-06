import { action } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { internal } from './_generated/api';
import { getAuthUserId } from './model/auth';
import {
  GEMINI_STREAM_URL,
  EXTRACTION_PROMPT,
  extractCompleteItems,
  sanitizeItems,
  type ExtractedBill,
} from './model/ai';

export const extractBillItems = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(),
    scanId: v.id('scans'),
    isPro: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ExtractedBill> => {
    const userId = await getAuthUserId(ctx);
    const proStatus = await ctx.runQuery(internal.users.internalGetProStatus, { workosId: userId });
    const TRIAL_BILL_LIMIT = 2;
    const isPro = args.isPro === true || proStatus.proOverride;
    const inTrial = proStatus.totalBillsCreated < TRIAL_BILL_LIMIT;

    if (!isPro && !inTrial) {
      await ctx.runMutation(internal.scans.updateScan, {
        id: args.scanId,
        userId: userId,
        status: 'error',
        error: 'pro_required',
      });
      throw new ConvexError({ code: 'PRO_REQUIRED', message: 'pro_required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.scans.updateScan, {
        id: args.scanId,
        userId: userId,
        status: 'error',
        error: 'GEMINI_API_KEY not configured',
      });
      throw new ConvexError({ code: 'CONFIG_ERROR', message: 'GEMINI_API_KEY not configured' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let response: Response;
    try {
      response = await fetch(`${GEMINI_STREAM_URL}&key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: args.mimeType,
                    data: args.imageBase64,
                  },
                },
                { text: EXTRACTION_PROMPT },
              ],
            },
          ],
          generationConfig: {
            thinking_config: { thinking_budget: 512 },
          },
        }),
      });
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const errorMsg = isTimeout ? 'Gemini API request timed out after 60s' : `Gemini API request failed: ${err}`;
      await ctx.runMutation(internal.scans.updateScan, {
        id: args.scanId,
        userId: userId,
        status: 'error',
        error: errorMsg,
      });
      throw new ConvexError({ code: 'API_ERROR', message: errorMsg });
    }

    if (!response.ok) {
      clearTimeout(timeout);
      const error = await response.text();
      await ctx.runMutation(internal.scans.updateScan, {
        id: args.scanId,
        userId: userId,
        status: 'error',
        error: `Gemini API error (${response.status})`,
      });
      throw new ConvexError({ code: 'API_ERROR', message: `Gemini API error (${response.status}): ${error}` });
    }

    if (!response.body) throw new ConvexError({ code: 'API_ERROR', message: 'No response body' });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let jsonText = '';
    let hasReportedThinking = false;
    let hasReportedExtracting = false;
    let lastItemCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        clearTimeout(timeout);
        break;
      }

      sseBuffer += decoder.decode(value, { stream: true });

      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const chunk = JSON.parse(data);
          const parts = chunk.candidates?.[0]?.content?.parts;
          if (!parts) continue;

          for (const part of parts) {
            if (part.thought && !hasReportedThinking) {
              hasReportedThinking = true;
              await ctx.runMutation(internal.scans.updateScan, {
                id: args.scanId,
                userId: userId,
                status: 'thinking',
              });
            }

            if (part.text !== undefined && !part.thought) {
              if (!hasReportedExtracting) {
                hasReportedExtracting = true;
                await ctx.runMutation(internal.scans.updateScan, {
                  id: args.scanId,
                  userId: userId,
                  status: 'extracting',
                });
              }
              jsonText += part.text;

              // Stream items incrementally
              const rawItems = extractCompleteItems(jsonText);
              const items = sanitizeItems(rawItems);
              if (items.length > lastItemCount) {
                lastItemCount = items.length;
                await ctx.runMutation(internal.scans.updateScan, {
                  id: args.scanId,
                  userId: userId,
                  status: 'extracting',
                  result: {
                    category: 'dining',
                    items,
                    tax: 0,
                    tip: 0,
                    total: 0,
                  },
                });
              }
            }
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }

    if (!jsonText) {
      await ctx.runMutation(internal.scans.updateScan, {
        id: args.scanId,
        userId: userId,
        status: 'error',
        error: 'No response from Gemini API',
      });
      throw new ConvexError({ code: 'API_ERROR', message: 'No response from Gemini API' });
    }

    const cleaned = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();

    try {
      const parsed = JSON.parse(cleaned);

      if (parsed.error === 'not_a_receipt') {
        await ctx.runMutation(internal.scans.updateScan, {
          id: args.scanId,
          userId: userId,
          status: 'error',
          error: 'not_a_receipt',
        });
        throw new ConvexError({ code: 'NOT_A_RECEIPT', message: 'not_a_receipt' });
      }

      const bill = parsed as ExtractedBill;

      const validCategories: readonly string[] = ['dining', 'retail', 'service'];
      const category = validCategories.includes(bill.category)
        ? bill.category
        : 'dining';

      const items = sanitizeItems(bill.items || []);

      const decimalPlaces = typeof bill.decimalPlaces === 'number' ? Math.max(0, Math.min(bill.decimalPlaces, 4)) : undefined;

      const result: ExtractedBill = {
        category,
        items,
        tax: bill.tax || 0,
        tip: bill.tip || 0,
        total: bill.total || 0,
        decimalPlaces,
      };

      await ctx.runMutation(internal.scans.updateScan, {
        id: args.scanId,
        userId: userId,
        status: 'complete',
        result: {
          ...result,
          category: result.category as string,
        },
      });

      return result;
    } catch {
      await ctx.runMutation(internal.scans.updateScan, {
        id: args.scanId,
        userId: userId,
        status: 'error',
        error: `Failed to parse response: ${cleaned.slice(0, 100)}`,
      });
      throw new ConvexError({ code: 'PARSE_ERROR', message: `Failed to parse Gemini response: ${cleaned.slice(0, 100)}` });
    }
  },
});
