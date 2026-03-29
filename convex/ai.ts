import { action } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

const EXTRACTION_PROMPT = `You are an OCR assistant specialized in bills and receipts.

Analyze this bill/receipt image and extract EVERY line item exactly as printed on the receipt, preserving the original order.

Return ONLY valid JSON (no markdown, no code fences):
{
  "category": "dining",
  "items": [
    { "name": "Item name", "quantity": 1, "unitPrice": 35000, "subtotal": 35000 }
  ],
  "tax": 5000,
  "tip": 0,
  "total": 56000
}

Rules:
- "category": "dining" (restaurants, cafes, bars), "retail" (stores, supermarkets), or "service" (salons, repairs, subscriptions)
- All prices as integers (no decimals). Parse "$35.000", "35,000", "35000" correctly
- IMPORTANT: Each line on the receipt must be its OWN separate item in the output. Do NOT merge or combine lines together. Examples:
  - "MEDM Original 61.600" → one item with subtotal 61600
  - "+Jamón 7.200" → a SEPARATE item with subtotal 7200
  - "Entera 0" → a SEPARATE item with subtotal 0
  - "S. Bechamel 0" → a SEPARATE item with subtotal 0
- Include items with subtotal = 0 (they are descriptors/modifiers)
- Skip lines that are purely internal codes (e.g., "50058", "80577") or notes (e.g., "NOTA", "NOTA!!!")
- Include IVA/impoconsumo/sales tax if shown separately
- Include propina/tip/gratuity if shown
- If quantity is not explicit, assume 1`;

interface BillItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface ExtractedBill {
  category: 'dining' | 'retail' | 'service';
  items: BillItem[];
  tax: number;
  tip: number;
  total: number;
}

/**
 * Extract complete item objects from partial JSON stream.
 */
function extractCompleteItems(jsonSoFar: string): BillItem[] {
  const itemsMatch = jsonSoFar.match(/"items"\s*:\s*\[/);
  if (!itemsMatch || itemsMatch.index === undefined) return [];

  const afterItems = jsonSoFar.slice(itemsMatch.index + itemsMatch[0].length);
  const items: BillItem[] = [];

  const objectRegex = /\{[^{}]*\}/g;
  let match;
  while ((match = objectRegex.exec(afterItems)) !== null) {
    try {
      const item = JSON.parse(match[0]);
      if (item.name && typeof item.subtotal === 'number') {
        items.push({
          name: item.name,
          quantity: Math.max(1, Math.round(item.quantity || 1)),
          unitPrice: Math.round(item.unitPrice || 0),
          subtotal: Math.round(item.subtotal || 0),
        });
      }
    } catch {
      // Incomplete object
    }
  }

  return items;
}

function sanitizeItems(items: BillItem[]): BillItem[] {
  return items
    .map((item) => ({
      name: item.name || 'Unknown item',
      quantity: Math.max(1, Math.round(item.quantity || 1)),
      unitPrice: Math.round(item.unitPrice || 0),
      subtotal: Math.round(item.subtotal || 0),
    }))
    .filter((item) => {
      const name = item.name.trim();
      if (/^nota[!]*$/i.test(name) || /^\d{4,}$/.test(name)) return false;
      if (item.subtotal <= 0) return false;
      return true;
    });
}

export const extractBillItems = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(),
    scanId: v.id('scans'),
  },
  handler: async (ctx, args): Promise<ExtractedBill> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        status: 'error',
        error: 'GEMINI_API_KEY not configured',
      });
      throw new Error('GEMINI_API_KEY not configured. Run: npx convex env set GEMINI_API_KEY <key>');
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
            thinking_config: { thinking_budget: 1024 },
          },
        }),
      });
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const errorMsg = isTimeout ? 'Gemini API request timed out after 60s' : `Gemini API request failed: ${err}`;
      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        status: 'error',
        error: errorMsg,
      });
      throw new Error(errorMsg);
    }

    if (!response.ok) {
      clearTimeout(timeout);
      const error = await response.text();
      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        status: 'error',
        error: `Gemini API error (${response.status})`,
      });
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const reader = response.body!.getReader();
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
              await ctx.runMutation(api.scans.updateScan, {
                id: args.scanId,
                status: 'thinking',
              });
            }

            if (part.text !== undefined && !part.thought) {
              if (!hasReportedExtracting) {
                hasReportedExtracting = true;
                await ctx.runMutation(api.scans.updateScan, {
                  id: args.scanId,
                  status: 'extracting',
                });
              }
              jsonText += part.text;

              // Stream items incrementally
              const rawItems = extractCompleteItems(jsonText);
              const items = sanitizeItems(rawItems);
              if (items.length > lastItemCount) {
                lastItemCount = items.length;
                await ctx.runMutation(api.scans.updateScan, {
                  id: args.scanId,
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
      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        status: 'error',
        error: 'No response from Gemini API',
      });
      throw new Error('No response from Gemini API');
    }

    const cleaned = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();

    try {
      const parsed: ExtractedBill = JSON.parse(cleaned);

      const validCategories = ['dining', 'retail', 'service'] as const;
      const category = validCategories.includes(parsed.category as any)
        ? parsed.category
        : 'dining';

      const items = sanitizeItems(parsed.items || []);

      const result: ExtractedBill = {
        category,
        items,
        tax: Math.round(parsed.tax || 0),
        tip: Math.round(parsed.tip || 0),
        total: Math.round(parsed.total || 0),
      };

      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        status: 'complete',
        result: {
          ...result,
          category: result.category as string,
        },
      });

      return result;
    } catch {
      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        status: 'error',
        error: `Failed to parse response: ${cleaned.slice(0, 100)}`,
      });
      throw new Error(`Failed to parse Gemini response as JSON: ${cleaned.slice(0, 200)}`);
    }
  },
});
