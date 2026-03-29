# Codebase Review — 2026-03-29

Senior-level review of the Rondas codebase covering React Native, Expo, Convex, and TypeScript best practices.

## Scoring Summary

| Category | Score | Notes |
|---|---|---|
| File structure | 7/10 | Good layout, but oversized screen files |
| Component architecture | 5/10 | Major decomposition needed in bill screens |
| Variable naming | 7/10 | Excellent in utilities, weak in complex screens |
| Logic complexity | 6/10 | Good guards in backend, nested complexity in UI |
| TypeScript & type safety | 7/10 | Solid overall, some non-null assertion abuse |
| Convex backend | 5/10 | No auth checks, duplicated validators |
| Constants & hardcoded values | 5/10 | Many magic colors and values inline |
| State management | 7/10 | Zustand is clean, screen-level state is bloated |
| Styling consistency | 6/10 | Mix of NativeWind and inline styles |
| CSS & Tailwind tokens | 8/10 | Excellent global.css, but tokens underused in routes |
| NativeWind patterns | 5/10 | Great in primitives, heavy inline style fallback in screens |
| React Native Reusables | 6/10 | Good primitives exist, bypassed in route files |
| i18n | 8/10 | Good coverage, a few hardcoded English strings |
| Security | 4/10 | No auth on mutations, API key logged |
| Performance | 6/10 | Missing memoization and pagination |

---

## 1. File Structure & Organization

The top-level structure follows Expo conventions well: `app/`, `components/`, `convex/`, `lib/`, `stores/`, `hooks/`, `constants/`, `translations/`.

### Issues

- **No `types/` directory** — Interfaces are defined inline in screen files (e.g., `app/bills/new.tsx:40-58`). Shared types should live in a dedicated directory.
- **No `utils/` separation** — Helper functions (relative time, item preparation) are embedded in screen components instead of extracted to utilities.
- **Missing component extraction** — `BillCard`, `FilterChip`, `SwipeableItem`, `KeyboardDoneButton`, `TipSelector` are all defined inline within route files.
- **`constants/theme.ts` is deprecated** — Still imported by `hooks/use-theme-color.ts`. Should be removed or consolidated with `global.css` tokens.

---

## 2. Component Architecture

### Oversized Files (Critical)

| File | Lines | Recommended Max |
|---|---|---|
| `app/bills/[id].tsx` | 1750 | ~300 |
| `app/bills/new.tsx` | 873 | ~300 |
| `app/(tabs)/index.tsx` | 540 | ~300 |

### `app/bills/[id].tsx` — 1750 lines

This file handles: item display, item editing, contact assignment, contact removal, multi-select, sorting, tax/tip dialogs, sharing (WhatsApp, email, infographic), payment tracking, and bill state management. It should be decomposed into:

- `components/bills/BillItemRow.tsx` — display mode with contact chips
- `components/bills/BillItemEditor.tsx` — edit mode with inputs
- `components/bills/BillSummary.tsx` — tax/tip/total section
- `components/bills/BillShareSheet.tsx` — share options
- `components/bills/ContactPickerSheet.tsx` — contact selection modal
- `hooks/useBillDetail.ts` — state management and callbacks

### `app/bills/new.tsx` — 873 lines

Contains inline components that should be extracted:

- `SwipeableItem` (lines 789-812) → `components/SwipeableItem.tsx`
- `KeyboardDoneButton` (lines 814-872) → `components/KeyboardDoneButton.tsx`
- Scan overlay UI → `components/bills/ScanningOverlay.tsx`
- Item review form → `components/bills/ItemReviewForm.tsx`

### `app/(tabs)/index.tsx` — 540 lines

Contains inline components:

- `BillCard` (lines 58-207) → `components/bills/BillCard.tsx`
- `FilterChip` (lines 208-258) → `components/bills/FilterChip.tsx`
- `relativeTime()` (lines 44-56) → `lib/date.ts`
- `stateLabel()` (lines 34-42) → `lib/billHelpers.ts`

### Duplicate Code

- **Tip selector** is duplicated between `app/setup.tsx:114-141` and `app/(tabs)/settings.tsx:207-233`. Identical styling, identical logic. Extract to `components/TipSelector.tsx`.

---

## 3. Variable Naming

### Strengths

- Utility functions are excellently named: `formatCurrency`, `parseCurrency`, `getTaxConfig`, `computeTax`, `toE164`
- Event handlers consistently use `handle` prefix: `handleDeleteBill`, `handleRemoveItem`, `handleItemPress`
- Zustand setters follow `set{Property}` convention
- Boolean state uses `is`/`has`/`show` prefixes: `hasCompletedSetup`, `isEditing`, `showTipDialog`

### Issues

**Single-letter variables in complex contexts:**

- `app/bills/[id].tsx:291` — `ci` for contact index, `n` for name in filter:
  ```ts
  const ci = parseInt(ciStr, 10);
  .filter((n): n is string => !!n);
  ```
  Should be `contactIdx` and `contactName`.

- `app/bills/[id].tsx:886` — `i` for item in find callback:
  ```ts
  const item = bill.items.find((i) => i.id === itemId);
  ```
  Shadows the outer `item` variable. Should be `billItem`.

- `app/bills/new.tsx:66` — `c` in regex callback:
  ```ts
  .replace(/^\w/, (c) => c.toUpperCase())
  ```
  Should be `firstChar`.

- `app/(tabs)/index.tsx` and `convex/bills.ts` — `c` used frequently for contact in `.filter()` and `.map()` callbacks. Acceptable in simple one-liners but should be `contact` in multi-line callbacks.

**Abbreviated names:**

- `pct` used for tip percentage in `settings.tsx` and `setup.tsx` — should be `percent` or `tipPercent`

