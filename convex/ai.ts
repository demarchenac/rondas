import { action } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

const EXTRACTION_PROMPT = `You are an OCR assistant specialized in bills and receipts.

FIRST: Determine if this image is a bill, receipt, or invoice with visible line items. If it is NOT (e.g., a photo of food, a person, a landscape, a menu without prices, or any non-receipt image), return ONLY: {"error": "not_a_receipt"}

If it IS a valid bill/receipt, analyze it and extract EVERY line item exactly as printed, preserving the original order.

Return ONLY valid JSON (no markdown, no code fences):
{
  "category": "dining",
  "items": [
    { "name": "Item name", "quantity": 1, "subtotal": 35000.5 }
  ],
  "tax": 5000,
  "tip": 0,
  "total": 56000,
  "decimalPlaces": 1
}

Rules:
- "category": "dining" (restaurants, cafes, bars), "retail" (stores, supermarkets), or "service" (salons, repairs, subscriptions)
- All prices as numbers. Preserve decimal places exactly as printed on the receipt. Parse "$35.000" as 35000, "35,000" as 35000, "44.444,4" as 44444.4. Use the decimal separator from the receipt's locale (comma in Colombia, period in US)
- Focus on getting the subtotal (total per line) exactly right — unitPrice will be computed from subtotal / quantity
- IMPORTANT: Each line on the receipt must be its OWN separate item in the output. Do NOT merge or combine lines together. Examples:
  - "MEDM Original 61.600" → one item with subtotal 61600
  - "+Jamón 7.200" → a SEPARATE item with subtotal 7200
  - "Entera 0" → a SEPARATE item with subtotal 0
  - "S. Bechamel 0" → a SEPARATE item with subtotal 0
- Include items with subtotal = 0 (they are descriptors/modifiers)
- Skip lines that are purely internal codes (e.g., "50058", "80577") or notes (e.g., "NOTA", "NOTA!!!")
- Do NOT include summary/total lines as items. Skip lines labeled: subtotal, sub-total, sub total, total, neto, iva, impoconsumo, impuesto, tax, propina, propina voluntaria, tip, gratuity, service charge, servicio, cargo por servicio, cambio, vueltas, change, descuento total, total descuento, base gravable, base
- Include discount/deduction lines with NEGATIVE subtotal values. Example: "Descuento -5.000" → { "name": "Descuento", "quantity": 1, "unitPrice": -5000, "subtotal": -5000 }
- Include IVA/impoconsumo/sales tax in the "tax" field, NOT as items
- Include propina/tip/gratuity in the "tip" field, NOT as items
- If quantity is not explicit, assume 1
- "decimalPlaces": the number of decimal places used in the receipt's prices (0 if all prices are whole numbers, 1 if prices like "44.444,4", 2 if prices like "35.50")`;

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
  decimalPlaces?: number;
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
        const quantity = Math.max(1, Math.round(item.quantity || 1));
        const subtotal = item.subtotal || 0;
        items.push({
          name: item.name,
          quantity,
          unitPrice: subtotal / quantity,
          subtotal,
        });
      }
    } catch {
      // Incomplete object
    }
  }

  return items;
}

const SUMMARY_PATTERN = /^(sub\s*total|total|neto|iva|impoconsumo|impuesto|tax|propina(\s+voluntaria)?|tip|gratuity|service\s*charge|servicio|cargo\s+por\s+servicio|cambio|vueltas|change|(total\s+)?descuento|base(\s+gravable)?)(\s+[\d\s.,]*)?$/;

function sanitizeItems(items: BillItem[]): BillItem[] {
  const filtered = items
    .map((item) => {
      const quantity = Math.max(1, Math.round(item.quantity || 1));
      const subtotal = item.subtotal ?? 0;
      return {
        name: item.name || 'Unknown item',
        quantity,
        unitPrice: subtotal / quantity,
        subtotal,
      };
    })
    .filter((item) => {
      const name = item.name.trim();
      if (/^nota[!]*$/i.test(name) || /^\d{4,}$/.test(name)) return false;
      const nameLower = name.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, '');
      if (SUMMARY_PATTERN.test(nameLower.trim())) return false;
      if (item.subtotal === 0) return false;
      return true;
    });
  const grouped: BillItem[] = [];
  for (const item of filtered) {
    const key = `${item.name.trim().toLowerCase()}|${item.unitPrice}`;
    const existing = grouped.find(
      (g) => `${g.name.trim().toLowerCase()}|${g.unitPrice}` === key,
    );
    if (existing) {
      existing.quantity += item.quantity;
      existing.subtotal += item.subtotal;
      existing.unitPrice = existing.subtotal / existing.quantity;
    } else {
      const trimmed = item.name.trim();
      const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      grouped.push({ ...item, name: normalized });
    }
  }
  const positive = grouped.filter((i) => i.subtotal > 0);
  const negative = grouped.filter((i) => i.subtotal < 0);
  return [...positive, ...negative];
}

export const extractBillItems = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(),
    scanId: v.id('scans'),
    userId: v.string(),
    isPro: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ExtractedBill> => {
    const proStatus = await ctx.runQuery(api.users.getProStatus, { workosId: args.userId });
    const TRIAL_BILL_LIMIT = 2;
    const isPro = args.isPro === true || proStatus.proOverride;
    const inTrial = proStatus.totalBillsCreated < TRIAL_BILL_LIMIT;

    if (!isPro && !inTrial) {
      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        userId: args.userId,
        status: 'error',
        error: 'pro_required',
      });
      throw new Error('pro_required');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        userId: args.userId,
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
            thinking_config: { thinking_budget: 512 },
          },
        }),
      });
    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const errorMsg = isTimeout ? 'Gemini API request timed out after 60s' : `Gemini API request failed: ${err}`;
      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        userId: args.userId,
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
        userId: args.userId,
        status: 'error',
        error: `Gemini API error (${response.status})`,
      });
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    if (!response.body) throw new Error('No response body');
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
              await ctx.runMutation(api.scans.updateScan, {
                id: args.scanId,
                userId: args.userId,
                status: 'thinking',
              });
            }

            if (part.text !== undefined && !part.thought) {
              if (!hasReportedExtracting) {
                hasReportedExtracting = true;
                await ctx.runMutation(api.scans.updateScan, {
                  id: args.scanId,
                  userId: args.userId,
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
                  userId: args.userId,
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
        userId: args.userId,
        status: 'error',
        error: 'No response from Gemini API',
      });
      throw new Error('No response from Gemini API');
    }

    const cleaned = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();

    try {
      const parsed = JSON.parse(cleaned);

      if (parsed.error === 'not_a_receipt') {
        await ctx.runMutation(api.scans.updateScan, {
          id: args.scanId,
          userId: args.userId,
          status: 'error',
          error: 'not_a_receipt',
        });
        throw new Error('not_a_receipt');
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

      await ctx.runMutation(api.scans.updateScan, {
        id: args.scanId,
        userId: args.userId,
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
        userId: args.userId,
        status: 'error',
        error: `Failed to parse response: ${cleaned.slice(0, 100)}`,
      });
      throw new Error(`Failed to parse Gemini response as JSON: ${cleaned.slice(0, 200)}`);
    }
  },
});
