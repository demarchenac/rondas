# Rondas

AI-powered bill-splitting app for the Colombian market. Scan a receipt, split items among friends, and share via WhatsApp.

**Status: WIP — 92% complete** (320/348 tasks)

## Tech Stack

- **Frontend:** Expo (SDK 56 canary) + React Native 0.85 + Hermes V1
- **Styling:** NativeWind v5 + React Native Reusables
- **Backend:** Convex (real-time DB, queries, mutations, actions)
- **Auth:** WorkOS AuthKit (Email OTP, Apple, Google)
- **AI:** Gemini 2.5 Flash (receipt OCR with SSE streaming)
- **Monitoring:** Sentry
- **Build:** EAS Build + EAS Update (OTA)

## Milestones

| Milestone | Progress | Status |
|-----------|----------|--------|
| Phase 1 — Setup & Infrastructure | 35/38 | ~92% |
| Phase 2 — Auth Screens | 23/23 | Done |
| Phase 3 — Home Screen | 19/19 | Done |
| Phase 4 — Bill Creation & AI Scanning | 33/34 | ~97% |
| Phase 5 — Bill Splitting & Contacts | 21/21 | Done |
| Phase 6 — Summary & Notifications | 10/12 | ~83% |
| Phase 7 — Bill Detail & History | 31/32 | ~97% |
| Phase 8 — Settings | 24/24 | Done |
| Phase 9 — Subscriptions (RevenueCat) | 0/12 | Not started |
| Phase 10 — Polish & Launch Prep | 7/16 | ~44% |
| Codebase Reviews & Refactoring | 117/117 | Done |

### Remaining work

- **Phase 1:** UploadThing file upload, WhatsApp Meta Cloud API setup
- **Phase 4:** UploadThing image storage (currently using base64 → Gemini directly)
- **Phase 6:** Email templates (React Email + Resend)
- **Phase 7:** Image upload to UploadThing on bill creation
- **Phase 9:** RevenueCat subscription model (entire phase)
- **Phase 10:** App icons, screenshots, App Store submission

## Build Notes

### iOS (Production)

- **Status:** Working on iOS 26 (TestFlight)
- **Build profile:** `production`
- **SDK:** Expo 56.0.0-canary-20260409 / RN 0.85.0 / Hermes V1
- **Known issue:** Current TestFlight build uses `@react-native-async-storage/async-storage@3.0.0`. All future builds will use 2.2.0 (already in `package.json`). Rebuild iOS production when convenient to sync versions.

### Android (Preview)

- **Status:** Working (APK via EAS Build, internal distribution)
- **Build profile:** `preview`
- **Note:** `async-storage@3.0.0` failed on Android EAS builds (local maven repo not accessible in cloud). Downgraded to 2.2.0.

### EAS Environment Variables

Both `preview` and `production` environments have:
- `EXPO_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_CONVEX_SITE_URL`
- `EXPO_PUBLIC_WORKOS_CLIENT_ID`
- `EXPO_PUBLIC_WORKOS_REDIRECT_URI`
- `SENTRY_AUTH_TOKEN` (sensitive)
- `CONVEX_DEPLOYMENT` (sensitive, production only)

### OTA Updates

EAS Update is configured. JS-only changes can be pushed without rebuilding:
```bash
eas update --branch production --message "description"
```
Native dependency changes require a full `eas build`.

## Development

```bash
pnpm dev           # start Expo dev server
pnpm typecheck     # tsc --noEmit
pnpm lint          # expo lint
pnpm convex        # start Convex dev server
pnpm convex:deploy # deploy Convex functions to production
```