---

## 4. Logic Complexity & Guard Clauses

### Good Guard Patterns

**Convex mutations** (`convex/bills.ts`) consistently use guards:
```ts
// bills.ts update mutation
const defined = Object.fromEntries(
  Object.entries(patches).filter(([, val]) => val !== undefined)
);
if (Object.keys(defined).length === 0) return;  // Guard: no-op
const bill = await ctx.db.get(id);
if (!bill) throw new Error('Bill not found');    // Guard: existence
// Happy path follows...
```

**Simple callbacks** in `app/bills/[id].tsx` use guards well:
```ts
const handleRemoveItem = useCallback((itemId: string) => {
  const currentBill = billRef.current;
  if (!currentBill) return;  // Guard
  // Happy path...
}, [id, updateBill]);
```

### Complexity Issues

**Nested ternaries** — `app/bills/new.tsx:486-498`:
```ts
{scanProgress?.status === 'thinking'
  ? t.scan_reading
  : scanProgress?.status === 'extracting'
    ? t.scan_extracting
    : t.scan_analyzing}
```
Duplicated twice (title + hint). Should extract to a `getScanStatusLabel()` function using a `switch` statement.

**Deep nesting in render** — `app/bills/[id].tsx:620-790`:
The item list render reaches **6 levels of nesting**: `View > ScrollView > .map() > Swipeable > ternary > Pressable > conditional render`. Maximum recommended is 3 levels. Extract `EditModeRow` and `DisplayModeRow` components.

**Large function** — `handleConfirmContactPicker` in `app/bills/[id].tsx:192-224` (32 lines):
Multiple responsibilities: determine target items, loop contacts, extract data, trigger mutations, cleanup state. Should extract `getTargetItemIds()` and `extractContactInfo()` helpers.

**Spread-out happy path** — `handleScan` in `app/bills/new.tsx:188-259` (72 lines):
The actual action (`createBill`) is buried at line 236 after 40 lines of setup. Extract `compressImage()`, `extractBillData()`, and `prepareBillForStorage()` helpers so the happy path reads linearly.

**Complex auth guard** — `app/_layout.tsx:38-51`:
Multiple nested conditions for routing. Should extract to a `useAuthRedirect()` hook.

### Cognitive Load Summary

| Indicator | File | Location | Severity |
|---|---|---|---|
| 1750-line component | `[id].tsx` | Entire file | Critical |
| 873-line component | `new.tsx` | Entire file | High |
| 6 levels JSX nesting | `[id].tsx` | Lines 620-790 | High |
| 3-level chained ternary | `new.tsx` | Lines 486-498 | Medium |
| 14+ useState calls | `[id].tsx` | Lines 104-116 | High |
| 56-line function | `index.tsx` | `pickImage` 311-367 | Medium |

---

## 5. TypeScript & Type Safety

### Strengths

- Full TypeScript throughout, strict mode enabled
- Convex-generated types flow end-to-end from schema to frontend
- Zustand stores are properly typed with interfaces
- i18n is type-safe (Spanish file typed as `typeof en`)

### Issues

- **Non-null assertions on env vars** — `constants/env.ts`:
  ```ts
  CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL!,
  ```
  Will fail at runtime if missing. Should validate with Zod on startup.

- **No shared types directory** — Interfaces like `ExtractedItem`, `BillItem`, contact shapes are defined inline in multiple files. Should centralize in `types/`.

- **IconSymbol prop type inconsistency** — `components/ui/icon-symbol.tsx` uses `StyleProp<TextStyle>` while `icon-symbol.ios.tsx` uses `StyleProp<ViewStyle>`. Should be unified.

---

## 6. Convex Backend

### No Authentication Checks (Critical)

**None** of the queries or mutations verify user identity:

- `users.getByWorkosId()` — anyone can query any user's data
- `bills.list()` — anyone can list any user's bills
- `bills.get()` — anyone can read any bill
- All bill mutations — no ownership verification

Every query/mutation should call `ctx.auth.getUserIdentity()` and verify the requesting user owns the resource.

### Duplicated Validators

The `billState` union, item object shape, and contact object shape are defined in both `schema.ts` and repeated in mutation args across `bills.ts`. Extract shared validators to `convex/validators.ts`:

```ts
// convex/validators.ts
export const billStateValidator = v.union(
  v.literal('draft'), v.literal('unsplit'),
  v.literal('split'), v.literal('unresolved')
);
export const itemValidator = v.object({ ... });
export const contactValidator = v.object({ ... });
```

### No Pagination

`bills.list()` and `bills.listByState()` return all bills with no limit. Will degrade as users accumulate bills. Add cursor-based pagination.

### Missing Timestamps

No `createdAt` or `updatedAt` fields on bills or scans. Needed for sorting, archiving, and audit trails.

### Rounding Precision

`recalculateAmounts()` in `convex/bills.ts` uses `Math.round()` which can cause the sum of contact amounts to not equal the bill total. Should add a remainder distribution step.

---

## 7. Constants & Hardcoded Values

### Magic Colors

Hardcoded color values appear in 10+ locations instead of using theme tokens or constants:

| File | Line(s) | Value | Should Be |
|---|---|---|---|
| `app/(tabs)/index.tsx` | 27-32 | `STATE_STYLES` with hex colors | `constants/billStyles.ts` |
| `app/(tabs)/index.tsx` | 132 | `borderColor: '#1a2540'` | Theme token |
| `app/(tabs)/index.tsx` | 170 | `color: '#8b9cc0'` | Theme token |
| `app/(tabs)/settings.tsx` | 207-233 | Tip button colors `rgba(56,189,248,...)` | Shared constant |
| `app/setup.tsx` | 114-141 | Same tip button colors | Shared constant |
| `app/bills/new.tsx` | 346 | `backgroundColor: '#121a2e'` | Theme token |
| `app/bills/new.tsx` | 542 | Hardcoded `'Delete'` string | i18n key |
| `app/(auth)/login.tsx` | 63 | `color: "#fff"` | Theme token |
| `components/settings/SettingsRow.tsx` | 45, 196, 226 | `#38bdf8`, `#94a3b8` | Theme token |

