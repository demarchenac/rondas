# Project Structure

## Folder Layout

```
app/            # Expo Router file-based routes
components/     # Shared UI components
  ui/           # Base primitives (Button, Card, Badge, Input, Text, Avatar)
  form/         # Form components (CurrencyInput)
  bills/        # Bill-specific components (BillCard, FilterChip, BillShareSheet, etc.)
    detail/     # Bill detail sub-components (BillHeader, BillItemCard, BillSummaryCard, etc.)
  settings/     # Settings-specific components (SegmentedControl, SettingsRow, USStatePicker)
  icons/        # SVG icon components
lib/            # Utilities, API clients, helpers
  date.ts       # Date parsing and relative time formatting
  billHelpers.ts # Bill state styles, labels, tax/category label helpers
  billSplit.ts  # Per-contact total computation for bill splitting
  format.ts     # Currency formatting (formatCurrency, parseCurrency)
  expo-image.ts # expo-image wrapped with styled() for NativeWind className support
  i18n.ts       # Translation hook (useT)
  cn.ts         # className merge utility (clsx + tailwind-merge)
  places.ts     # Reverse geocoding with address deduplication
  auth.ts       # WorkOS OAuth PKCE flow
  AuthContext.tsx # Auth state provider
stores/         # Zustand stores (theme, settings)
hooks/          # React hooks (useAuthRedirect, useNetworkStatus, useColorScheme, useBufferedInput)
constants/      # App-wide constants (env, colors, taxes, media)
convex/         # Convex backend (schema, functions, validators)
translations/   # i18n (en.ts, es.ts)
emails/         # React Email templates
```

## Path Aliases

Configured in `tsconfig.json`:
- `@/` → project root (e.g., `@/components/bills/BillCard`)

## Naming Conventions

- Components: `PascalCase.tsx` (e.g., `BillCard.tsx`)
- Stores: `camelCase.ts` (e.g., `useThemeStore.ts`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useAuthRedirect.ts`)
- Utilities: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Constants: `camelCase.ts` with `UPPER_SNAKE_CASE` exports
- Convex functions: `camelCase.ts` matching the resource (e.g., `bills.ts`)
- Convex validators: shared in `convex/validators.ts`

## Component Organization

- **Extract components** when a screen file exceeds ~300 lines
- **Bill-related** components go in `components/bills/`
- **Settings-related** components go in `components/settings/`
- **Base UI primitives** go in `components/ui/`
- Use `React.memo` on reusable components that receive props
- Use `useMemo` for expensive derived computations in screen components
