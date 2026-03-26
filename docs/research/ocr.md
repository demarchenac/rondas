# OCR Research — Bill Text Extraction

> Date: 2026-03-26

## Goal

Extract line items (name, quantity, price) from restaurant bill photos. Evaluate Google ML Kit and alternatives for on-device OCR in Expo React Native.

---

## Key Constraint

**All ML Kit packages require `expo-dev-client` (development builds).** They do NOT work in Expo Go because they need custom native code. This means:

- First build takes 15-30 min (Xcode/Android Studio required)
- Subsequent rebuilds are fast with hot reload
- Command: `npx expo run:ios` or `npx expo run:android`

---

## Package Comparison

| Package | Version | Maintained | Downloads/wk | Expo Plugin | Notes |
|---------|---------|-----------|-------------|-------------|-------|
| **@react-native-ml-kit/text-recognition** | 2.0.0 | ✅ (7 months) | ~4,869 | No | Most popular, structured output |
| **@infinitered/react-native-mlkit** | Latest | ✅ Active | — | ✅ Yes | Professional, modular, Expo config plugin |
| **expo-text-extractor** | Latest | ✅ Active | — | Native module | Uses ML Kit (Android) + Apple Vision (iOS) |
| **react-native-vision-camera-mlkit** | Latest | ✅ Active | — | No | Real-time camera frame processing |
| ~~react-native-mlkit-ocr~~ | 0.3.0 | ❌ Archived | ~3,506 | No | **Do not use** — unmaintained |

---

## Recommended Options

### Option A: `@react-native-ml-kit/text-recognition` (Simplest)

**Pros:** Most popular, simple API, good structured output (blocks → lines → text)
**Cons:** No Expo config plugin, requires manual native setup

```bash
pnpm add @react-native-ml-kit/text-recognition
```

```typescript
import TextRecognition from '@react-native-ml-kit/text-recognition';

const result = await TextRecognition.recognize(imageUri);
// result.text — full text
// result.blocks[] — text blocks with bounding boxes
// result.blocks[].lines[] — individual lines
```

### Option B: `expo-text-extractor` (Best Expo Integration)

**Pros:** Built with Expo Modules (JSI), uses ML Kit on Android + Apple Vision on iOS
**Cons:** Newer, smaller community
**Requires:** Expo SDK 52+ (we have 54 ✅)

```bash
pnpm add expo-text-extractor
```

```typescript
import { extractText } from 'expo-text-extractor';

const result = await extractText(imageUri);
```

### Option C: `@infinitered/react-native-mlkit` (Most Professional)

**Pros:** Config plugin for Expo, modular, TypeScript, professional support
**Cons:** More packages to install, heavier

```bash
pnpm add @infinitered/react-native-mlkit-core @infinitered/react-native-mlkit-text-recognition
```

---

## On-Device vs Cloud

| Aspect | On-Device (ML Kit) | Cloud (Claude/GPT) |
|--------|-------------------|-------------------|
| Cost | **Free** | ~$0.01-0.02/bill |
| Speed | Fast (no network) | 2-5 seconds |
| Offline | ✅ Yes | ❌ No |
| Privacy | ✅ Data stays on device | Data sent to API |
| Accuracy | Good for printed text | Excellent, understands context |
| Item parsing | Raw text only — needs parsing logic | Returns structured JSON directly |

---

## Hybrid Approach (Recommended for Rondas)

**On-device OCR + lightweight LLM for structuring:**

1. **ML Kit** extracts raw text from bill photo (free, offline)
2. **Claude Haiku / GPT-4o-mini** structures the text into items JSON (~$0.001/bill)
3. User reviews and edits extracted items

This gives us:
- ✅ Near-zero cost ($0.001 vs $0.02 per bill)
- ✅ Works offline for OCR step
- ✅ High accuracy for item parsing via LLM
- ✅ Privacy-first (image never leaves device)

**Alternative:** Skip the LLM entirely and parse with regex/heuristics for Colombian bills (items usually follow patterns like `ITEM NAME    $XX,XXX`). This would be 100% free and offline.

---

## Impact on Architecture

### With ML Kit (requires dev build):
- Must switch from Expo Go to `expo-dev-client`
- One-time setup cost (~30 min)
- All future development uses dev builds
- This is recommended anyway for production apps

### Without ML Kit (keep Expo Go for now):
- Mock OCR during development
- Add ML Kit later when ready for dev builds
- Or use cloud-only approach (Claude/GPT) — no native code needed

---

## Recommendation

**For MVP:** Start with **Option A** (`@react-native-ml-kit/text-recognition`) + regex parsing for Colombian bill format. Add a lightweight LLM (Haiku) as optional enhancement.

**If staying in Expo Go for now:** Use Claude Haiku via Convex action (~$0.001/bill) — no native code needed, works immediately.