### Missing Constants

- **Image compression**: 1024px resize, 80% JPEG quality — implicit, should be in `constants/media.ts`
- **Gemini model ID**: `gemini-2.5-flash` hardcoded in `convex/ai.ts` — should be env var or constant
- **Redirect URI**: `'rondas://callback'` hardcoded in `lib/auth.ts:9` — should be in `constants/env.ts`
- **Relative time thresholds**: 1min, 60min, 24h, 7d hardcoded in `index.tsx` — should be in utility

---

## 8. State Management

### Zustand Stores — Good

Both `useThemeStore` and `useSettingsStore` are well-designed: typed, persisted to AsyncStorage, with migration support.

### Screen-Level State — Bloated

`app/bills/[id].tsx` has 14+ `useState` calls managing unrelated concerns:

```ts
editingItemId, showTipDialog, showCountryDialog, deletingId,
multiSelectMode, selectedItemIds, sortStrategy, showShareSheet,
showContactPicker, showUnassignPicker, phoneContacts, contactSearch,
selectedContactIds, singleAssignItemId
```

Should group related state:
- **UI mode**: `editingItemId`, `multiSelectMode`, `selectedItemIds`, `sortStrategy`
- **Dialogs**: `showTipDialog`, `showCountryDialog`, `showShareSheet`
- **Contact picker**: `showContactPicker`, `showUnassignPicker`, `phoneContacts`, `contactSearch`, `selectedContactIds`, `singleAssignItemId`

Or better yet, extract to `useBillDetail()` hook.

### Missing React.memo

`BillCard`, `FilterChip`, `SettingsRow`, `SegmentedControl` are reusable components that re-render on every parent change. Should wrap with `React.memo`.

### TanStack Query Unused

Imported, configured in `lib/queryClient.ts`, provider wrapped in `_layout.tsx`, but no queries use it — Convex handles all data fetching. Either remove or use for external API calls (Google Places).

---

## 9. CSS, Tailwind, NativeWind & React Native Reusables — Deep Review

### 9.1 Global CSS & Theme Token Design

`global.css` is well-structured. It uses a `@theme` block with semantic CSS custom properties and complete dark mode overrides via `@media (prefers-color-scheme: dark)`.

**Strengths:**
- Semantic naming: `--color-primary`, `--color-destructive`, `--color-muted-foreground` — not raw color numbers
- Complete dark mode: every light token has a dark equivalent
- Domain-specific tokens: bill state colors (`--color-state-unsplit`, `--color-state-split`, `--color-state-unresolved`) and Pro accent (`--color-pro`, `--color-pro-bg`)
- Proper HSL-like structure enabling opacity modifiers (`bg-primary/10`)

**No issues found** — this is the strongest part of the styling layer.

### 9.2 Stack Versions & Configuration

| Package | Version | Notes |
|---|---|---|
| `nativewind` | `5.0.0-preview.3` | v5 preview — uses `react-native-css` runtime, CSS-first approach |
| `tailwindcss` | `4.2.1` | v4 — config via `@theme` in CSS, no `tailwind.config.js` |
| `@tailwindcss/postcss` | `4.2.1` | v4 PostCSS plugin (replaces old `tailwindcss` plugin) |
| `react-native-css` | `3.0.6` | NativeWind v5 runtime — patched (`patches/react-native-css@3.0.6.patch`) |
| `tailwind-merge` | `3.5.0` | Used in `cn()` helper for class deduplication |
| `class-variance-authority` | `0.7.1` | Used for component variant definitions |
| `clsx` | `2.1.1` | Used in `cn()` helper for conditional classes |
| `lightningcss` | `1.30.1` | Pinned override — CSS compilation engine for Tailwind v4 |

**Configuration files:**
- `metro.config.js`: Correctly wraps Expo config with `withNativeWind()`, `inlineRem: 16`
- `postcss.config.mjs`: Uses `@tailwindcss/postcss` — correct for Tailwind v4
- `global.css`: Uses `@import "tailwindcss/theme.css"`, `@import "nativewind/theme"`, and `@theme` block — correct NativeWind v5 + Tailwind v4 pattern
- `nativewind-env.d.ts`: Properly references `react-native-css` types
- No `tailwind.config.js` — correct, Tailwind v4 configures entirely through CSS

**NativeWind v5 specifics:**
- v5 is CSS-first: styles are defined via standard CSS, compiled by Tailwind v4, and applied at runtime by `react-native-css`
- The `@theme` block in `global.css` replaces the old `theme.extend` in `tailwind.config.js`
- `@import "nativewind/theme"` provides RN-specific base styles
- The patched `react-native-css` suggests an upstream bug was hit — verify if newer versions fix it

**Risk:** `nativewind@5.0.0-preview.3` is pre-release. API surface may change before stable. Pin exact version (already done) and monitor the NativeWind changelog.

### 9.3 className vs style Usage by File

