# Dev Builds Research — Expo Go vs expo-dev-client

> Date: 2026-03-26

## Your Setup

- **Dev machine:** WSL (Windows Subsystem for Linux)
- **Test device:** iPhone (physical)
- **Current workflow:** Expo Go app on iPhone, `pnpm dev` on WSL

---

## The Problem with WSL + iOS Dev Builds

**Building a dev client for iOS requires Xcode, which only runs on macOS.** This is a hard blocker for WSL.

### Options to build for iOS:

| Method | Works from WSL? | Cost | Notes |
|--------|----------------|------|-------|
| **Xcode locally** | ❌ No (needs macOS) | Free | Not possible from WSL |
| **EAS Build (cloud)** | ✅ Yes | Free tier: 30 builds/month | Recommended for your setup |
| **Mac in cloud** (MacStadium, GitHub Actions) | ✅ Yes | $30-50/month | Overkill for dev |

### EAS Build (Recommended for you)

EAS Build compiles your app in Expo's cloud (macOS servers) and gives you an installable `.ipa`. You never need Xcode locally.

```bash
# One-time setup
pnpm add -D expo-dev-client
npx eas build:configure

# Build dev client for iOS (runs in cloud ~10-15 min)
npx eas build --profile development --platform ios

# After build completes, install on iPhone via QR code or link
```

**After the dev client is installed on your iPhone:**
- You run `pnpm dev` on WSL (same as now)
- You open your custom dev client app instead of Expo Go
- Hot reload, fast refresh — everything works the same
- The dev client stays installed until you add new native dependencies

---

## What Changes with Dev Builds?

### What stays the same:
- `pnpm dev` starts the dev server on WSL ✅
- Hot reload / fast refresh on iPhone ✅
- All your JS/TS code, components, styling ✅
- Expo Router, NativeWind, Convex, etc. ✅

### What changes:
- Instead of opening **Expo Go**, you open **your custom dev client app**
- First build takes ~10-15 min (EAS cloud) — one-time until native deps change
- You need an [Expo account](https://expo.dev) (free) and Apple Developer account ($99/year)
- New native packages (like ML Kit) require a rebuild
- JS-only packages do NOT require a rebuild

### When do you need to rebuild?
- ✅ Adding `@react-native-ml-kit/text-recognition` → rebuild
- ✅ Adding `react-native-purchases` (RevenueCat) → rebuild
- ❌ Adding a Zustand store → no rebuild
- ❌ Changing a screen → no rebuild
- ❌ Adding a Convex function → no rebuild

---

## Step-by-Step Migration

### 1. Install expo-dev-client
```bash
pnpm add expo-dev-client
```

### 2. Create EAS project
```bash
npx eas build:configure
```
This creates `eas.json` with build profiles.

### 3. Configure eas.json
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

### 4. Register iPhone for ad-hoc distribution
```bash
npx eas device:create
# Scan QR code on iPhone to register device UDID
```

### 5. Build dev client
```bash
npx eas build --profile development --platform ios
# Takes ~10-15 min in cloud
# Gives you a link to install on iPhone
```

### 6. Develop as usual
```bash
pnpm dev
# Open your custom app instead of Expo Go
# Everything works the same — hot reload, etc.
```

---

## Prerequisites

- **Expo account:** Free at [expo.dev](https://expo.dev)
- **Apple Developer account:** $99/year (required for installing on physical iPhone)
  - Needed for: provisioning profiles, device registration
  - Without it: Can only build for iOS simulator (not useful from WSL)
- **EAS Build free tier:** 30 builds/month (more than enough for dev)

---

## Recommendation for Rondas

**You'll need dev builds eventually** for:
- ML Kit OCR (Phase 4)
- RevenueCat subscriptions (Phase 9)
- App Store submission (Phase 10)

**Suggested timing:**
- **Now:** Stay on Expo Go, use Claude Haiku for OCR via Convex action
- **Before Phase 9:** Migrate to dev builds when you need RevenueCat
- **Or:** Migrate now if you have an Apple Developer account and want ML Kit

The migration is non-destructive — your code doesn't change, you just add `expo-dev-client` and build once.
