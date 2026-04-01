# File Upload — Research & Decision

> Researched: 2026-04-01

## Goal

Persist bill receipt photos so users can reference the original image later. Currently images are sent as base64 to Gemini for OCR and then discarded.

## Options Evaluated

### 1. Convex File Storage (native)

**How it works:** `generateUploadUrl()` → POST blob → get `storageId` → store on bill → `getUrl(storageId)` to serve.

**Pros:**
- Zero extra dependencies — works with plain `fetch` from React Native
- Typed `v.id("_storage")` schema validation
- Transactional cleanup: `ctx.storage.delete(storageId)` in the same mutation that deletes a bill
- Simple architecture — no external services

**Cons:**
- **Bandwidth costs:** $0.33/GiB for serving files. Every time a user views a receipt thumbnail, it counts
- Free tier: 1 GiB storage, 1 GiB/month bandwidth
- Paid ($25/dev/mo): 100 GiB storage, 50 GiB/month bandwidth

**Verdict:** Good for prototyping, but bandwidth costs scale poorly for an image-heavy app.

### 2. UploadThing via Convex httpAction

**How it works:** Host UploadThing's route handler inside a Convex `httpAction`.

**Verdict: Not viable.**
- UploadThing depends on `effect` + `@effect/platform` — never tested in Convex's V8 isolate
- Zero community examples, zero GitHub issues — nobody has done this
- High risk of runtime incompatibilities, bundle size limits, memory issues (64 MiB cap)
- Discord thread asking about it with no solution posted

### 3. UploadThing via Cloudflare Worker (chosen)

**How it works:** A ~40-line Cloudflare Worker hosts the UploadThing route handler. The Expo app uploads directly to UploadThing's CDN via presigned URLs. The Worker is just an auth + config proxy.

**Verdict: Best option.** Free bandwidth, minimal code, officially supported adapter.

---

## Chosen Architecture: Cloudflare Worker + UploadThing

### Services & Accounts

| Service | Purpose | Cost |
|---------|---------|------|
| **UploadThing** | File storage + CDN serving | Free (2 GB, unlimited bandwidth) |
| **Cloudflare Workers** | Hosts upload route (~40 lines) | Free (100k req/day) |
| **Convex (existing)** | Stores `imageUrl` on bills | No extra cost |

### Credentials

| Token | Source | Where it goes |
|-------|--------|---------------|
| `UPLOADTHING_TOKEN` | UploadThing dashboard | CF Worker secret (`wrangler secret put`) |
| Cloudflare auth | `wrangler login` (OAuth) | Automatic |

### Packages

| Where | Install |
|-------|---------|
| New Worker project | `uploadthing` |
| Rondas Expo app | `@uploadthing/expo` (already have `expo-image-picker`) |

Note: `uploadthing` v7.7.4 is already in Rondas `package.json` but completely unused. Can be removed from the Expo app once the Worker handles server-side logic.

### Worker Project Structure

```
rondas-upload-worker/
├── wrangler.jsonc      # CF config: name, entry point, compat flags
├── src/index.ts        # ~40 lines: file router + fetch handler
└── .dev.vars           # Local dev secrets (UPLOADTHING_TOKEN)
```

### Upload Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         UPLOAD FLOW                                  │
│                                                                      │
│  ┌──────────┐     1. POST /api/uploadthing       ┌───────────────┐  │
│  │          │     (+ Auth header with token)       │               │  │
│  │  Expo    │ ──────────────────────────────────► │  Cloudflare   │  │
│  │  App     │                                      │  Worker       │  │
│  │ (Rondas) │     2. Returns presigned URL         │  (~40 lines)  │  │
│  │          │ ◄────────────────────────────────── │               │  │
│  │          │                                      └──────┬────────┘  │
│  │          │     3. PUT file directly                     │          │
│  │          │ ──────────────────────┐                      │          │
│  │          │                       ▼                      │          │
│  │          │                ┌──────────────┐              │          │
│  │          │                │ UploadThing  │              │          │
│  │          │                │ CDN / S3     │              │          │
│  │          │                └──────┬───────┘              │          │
│  │          │                       │ 4. Webhook callback  │          │
│  │          │                       └─────────────────────►│          │
│  │          │                                              │          │
│  │          │     5. Returns file URL                      │          │
│  │          │     (https://xxx.ufs.sh/f/KEY)               │          │
│  │          │ ◄────────────────────────────────────────────┘          │
│  │          │                                                         │
│  │          │     6. Convex mutation:              ┌──────────────┐  │
│  │          │        store imageUrl on bill        │   Convex     │  │
│  │          │ ──────────────────────────────────► │   (existing)  │  │
│  │          │                                      └──────────────┘  │
│  └──────────┘                                                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Details

- **File never touches the Worker** — goes straight from phone to UploadThing CDN
- **Parallel with Gemini:** upload runs via `Promise.allSettled` alongside AI extraction — no added wait time
- **Graceful degradation:** if upload fails, bill is still created without image
- **File URL format:** `https://<APP_ID>.ufs.sh/f/<FILE_KEY>`
- **Schema:** `bills.imageUrl` already exists as `v.optional(v.string())` — no migration needed
- **Auth:** pass WorkOS session token as Bearer header, verify in Worker middleware

### CF Worker Gotchas

1. Pass `token: env.UPLOADTHING_TOKEN` explicitly (no `process.env`)
2. Set `isDev` manually (no auto-detection in Workers)
3. Strip `cache` from fetch init (CF runtime doesn't support it)
4. Use `ctx.waitUntil(promise)` for daemon promises (`onUploadComplete`)
5. Add CORS headers manually for Expo app access

### Dev vs Production

| Aspect | Development | Production |
|--------|------------|------------|
| Worker URL | `localhost:8787` | `*.workers.dev` |
| Secrets | `.dev.vars` file | `wrangler secret put` |
| UploadThing callback | Simulated locally | Real webhook POST |
| Expo connection | LAN IP or tunnel | Direct via env var |

### Open Questions

1. **Monorepo vs separate repo** for the Worker project
2. **Auth verification** — decode JWT in Worker vs call Convex query to validate
3. **Type sharing** — `UploadRouter` type needs to be importable by Expo app for typed hooks
4. **File cleanup** on bill deletion — call UploadThing delete API from Convex mutation/action

### Pricing Comparison

| | UploadThing | Convex Storage |
|---|---|---|
| Free storage | 2 GB | 1 GB |
| Free bandwidth | Unlimited | 1 GB/mo |
| Paid tier | $10/mo → 100 GB | $25/dev/mo → 100 GB |
| Bandwidth overage | Free | $0.33/GB |
| CF Worker | Free (100k req/day) | N/A |

UploadThing wins on economics, especially for serving images repeatedly.