| File | className | style | className % | Assessment |
|---|---|---|---|---|
| `components/ui/button.tsx` | 6 | 0 | 100% | Excellent |
| `components/ui/card.tsx` | 4 | 0 | 100% | Excellent |
| `components/ui/input.tsx` | 2 | 0 | 100% | Excellent |
| `components/ui/badge.tsx` | 2 | 0 | 100% | Excellent |
| `components/ui/text.tsx` | 2 | 0 | 100% | Excellent |
| `components/settings/*.tsx` | 11 | 0 | 100% | Excellent |
| `app/(auth)/login.tsx` | 8 | 4 | 67% | Acceptable |
| `app/setup.tsx` | 8 | 3 | 73% | Acceptable |
| `app/(tabs)/settings.tsx` | 10 | 5 | 67% | Mixed |
| `app/(tabs)/index.tsx` | 22 | 19 | 54% | Poor |
| `app/bills/new.tsx` | 18 | 15 | 55% | Poor |
| `app/bills/[id].tsx` | 25 | 32 | 44% | Poor |

**Pattern:** UI primitives are 100% className. Route/screen files degrade to ~50% inline styles. The styling rules (`docs/rules/styling.md`) say to use `className` — screens don't follow this.

### 9.4 React Native Reusables — Usage vs Bypass

The codebase defines proper RNR primitives using CVA (class-variance-authority) in `components/ui/`. However, route files frequently bypass them with raw RN components.

**Available RNR components and their adoption:**

| RNR Component | Where Used Correctly | Where Bypassed |
|---|---|---|
| `Button` (CVA variants: default, destructive, outline, secondary, ghost, link; sizes: default, sm, lg, icon) | `login.tsx`, `setup.tsx`, `new.tsx` | `[id].tsx` tip dialog buttons use raw `Pressable` + inline styles. `settings.tsx` tip buttons use raw `Pressable`. `[id].tsx` bulk toolbar buttons use raw `Pressable`. |
| `Card` + `CardHeader/Title/Content` | Not used in any route file | `index.tsx` BillCard uses raw `Pressable` with inline `borderLeftWidth`/`borderLeftColor`. Should wrap with `<Card>`. |
| `Badge` (CVA variants: default, secondary, destructive, outline) | Not used in any route file | `index.tsx:89-104` state badges use raw `View` + inline styling. `[id].tsx:454-462` same pattern. Should use `<Badge variant="...">`. |
| `Input` | `new.tsx`, `[id].tsx` (item editing) | Correct usage throughout |
| `Text` (CVA variants: h1-h4, p, blockquote, code, lead, large, small, muted) | Used everywhere for basic text | **Variants underused** — most text uses raw `className` like `text-xl font-bold` instead of `<Text variant="h3">`. Inline `fontSize`/`fontWeight` styles bypass it entirely. |

**Impact of bypassing RNR components:**
- Lost variant consistency — tip buttons in `settings.tsx` and `setup.tsx` manually recreate what `Button variant="outline"` provides
- Lost dark mode handling — raw `Pressable` + hardcoded colors skip the theme system
- Lost accessibility — `Button` includes proper `accessibilityRole`, raw `Pressable` does not

### 9.5 CVA Pattern Usage

The CVA setup in `button.tsx` is comprehensive with 6 variants and 4 sizes. This is a strength.

**However, CVA is only used in `components/ui/`**. Screen-level components that show variant-like behavior (e.g., FilterChip active/inactive, tip button selected/unselected, state badge by bill state) are implemented with manual ternaries and inline styles instead of CVA.

**Example — FilterChip should use CVA:**
```ts
// Current: app/(tabs)/index.tsx — manual ternary in className
className={cn(
  'flex-row items-center rounded-full px-3 py-1.5',
  isActive ? 'bg-primary' : 'bg-muted/50'
)}

// Better: components/bills/FilterChip.tsx with CVA
const filterChipVariants = cva('flex-row items-center rounded-full px-3 py-1.5', {
  variants: {
    active: {
      true: 'bg-primary',
      false: 'bg-muted/50',
    },
  },
});
```

**Example — Tip button should use Button variant or CVA:**
```ts
// Current: app/(tabs)/settings.tsx:207-233 — full inline styles per button
<Pressable
  style={{
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148,163,184,0.06)',
    borderWidth: 1,
    borderColor: isSelected ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148,163,184,0.12)',
    alignItems: 'center',
  }}
>

// Better: use Button variant="outline" with active state, or new CVA component
```

### 9.6 Inline Style Anti-Patterns — Detailed Audit

#### `app/(tabs)/index.tsx` — 19 inline style instances

| Line(s) | Element | What's Inline | Could Be className? |
|---|---|---|---|
| 81-82 | BillCard border | `borderLeftWidth: 3, borderLeftColor: stateStyle.color` | Partially — `border-l-[3px]` works, color is dynamic |
| 90-98 | State badge | `flexDirection, paddingHorizontal, paddingVertical, borderRadius, backgroundColor` | YES — `flex-row px-2 py-0.5 rounded-full` + dynamic bg |
| 100 | State dot | `width: 6, height: 6, borderRadius: 3, backgroundColor` | YES — `w-1.5 h-1.5 rounded-full` + dynamic bg |
| 126-133 | Avatar image | `width: 28, height: 28, borderRadius: 14, borderWidth, borderColor, marginLeft` | YES — `w-7 h-7 rounded-full border` |
| 136-153 | Avatar fallback | Complete box model | YES — `w-7 h-7 rounded-full items-center justify-center` |
| 157-173 | Overflow count | Complete box model | YES — similar pattern as avatar |
| 182-188 | Progress bar | `height, borderRadius, backgroundColor, width` | Partially — width is dynamic (percentage) |
| 241 | Filter count badge | `minWidth, height, borderRadius, backgroundColor, paddingHorizontal` | YES — `min-w-[18px] h-[18px] rounded-full px-1` |
| 420-427 | Profile avatar | `width, height, borderRadius, backgroundColor, alignItems, justifyContent` | YES — `w-9 h-9 rounded-full bg-primary/10 items-center justify-center` |
| 498-506 | Delete button | All box model | YES — `flex-1 bg-destructive rounded-xl items-center justify-center` |

