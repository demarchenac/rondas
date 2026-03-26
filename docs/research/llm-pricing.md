# LLM Pricing Research — Bill OCR via Convex Actions

> Date: 2026-03-26

## Use Case

Send a bill photo (or extracted text) to an LLM and get structured JSON back:
```json
{
  "items": [
    { "name": "Bandeja Paisa", "quantity": 1, "unitPrice": 35000, "subtotal": 35000 },
    { "name": "Limonada", "quantity": 2, "unitPrice": 8000, "subtotal": 16000 }
  ],
  "tax": 5000,
  "total": 56000
}
```

## Cost Estimate per Bill

A typical bill scan involves:
- **Input:** ~1,600 tokens (image) + ~200 tokens (prompt) = ~1,800 tokens
- **Output:** ~300-500 tokens (JSON response)

## Model Comparison

### Vision Models (accept images directly)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Cost per bill | Vision? | Notes |
|-------|----------------------|----------------------|--------------|---------|-------|
| **Claude Haiku 3.5** | $0.80 | $4.00 | **~$0.003** | ✅ | Best value with vision |
| **Claude Sonnet 4** | $3.00 | $15.00 | ~$0.012 | ✅ | Overkill for this task |
| **GPT-4o-mini** | $0.15 | $0.60 | **~$0.001** | ✅ | Cheapest with vision |
| **GPT-4o** | $2.50 | $10.00 | ~$0.009 | ✅ | Overkill |
| **Gemini 2.0 Flash** | $0.10 | $0.40 | **~$0.0005** | ✅ | Cheapest overall |
| **Gemini 1.5 Pro** | $1.25 | $5.00 | ~$0.005 | ✅ | Good accuracy |

### Text-Only Models (need OCR first, then parse text)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Cost per bill | Notes |
|-------|----------------------|----------------------|--------------|-------|
| **Gemini 2.0 Flash** | $0.10 | $0.40 | ~$0.0001 | Need separate OCR |
| **GPT-4o-mini** | $0.15 | $0.60 | ~$0.0002 | Need separate OCR |
| **Claude Haiku 3.5** | $0.80 | $4.00 | ~$0.002 | Need separate OCR |

---

## Free Tiers

| Provider | Free Tier | Enough for dev? |
|----------|-----------|----------------|
| **Google Gemini** | $0 for Flash (with limits) | ✅ Yes |
| **OpenAI** | $5 credit on signup | ✅ Yes |
| **Anthropic** | $5 credit on signup | ✅ Yes |
| **Groq** | Free tier (text models only, no vision) | ⚠️ No vision |

---

## Monthly Cost Projection (Production)

| Bills/month | Gemini Flash | GPT-4o-mini | Claude Haiku |
|------------|-------------|-------------|-------------|
| 100 | $0.05 | $0.10 | $0.30 |
| 1,000 | $0.50 | $1.00 | $3.00 |
| 10,000 | $5.00 | $10.00 | $30.00 |

---

## Recommendation

### Best for Rondas: **Google Gemini 2.0 Flash**

1. **Cheapest:** ~$0.0005/bill with vision
2. **Free tier** available for development
3. **Fast:** Optimized for speed
4. **Vision support:** Accepts images directly
5. **Good accuracy:** Handles restaurant bills well

### Runner-up: **GPT-4o-mini**

1. ~$0.001/bill with vision
2. Well-documented API
3. Free $5 credit on signup

### If you prefer Anthropic: **Claude Haiku 3.5**

1. ~$0.003/bill with vision
2. Excellent instruction following
3. Best for structured JSON output

---

## Integration with Convex

All three work the same way — a Convex action that calls the API:

```typescript
// convex/ai.ts
export const extractItems = action({
  args: { imageUrl: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch("https://api.provider.com/...", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.API_KEY}` },
      body: JSON.stringify({ image: args.imageUrl, prompt: "..." }),
    });
    return await response.json();
  },
});
```

**Environment variable needed:**
```bash
npx convex env set GEMINI_API_KEY <key>
# or
npx convex env set ANTHROPIC_API_KEY <key>
# or
npx convex env set OPENAI_API_KEY <key>
```
