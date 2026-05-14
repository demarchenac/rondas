# Rondas

AI-powered bill-splitting iOS app for the Colombian market. Turborepo monorepo with Expo + React Native mobile app.

Be concise in all responses.

## Package Manager

pnpm

## Monorepo Structure

```
apps/mobile/    # Expo React Native app
apps/landing/   # Landing page (TanStack Start, SSG)
apps/web/       # Future web app
packages/       # Shared packages (future)
convex/         # Convex backend (stays at root)
```

## Commands

```bash
pnpm dev:mobile        # start Expo dev server
pnpm dev:landing       # start landing dev server
pnpm convex            # start Convex dev server
pnpm convex:deploy     # deploy Convex to production
pnpm build:preview     # EAS build preview → TestFlight
pnpm build:production  # EAS build production → App Store
pnpm ota:preview       # OTA update to preview channel
pnpm ota:production    # OTA update to production channel
```

## Path Aliases (mobile app)

- `@/*` → `apps/mobile/*` (components, hooks, lib, etc.)
- `@convex/*` → `convex/*` (root convex directory)

## Status

Phase 3 in progress. See [docs/plan/progress.md](../docs/plan/progress.md).

## Rules

- [Project Structure](../docs/rules/project-structure.md) — folders, aliases, naming
- [Expo & React Native](../docs/rules/expo-react-native.md) — routing, navigation, RN patterns
- [Styling](../docs/rules/styling.md) — NativeWind, Tailwind, React Native Reusables
- [State & Data](../docs/rules/state-data.md) — Zustand, TanStack Query, TanStack Form + Zod
- [Backend](../docs/rules/backend.md) — Convex schemas, queries, mutations, actions
- [Auth](../docs/rules/auth.md) — WorkOS AuthKit, auth guards, user sync
- [Notifications](../docs/rules/notifications.md) — WhatsApp (Meta Cloud API), Email (Resend)
- [Subscriptions](../docs/rules/subscriptions.md) — RevenueCat, feature gating, free vs pro
