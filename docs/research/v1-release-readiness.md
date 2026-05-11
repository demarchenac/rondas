# V1 Release Readiness Audit — Rondas

> Date: 2026-05-10
> Phase: 10 (Polish & Launch Prep) — 366/383 tasks (95.6%)

---

## Blocking — Must complete before App Store submission

### 1. Privacy Policy & Terms of Service

**Status:** Not created

Apple requires both for App Store review. Must be hosted at accessible URLs.

**Must cover:**
- Data collection: contacts (on-device only), location, photos
- Sentry error reporting (`sendDefaultPii: true` — captures PII)
- RevenueCat subscription data
- WorkOS authentication
- WhatsApp/Resend integration (no data stored server-side)

**Action:**
- [ ] Write Privacy Policy (English + Spanish)
- [ ] Write Terms of Service (English + Spanish)
- [ ] Host on web (Convex site URL or static page)
- [ ] Add URLs to app and App Store Connect

---

### 2. iOS Privacy Manifest

**Status:** Not configured

iOS 17+ requires `PrivacyInfo.xcprivacy` declaring API usage reasons.

**Action:**
- [ ] Add `privacyManifests` to `app.json` expo config
- [ ] Declare reasons for: contacts, location, camera, photo library

---

### 3. App Store Description & Screenshots

**Status:** Not prepared

**Action:**
- [ ] Write App Store description (English + Spanish)
- [ ] Capture screenshots on simulator (6.7" and 6.1" devices)
- [ ] Prepare promotional text and keywords

---

### 4. RevenueCat Android Production Key

**Status:** iOS key is production, Android key is test/sandbox

| Platform | Key | Type |
|----------|-----|------|
| iOS | `appl_oREdJXFTqzZURSexdtyaeEOWWYh` | Production |
| Android | `test_sHIIYfcUYVSPCZtLuwuvanDWaTj` | Sandbox/Test |

**Action:**
- [ ] Create production Android app in RevenueCat dashboard
- [ ] Get production Android key
- [ ] Update in EAS env vars for production builds

---

### 5. App Store Connect Promo Codes

**Status:** Not configured

**Action:**
- [ ] Configure offer codes in App Store Connect (after app approved)
- [ ] Test promo code redemption flow

---

## Important — Fix before or shortly after launch

### 6. Sentry DSN hardcoded

**Status:** DSN hardcoded in `app/_layout.tsx` line 26

**Action:**
- [ ] Move to `EXPO_PUBLIC_SENTRY_DSN` env var

---

### 7. SENTRY_AUTH_TOKEN in .env.local

**Status:** Auth token in `.env.local` (git-tracked via `.env.local`)

**Action:**
- [ ] Move to EAS Secrets for production builds

---

### 8. Duplicate Android permissions in app.json

**Status:** Permissions block duplicated (lines 26-41)

**Action:**
- [ ] Remove duplicate permission declarations

---

### 9. Android submit profile in eas.json

**Status:** No Android submit profile configured

**Action:**
- [ ] Add Android submit profile when ready for Google Play (not blocking iOS-first v1)

---

## iOS Liquid Glass UI Review

### Current state

- **Tab bar:** Solid background (`#fafbfc` light / `#121a2e` dark) — `app/(tabs)/_layout.tsx`
- **Headers:** All custom, `headerShown: false` everywhere
- **expo-blur:** Already installed (`56.0.0-canary`), used in `app/bills/new.tsx`
- **React Native 0.85** + **Expo 56 canary** — supports iOS 26 features
- **Platform checks:** Pattern established in `app/paywall.tsx` and settings

### Candidates for liquid glass (iOS only)

| Element | File | Current | Change |
|---------|------|---------|--------|
| Tab bar | `app/(tabs)/_layout.tsx` | Solid bg | `BlurView` via `tabBarBackground` prop |
| Home header | `app/(tabs)/index.tsx` (L286-357) | Solid bg | `BlurView` behind content |
| Settings header | `app/(tabs)/settings.tsx` (L145-150) | Solid bg | `BlurView` behind content |
| Bill detail header | `components/bills/detail/BillHeader.tsx` | Solid bg | `BlurView` behind content |
| Bottom action bar | `app/bills/[id].tsx` | Solid bg + border-t | `BlurView` with translucent bg |

### Implementation approach

- `Platform.OS === 'ios'` checks — Android keeps solid backgrounds
- Tab bar: `tabBarBackground` prop renders `BlurView`
- Headers: `BlurView` with `position: absolute` behind content, transparent background
- Bottom bar: Same `BlurView` approach

---

## Not blocking v1

| Item | Reason |
|------|--------|
| Email notifications | WhatsApp is primary channel |
| UploadThing image upload | Base64 to Convex works fine |
| Meta WhatsApp API production | Sandbox is fine, manual wa.me links work |
| Universal links / app links | Custom scheme `rondas://` works for auth |
| Google Play Console setup | iOS-first launch |
| Convex prod deployment | Dev deployment used as prod, works fine |

---

## Environment Variables Status

| Variable | Location | Environment | Status |
|----------|----------|-------------|--------|
| CONVEX_URL | `.env` | Production | Ready |
| WORKOS_CLIENT_ID | `.env` | Production | Ready |
| REVENUECAT_IOS_KEY | `.env.local` | Production | Ready |
| REVENUECAT_ANDROID_KEY | `.env.local` | Sandbox | Must update |
| SENTRY_AUTH_TOKEN | `.env.local` | Production | Move to EAS Secrets |
| SENTRY_DSN | Hardcoded | Production | Move to env var |

---

## Pre-launch checklist

- [ ] Privacy Policy + Terms of Service (EN/ES)
- [ ] iOS Privacy Manifest in `app.json`
- [ ] App Store description + screenshots
- [ ] RevenueCat Android production key
- [ ] Sentry DSN → env var
- [ ] SENTRY_AUTH_TOKEN → EAS Secrets
- [ ] Clean duplicate permissions in `app.json`
- [ ] iOS liquid glass UI pass
- [ ] Configure promo codes in App Store Connect
- [ ] Final `pnpm typecheck` + `pnpm lint`
- [ ] Production EAS build + TestFlight
- [ ] Submit for App Store review