#### `app/bills/[id].tsx` — 32 inline style instances (worst offender)

| Line(s) | Element | What's Inline | Could Be className? |
|---|---|---|---|
| 454-462 | State badge | Flex, padding, radius, bg | YES — use `<Badge>` component |
| 486-493 | Delete circle | Dimensions, radius, bg | YES — `w-8 h-8 rounded-full bg-destructive/15 items-center justify-center` |
| 575-582 | Sort pill | Padding, radius, bg, border | YES — `px-3 py-1 rounded-full bg-muted/30 border border-border` |
| 1295-1326 | Tip dialog buttons (6x) | Complete styling repeated 6 times | YES — use `<Button variant="outline">` or extract `TipOptionButton` |
| 1362-1372 | Country options (2x) | Complete styling repeated 2 times | YES — use `<Button variant="ghost">` |
| 1407-1468 | Bulk toolbar (3 buttons) | Identical inline structure | YES — use `<Button>` with icon slot |

#### `app/bills/new.tsx` — 15 inline style instances

| Line(s) | Element | What's Inline | Could Be className? |
|---|---|---|---|
| 346 | Scan background | `backgroundColor: '#121a2e'` | YES — `bg-[#121a2e]` or define as token |
| 356-363 | Drag indicator | Width, height, radius, bg | YES — `w-9 h-1 rounded-full bg-white/30` |
| 378-393 | Error toast | Complete box model | YES — `flex-row items-center gap-2 px-4 py-3 rounded-xl bg-destructive/15 border border-destructive/30` |
| 472-481 | Scan avatar | Dimensions, radius, bg, alignment | YES — `w-16 h-16 rounded-2xl bg-primary/15 items-center justify-center` |

#### `app/(tabs)/settings.tsx` — 5 inline style instances

| Line(s) | Element | What's Inline | Could Be className? |
|---|---|---|---|
| 183-191 | State selector | Flex, padding, radius, bg | YES |
| 207-233 | Tip buttons (6x) | Complete styling per button | YES — extract component |

**Summary:** ~180 inline style instances across route files. Approximately **65% could be converted to className**. The remaining 35% involve truly dynamic values (state-driven colors, animated widths).

### 9.7 Color Consistency — Token Usage vs Hardcoded Hex

The global.css tokens are excellent but **underused in route files**. The same semantic intent is achieved through different mechanisms in different files:

| Semantic Intent | Token (in global.css) | Hardcoded Instances |
|---|---|---|
| Primary text/accent | `text-primary` → `#0a7ea4` / `#38bdf8` | `#38bdf8` in `new.tsx:420`, `settings.tsx:212`, `SettingsRow.tsx:45` |
| Muted text | `text-muted-foreground` → `#64748b` / `#94a3b8` | `#8b9cc0` in `index.tsx:170,249`, `#94a3b8` in `SettingsRow.tsx:196,226` |
| Background (dark) | `bg-background` → `#0f172a` | `#121a2e` in `new.tsx:346`, `#1a2540` in `index.tsx:132,147` |
| Destructive | `text-destructive` / `bg-destructive` | `#ef4444` in `new.tsx:542` |
| Primary with opacity | `bg-primary/10`, `bg-primary/15` | `rgba(56, 189, 248, 0.1)` in `index.tsx` (3x), `rgba(56, 189, 248, 0.15)` in `settings.tsx` |

**Impact:** If the primary color token changes in `global.css`, the 15+ hardcoded instances throughout route files will not update, creating visual inconsistency.

### 9.8 Dark Mode Handling — Three Conflicting Approaches

The codebase uses three different dark mode strategies, creating inconsistency:

**Approach 1 — CSS tokens (correct):**
`global.css` overrides tokens in `@media (prefers-color-scheme: dark)`. Components using `className` with token-based classes (e.g., `bg-background`, `text-foreground`) automatically adapt.

**Approach 2 — NativeWind `dark:` prefix (acceptable):**
Used in `button.tsx` and `text.tsx`: `dark:border-input`. Works with NativeWind's color scheme detection.

**Approach 3 — Manual colorScheme check (anti-pattern):**
Found in multiple route files:
```ts
// login.tsx:85,101
color={colorScheme === 'dark' ? '#38bdf8' : '#0a7ea4'}

// new.tsx:484
color={colorScheme === 'dark' ? '#0c1a2a' : '#ffffff'}

// [id].tsx:1486-1487
backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#f1f5f9'
```

This duplicates what CSS tokens already handle. Every manual check is a maintenance liability — if the theme palette changes, these checks won't update.

**Recommendation:** Eliminate all Approach 3 instances. Use `text-primary` (which automatically resolves to the correct light/dark value) instead of `color={colorScheme === 'dark' ? '#38bdf8' : '#0a7ea4'}`.

### 9.9 `cn()` Helper — Underused

`lib/cn.ts` provides `clsx + tailwind-merge` but is only used in `components/ui/` primitives. Route files use string template literals:

```ts
// Current pattern (SegmentedControl.tsx, FilterChip, multiple screens)
className={`rounded-md px-3 py-1.5 ${value === opt.value ? 'bg-card shadow-sm' : ''}`}

// Correct pattern
className={cn('rounded-md px-3 py-1.5', value === opt.value && 'bg-card shadow-sm')}
```

Benefits of `cn()`: handles falsy values cleanly, merges conflicting Tailwind classes, no empty string concatenation.

### 9.10 Spacing & Layout Inconsistencies

