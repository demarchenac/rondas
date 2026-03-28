import { action } from './_generated/server';
import { v } from 'convex/values';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EXTRACTION_PROMPT = `You are an OCR assistant specialized in bills and receipts.

Analyze this bill/receipt image and extract ALL line items, taxes, and total.
Also classify the type of receipt.

Return ONLY valid JSON in this exact format:
{
  "category": "dining",
  "items": [
    {
      "name": "Item name",
      "quantity": 1,
      "unitPrice": 35000,
      "subtotal": 35000
    }
  ],
  "tax": 5000,
  "tip": 0,
  "total": 56000
}

Rules:
- "category" must be one of: "dining" (restaurants, cafes, bars), "retail" (stores, supermarkets), "service" (salons, repairs, subscriptions)
- All prices as integers (no decimals)
- Parse formats like "$35.000", "35,000", "35000", "35.00" correctly
- Include IVA/impoconsumo/sales tax if shown separately
- Include propina/tip/gratuity if shown
- If total is not visible, calculate from items + tax + tip
- If quantity is not explicit, assume 1
- Keep original item names as they appear on the receipt`;

interface ExtractedBill {
  category: 'dining' | 'retail' | 'service';
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  tax: number;
  tip: number;
  total: number;
}

export const extractBillItems = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (_ctx, args): Promise<ExtractedBill> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured. Run: npx convex env set GEMINI_API_KEY <key>');
    }

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
              {
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          thinking_config: { thinking_budget: 0 },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response from Gemini API');
    }

    try {
      const parsed: ExtractedBill = JSON.parse(text);

      // Validate and sanitize
      const validCategories = ['dining', 'retail', 'service'] as const;
      const category = validCategories.includes(parsed.category as any)
        ? parsed.category
        : 'dining';

      return {
        category,
        items: (parsed.items || []).map((item) => ({
          name: item.name || 'Unknown item',
          quantity: Math.max(1, Math.round(item.quantity || 1)),
          unitPrice: Math.round(item.unitPrice || 0),
          subtotal: Math.round(item.subtotal || 0),
        })),
        tax: Math.round(parsed.tax || 0),
        tip: Math.round(parsed.tip || 0),
        total: Math.round(parsed.total || 0),
      };
    } catch {
      throw new Error(`Failed to parse Gemini response as JSON: ${text.slice(0, 200)}`);
    }
  },
});
