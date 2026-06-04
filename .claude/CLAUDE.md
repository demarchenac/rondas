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

## Coding Conventions

### Semantic Variable Naming
- Name variables by what they represent, not their type or structure
- `contactCount` not `n`, `billTotal` not `sum`, `isEqualSplit` not `flag`
- Booleans: prefix with `is`, `has`, `can`, `should` — `isPaid`, `hasContacts`
- Handlers: prefix with `handle` — `handleTogglePaid`, not `togglePaidCallback`
- Collections: plural nouns — `contacts`, not `contactList` or `contactArray`

### Negative Space Programming
- Use early returns and guard clauses to eliminate nesting
- The happy path should be the leftmost column of code
- Avoid `else` after `return` — just continue at the top level
- Prefer `if (!x) return` over `if (x) { ...100 lines... }`

### Smaller Cognitive Load
- Functions do one thing — if you need "and" to describe it, split it
- Max 3 levels of nesting; extract a helper if deeper
- Max ~5 parameters per function; use an options object beyond that
- Prefer derived values (`useMemo`) over synchronized state
- Keep files under 300 lines; extract hooks or components when larger

### DRY (Don't Repeat Yourself)
- Extract shared logic when repeated 3+ times — not before (Rule of Three)
- Shared types go in `lib/types.ts`, shared calculations in `lib/billCalculations.ts`
- Shared hooks go in `hooks/` — prefer composition over prop drilling
- Duplication is cheaper than the wrong abstraction — don't DRY prematurely
- If two pieces of code change for different reasons, they're not duplicates

### Conventional Commits
- All commits follow [Conventional Commits](https://conventionalcommits.org)
- Format: `type(scope?): description`
- Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`
- Description: imperative mood, lowercase, no period
- Body: explain why, not what (the diff shows what)

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