| Pattern | Variations Found | Files |
|---|---|---|
| Card horizontal padding | `px-4`, `px-5`, `px-6`, `px-7` | home, settings, detail, new |
| Section vertical gap | `gap-4`, `gap-6`, `gap-8` | settings, setup, detail |
| Item list horizontal padding | `px-5` (home), `px-7` (detail) | index.tsx, [id].tsx |
| Button padding | `px-4 py-2` (default), `px-6` (custom), inline `paddingVertical: 10` | button.tsx, settings.tsx |
| Border radius | `rounded-md` (buttons), `rounded-xl` (cards), `rounded-2xl` (larger cards), `rounded-full` (pills) | Consistent within type |

The inconsistent horizontal padding across screens means the same content type (list items) has different left margins on different screens.

### 9.11 Typography — Inline vs Token

**Good:** RNR `Text` component has CVA variants (`h1`-`h4`, `p`, `large`, `small`, `muted`).

**Bad:** These variants are rarely used. Instead, most text styling is done via raw className or inline styles:

```ts
// Variant exists but not used
<Text className="text-2xl font-bold">  // Should be <Text variant="h2">

// Inline fontSize bypasses the system entirely
<Text style={{ fontSize: 17, fontWeight: '700', color: '#e8ecf4' }}>
```

**Hardcoded font sizes found in style objects:**
- `fontSize: 11` — `index.tsx` (state badge label)
- `fontSize: 13` — `new.tsx`, `index.tsx`, `[id].tsx` (multiple instances)
- `fontSize: 14` — `settings.tsx`, `[id].tsx`
- `fontSize: 15` — `[id].tsx`
- `fontSize: 17` — `new.tsx`, `[id].tsx`
- `fontSize: 28` — `new.tsx` (scan title)

These should use Tailwind text size classes (`text-xs` = 12, `text-sm` = 14, `text-base` = 16, `text-lg` = 18, `text-xl` = 20, `text-2xl` = 24).

Similarly, `fontWeight` values (`'500'`, `'600'`, `'700'`) appear in inline styles instead of `font-medium`, `font-semibold`, `font-bold`.

### 9.12 Repeated Styling Patterns Not Abstracted

**Avatar pattern** — used in 4+ places with identical inline styling:
```ts
// Repeated in index.tsx (BillCard), index.tsx (profile), [id].tsx (contacts), new.tsx (unassign)
<View style={{
  width: 28, height: 28, borderRadius: 14,
  backgroundColor: 'rgba(56, 189, 248, 0.1)',
  alignItems: 'center', justifyContent: 'center'
}}>
  <Text style={{ fontSize: 12, fontWeight: '600', color: '#38bdf8' }}>
    {initials}
  </Text>
</View>
```
Should be an `<Avatar size="sm" />` component.

**Tip option button** — identical in `setup.tsx` and `settings.tsx` (6 buttons each):
```ts
<Pressable style={{
  flex: 1, paddingVertical: 10, borderRadius: 10,
  backgroundColor: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148,163,184,0.06)',
  borderWidth: 1,
  borderColor: isActive ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148,163,184,0.12)',
  alignItems: 'center',
}}>
```
Should be a `<TipOptionButton percent={10} isActive={selected === 10} onPress={...} />` component.

**Dialog option button** — repeated in `[id].tsx` for tip dialog (6x) and country dialog (2x):
Same pattern as tip buttons. Should use `<Button variant="outline">` or a `DialogOption` component.

### 9.13 Styling Rules Compliance

Per `docs/rules/styling.md`:

| Rule | Compliance | Notes |
|---|---|---|
| Use `className` not inline styles | ~60% | Primitives: 100%. Routes: 44-67% |
| Define semantic colors in Tailwind config | 90% | global.css tokens are good, but hardcoded hex bypasses them |
| Support light/dark/system themes | 80% | CSS tokens work, but manual colorScheme checks break the pattern |
| Base components from React Native Reusables | 50% | Primitives defined, but `Card` and `Badge` bypassed in routes |
| Use `cn()` for conditional classes | 30% | Only in `components/ui/`, not in routes |

---

## 10. i18n Completeness

### Good Coverage

~150+ keys in `translations/en.ts` with matching Spanish translations. Most UI strings go through `useT()`.

### Gaps

- `app/(tabs)/_layout.tsx` — Tab titles `"Home"` and `"Settings"` are hardcoded in English
- `app/bills/new.tsx:542` — `'Delete'` string hardcoded
- Convex error messages (`'Bill not found'`, etc.) are in English only — acceptable for backend errors but frontend should map them to i18n keys

---

## 11. Security

### Critical

- **No auth checks on any Convex function** — All queries and mutations are publicly accessible. Any user can read/modify any other user's data.

### High

- **API key logged to console** — `lib/places.ts:22` logs the Google Places API key via `console.log`. Remove immediately.
- **Unsafe JWT parsing** — `lib/auth.ts:174-177` parses JWT without signature validation. Acceptable for client-side display but should not be trusted for authorization decisions.

### Medium

