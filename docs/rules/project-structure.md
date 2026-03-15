# Project Structure

## Folder Layout

```
app/            # Expo Router file-based routes
components/     # Shared UI components
lib/            # Utilities, API clients, helpers
stores/         # Zustand stores
constants/      # App-wide constants (colors, config)
convex/         # Convex backend (schema, functions)
emails/         # React Email templates
```

## Path Aliases

Configured in `tsconfig.json`:
- `@/` → project root (e.g., `@/components/BillCard`)

## Naming Conventions

- Components: `PascalCase.tsx` (e.g., `BillCard.tsx`)
- Stores: `camelCase.ts` (e.g., `useThemeStore.ts`)
- Utilities: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Constants: `camelCase.ts` with `UPPER_SNAKE_CASE` exports
- Convex functions: `camelCase.ts` matching the resource (e.g., `bills.ts`)