- **No input sanitization** — Bill names, item names, contact names have no max length or character validation in Convex mutations. Could cause storage bloat or display issues.
- **No CSRF protection** on OAuth redirect URI validation.
- **Missing env vars in `.env.example`** — `RESEND_API_KEY`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` not documented.

---

## 12. Performance

- **No pagination** on `bills.list()` / `bills.listByState()` — returns all bills.
- **`recalculateAmounts()`** in `convex/bills.ts` has O(items x contacts x items) complexity — will slow down with large bills.
- **Missing `React.memo`** on `BillCard`, `FilterChip`, settings components.
- **No `useMemo`** on derived data in `app/bills/[id].tsx` — sorted items, filtered contacts recalculate on every render.
- **No error boundary** — unhandled errors crash the entire app instead of showing a fallback UI.
- **No offline detection** — network failures show blank screens.

---

## 13. Atomic Task List

Each task is a single, independently executable fix. Ordered by severity.

### Critical

| # | Task | File(s) | Description |
|---|---|---|---|
| C1 | Add auth middleware to all Convex functions | `convex/*.ts` | Add `ctx.auth.getUserIdentity()` check to every query and mutation. Throw `ConvexError` if unauthenticated. Verify resource ownership on bill operations. |
| C2 | Decompose bill detail screen | `app/bills/[id].tsx` | Extract into `components/bills/BillItemRow.tsx`, `BillItemEditor.tsx`, `BillSummary.tsx`, `BillShareSheet.tsx`, `ContactPickerSheet.tsx`, and `hooks/useBillDetail.ts`. Target: main file under 300 lines. |
| C3 | Remove API key console.log | `lib/places.ts:22` | Delete the `console.log` that prints the Google Places API key. |

### High

| # | Task | File(s) | Description |
|---|---|---|---|
| H1 | Decompose new bill screen | `app/bills/new.tsx` | Extract `SwipeableItem` (line 789), `KeyboardDoneButton` (line 814), `ScanningOverlay`, and `ItemReviewForm` into separate component files. |
| H2 | Extract inline components from home screen | `app/(tabs)/index.tsx` | Move `BillCard` and `FilterChip` to `components/bills/`. Move `relativeTime()` to `lib/date.ts` and `stateLabel()` to `lib/billHelpers.ts`. |
| H3 | Extract shared validators | `convex/schema.ts`, `convex/bills.ts` | Create `convex/validators.ts` with shared `billStateValidator`, `itemValidator`, `contactValidator`. Import in schema and mutations. |
| H4 | Extract bill state color constants | `app/(tabs)/index.tsx:27-32` | Move `STATE_STYLES` to `constants/billStyles.ts`. Import in home screen and anywhere else that uses bill state colors. |
| H5 | Extract TipSelector component | `app/setup.tsx`, `app/(tabs)/settings.tsx` | Create `components/TipSelector.tsx` with the shared tip percentage button group. Replace duplicate code in both screens. |
| H6 | Add pagination to bill queries | `convex/bills.ts` | Add `paginationOpts` to `list` and `listByState` queries using Convex's `.paginate()`. Update frontend to use `usePaginatedQuery`. |
| H7 | Consolidate screen-level state | `app/bills/[id].tsx` | Group 14+ `useState` calls into logical groups via a `useBillDetail()` hook or `useReducer`. |
| H8 | Replace nested ternaries with helper | `app/bills/new.tsx:486-498` | Extract `getScanStatusLabel()` function using `switch` statement. Remove duplicated condition checks. |

### Medium

| # | Task | File(s) | Description |
|---|---|---|---|
| M1 | Fix single-letter variable names | `app/bills/[id].tsx:291,886` | Rename `ci` → `contactIdx`, `n` → `contactName`, `i` → `billItem` in complex callbacks. |
| M2 | Add env validation on startup | `constants/env.ts` | Use Zod to validate all `EXPO_PUBLIC_*` vars exist at startup. Fail fast with clear error messages. |
| M3 | Move redirect URI to env | `lib/auth.ts:9` | Move `'rondas://callback'` to `constants/env.ts` as `REDIRECT_URI`. |
| M4 | Add input sanitization to mutations | `convex/bills.ts`, `convex/users.ts` | Add max length validators on string fields (bill name: 200, item name: 200, contact name: 100). |
| M5 | Use `cn()` consistently | `components/settings/SegmentedControl.tsx`, others | Replace string template className construction with `cn()` helper throughout. |
| M6 | Add React.memo to reusable components | `BillCard`, `FilterChip`, `SettingsRow`, `SegmentedControl` | Wrap with `React.memo` after extraction. Add `useCallback` for passed handlers. |
| M7 | Add error boundary | `app/_layout.tsx` | Wrap root layout children with a React Error Boundary component that shows a fallback UI. |
| M8 | Internationalize tab titles | `app/(tabs)/_layout.tsx` | Replace hardcoded `"Home"` and `"Settings"` with `t.tabs_home` and `t.tabs_settings`. |
| M9 | Document all env vars | `.env.example` | Add `RESEND_API_KEY`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `GOOGLE_PLACES_API_KEY` with comments. |
| M10 | Add timeout to Gemini API call | `convex/ai.ts` | Add `AbortController` with 30s timeout on the `fetch` call to Gemini API. |
| M11 | Extract `pickImage` branches | `app/(tabs)/index.tsx:311-367` | Split 56-line function into `pickFromCamera()` and `pickFromLibrary()` helpers for clarity. |
| M12 | Add `useMemo` for derived data | `app/bills/[id].tsx` | Memoize sorted items, filtered contacts, and computed totals that recalculate on every render. |
| M13 | Fix rounding remainder distribution | `convex/bills.ts` `recalculateAmounts()` | After rounding contact amounts, distribute the remainder (total - sum) to the first contact so amounts always sum correctly. |

### High — Styling

| # | Task | File(s) | Description |
|---|---|---|---|
| HS1 | Replace hardcoded hex colors with CSS tokens | `index.tsx`, `new.tsx`, `[id].tsx`, `settings.tsx`, `SettingsRow.tsx` | Replace all hardcoded hex values (`#38bdf8`, `#8b9cc0`, `#1a2540`, `#121a2e`, etc.) with their corresponding Tailwind token classes (`text-primary`, `text-muted-foreground`, `bg-background`, etc.). See section 9.7 for full mapping. |
| HS2 | Convert static inline styles to className | `index.tsx`, `[id].tsx`, `new.tsx`, `settings.tsx` | Audit all `style={{ }}` instances. Convert static layout properties (padding, border-radius, flex, alignment, dimensions) to NativeWind className. Keep only truly dynamic values (animated widths, state-driven colors) as inline styles. ~65% of 180 instances can be converted. See section 9.6 tables. |
| HS3 | Eliminate manual colorScheme checks | `login.tsx:85,101`, `new.tsx:484`, `[id].tsx:1486-1487` | Remove all `colorScheme === 'dark' ? X : Y` patterns. Replace with CSS token classes (e.g., `text-primary` instead of ternary). The `@theme` dark mode overrides in `global.css` handle this automatically. |
| HS4 | Use RNR Card component for BillCard | `app/(tabs)/index.tsx:82-205` | Wrap BillCard with `<Card>` from `components/ui/card.tsx` instead of raw `Pressable`. Apply `border-l-[3px]` via className. Use `CardContent` for the inner layout. |
| HS5 | Use RNR Badge component for state indicators | `index.tsx:89-104`, `[id].tsx:454-462` | Replace raw `View` state badges with `<Badge>` from `components/ui/badge.tsx`. Add bill-state variants to CVA definition (unsplit, split, unresolved, draft) that reference the `--color-state-*` CSS tokens. |
| HS6 | Use RNR Button for dialog/toolbar actions | `[id].tsx:1295-1326,1362-1372,1407-1468`, `settings.tsx:207-233` | Replace raw `Pressable` + full inline styles with `<Button variant="outline">` or `<Button variant="ghost">` from `components/ui/button.tsx`. This eliminates ~20 inline style blocks. |

### Medium — Styling

| # | Task | File(s) | Description |
|---|---|---|---|
| MS1 | Create Avatar component | New: `components/ui/avatar.tsx` | Extract the repeated avatar pattern (circular View with initials/image, used 4+ times) into a reusable `<Avatar size="sm" \| "md" \| "lg">` component using CVA. Replace all inline avatar instances. |
| MS2 | Add bill-state variants to Badge CVA | `components/ui/badge.tsx` | Add CVA variants for `draft`, `unsplit`, `split`, `unresolved` that reference `--color-state-*` tokens from `global.css`. |
| MS3 | Add FilterChip component with CVA | New: `components/bills/FilterChip.tsx` | Create CVA-based FilterChip with `active` variant. Replace manual ternary className in `index.tsx`. |
| MS4 | Replace inline fontSize/fontWeight with Tailwind classes | All route files | Replace `style={{ fontSize: 13 }}` → `className="text-xs"`, `fontSize: 17` → `text-[17px]` or `text-base`, `fontWeight: '600'` → `font-semibold`, etc. See section 9.11 for full list. |
| MS5 | Use `cn()` in all conditional classNames | `SegmentedControl.tsx`, `index.tsx`, `settings.tsx`, `setup.tsx`, `new.tsx`, `[id].tsx` | Replace all `` className={`base ${condition ? 'a' : 'b'}`} `` with `className={cn('base', condition && 'a')}`. |
| MS6 | Standardize horizontal padding across screens | `index.tsx`, `[id].tsx`, `new.tsx`, `settings.tsx` | Choose one standard: `px-5` for list items, `px-6` for sections. Apply consistently. Currently varies between `px-4`, `px-5`, `px-6`, `px-7`. |

### Low

| # | Task | File(s) | Description |
|---|---|---|---|
| L1 | Remove deprecated `constants/theme.ts` | `constants/theme.ts`, `hooks/use-theme-color.ts` | Delete the deprecated Colors object. Update `use-theme-color.ts` to use Tailwind tokens or remove if unused. |
| L2 | Unify IconSymbol prop types | `components/ui/icon-symbol.tsx`, `icon-symbol.ios.tsx` | Ensure both implementations accept the same `style` prop type (`StyleProp<ViewStyle>`). |
| L3 | Remove or use TanStack Query | `lib/queryClient.ts`, `app/_layout.tsx` | Either remove the unused `QueryClientProvider` and dependency, or use it for external API calls (Google Places). |
| L4 | Add image compression constants | Create `constants/media.ts` | Define `IMAGE_MAX_WIDTH: 1024`, `IMAGE_QUALITY: 0.8` as named constants. Use in `new.tsx` and `index.tsx`. |
| L5 | Move Gemini model to env/constant | `convex/ai.ts` | Extract `'gemini-2.5-flash'` to an environment variable or `GEMINI_MODEL` constant. |
| L6 | Add offline detection | `app/_layout.tsx` | Use `NetInfo` to detect offline state and show a banner when network is unavailable. |
| L7 | Extract auth redirect logic to hook | `app/_layout.tsx:38-51` | Create `useAuthRedirect()` hook to encapsulate the multi-condition routing logic. |
| L8 | Add `createdAt`/`updatedAt` to schema | `convex/schema.ts` | Add timestamp fields to `bills` and `scans` tables for sorting and audit trails. |
| L9 | Add retry logic to notifications | `convex/notifications.ts` | Add exponential backoff retry (max 3 attempts) for email and WhatsApp send failures. |
| L10 | Replace US state Alert.alert with modal | `app/(tabs)/settings.tsx:169-181` | Replace `Alert.alert` for US state selection with a proper scrollable picker/modal component. |
| L11 | Add Text variant usage | All route files | Replace raw `className="text-2xl font-bold"` with `<Text variant="h2">` where RNR Text variants match. Reduces class duplication and enforces typography consistency. |
| L12 | Verify `react-native-css` patch still needed | `patches/react-native-css@3.0.6.patch` | Check if `react-native-css` >=3.0.7 fixes the `path.split` bug. If so, remove the patch and upgrade. |
