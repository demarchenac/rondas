# Codebase Review #2 — 2026-03-29

Follow-up review after the refactoring pass documented in `codebase-01.md`. Focuses on what's left.

## Scoring Summary (vs Review #1)

| Category | Review #1 | Review #2 | Notes |
|---|---|---|---|
| File structure | 7/10 | 9/10 | Extracted components, shared helpers, clear layout |
| Component architecture | 5/10 | 8/10 | Major decomposition done; `new.tsx` and `[id].tsx` still large |
| Variable naming | 7/10 | 9/10 | Single-letter vars fixed |
| Logic complexity | 6/10 | 8/10 | Guards, helper extraction, nested ternaries resolved |
| TypeScript & type safety | 7/10 | 7/10 | `as any` casts and non-null assertions remain |
| Convex backend | 5/10 | 7/10 | Auth on bills, but scans still unprotected |
| Constants & hardcoded values | 5/10 | 8/10 | Most extracted; a few hex colors remain |
| State management | 7/10 | 9/10 | Dialog consolidation, useMemo, React.memo |
| Styling consistency | 6/10 | 9/10 | ~130 inline styles converted; only dynamic values remain |
| i18n | 8/10 | 9/10 | Tab titles, WhatsApp message localized; a few gaps left |
| Security | 4/10 | 7/10 | Auth on bills, env validation, API key log removed; scans exposed |
| Performance | 6/10 | 8/10 | Pagination, React.memo, useMemo added |

---

## 1. Security — Scan Operations Unprotected

The scan queries and mutations have no ownership verification. Any user can read, update, or delete any scan by ID.

| Function | File | Issue |
|---|---|---|
| `getScan` | `convex/scans.ts:28` | No `userId` param, no ownership check |
| `updateScan` | `convex/scans.ts:15` | No `userId` param, no ownership check |
| `deleteScan` | `convex/scans.ts:35` | No `userId` param, no ownership check |

---

## 2. Type Safety — `as any` and Non-null Assertions

| File | Line | Code | Issue |
|---|---|---|---|
| `app/(tabs)/index.tsx` | 75 | `billId as any` | Should be `Id<'bills'>` |
| `app/bills/new.tsx` | 110 | `scanId as any` | Should be `Id<'scans'>` |
| `app/bills/new.tsx` | 222, 254 | `user!.id` | Non-null assertion on optional user |
| `app/bills/new.tsx` | 489 | `scanProgress.result!.items` | Non-null assertion; use optional chaining |
| `app/bills/[id].tsx` | 46 | `user?.id ?? ''` | Empty string fallback silently fails |
| `convex/ai.ts` | 167 | `response.body!.getReader()` | Should null-check body first |
| `convex/ai.ts` | 256 | `parsed.category as any` | Unsafe cast in validation |
| `components/bills/BillShareSheet.tsx` | 28 | `contact: any` in props | Should be properly typed |

---

## 3. Security — Debug Logging with Sensitive Data

`lib/AuthContext.tsx` has console.log statements that leak sensitive info:

| Line | Log | Issue |
|---|---|---|
| 130 | `'[Auth] Opening browser for provider:'` | Logs auth provider |
| 155 | `'[Auth] Authenticated user:'` | **Logs user email** |

These should be removed or gated behind a `__DEV__` check.

---

## 4. Missing React.memo on Extracted Components

These default-exported components receive props from parent but aren't memoized:

- `components/bills/BillShareSheet.tsx`
- `components/bills/ContactPickerSheet.tsx`
- `components/bills/UnassignPickerSheet.tsx`
- `components/bills/TipDialog.tsx`
- `components/bills/CountryDialog.tsx`

---

## 5. Remaining Hardcoded Colors

A few hex colors remain outside BillInfographic (which is intentional):

| File | Line | Value | Should Be |
|---|---|---|---|
| `components/bills/KeyboardDoneButton.tsx` | 40 | `bg-[#1a2540]`, `border-[#263354]` | Theme tokens (`bg-background`, `border-border`) |
| `components/bills/BillCard.tsx` | 64 | `border-[#1a2540]` | `border-background` |
| `components/bills/ContactPickerSheet.tsx` | 62 | `placeholderTextColor="#64748b"` | `text-muted-foreground` color ref |
| `components/bills/UnassignPickerSheet.tsx` | 70 | `'#ef4444'`, `'#64748b'` | `iconColors.destructive`, `iconColors.muted` |
| `app/(tabs)/index.tsx` | 220, 258 | `"#ef4444"`, `"#fff"` | `iconColors.destructive`, theme token |

---

## 6. Remaining Hardcoded Strings (Missing i18n)

| File | Line | String | Suggested Key |
|---|---|---|---|
| `app/bills/new.tsx` | 513 | `"Delete"` | `t.delete` |
| `components/bills/BillShareSheet.tsx` | 103 | `'item'` / `'items'` | `t.item_singular` / `t.item_plural` |
| `app/(tabs)/settings.tsx` | 127 | `"$1.99/mo"` | `t.pro_price` (or dynamic from RevenueCat) |
| `app/(auth)/login.tsx` | 82-104 | `'AppleOAuth'`, `'GoogleOAuth'` | Extract to constants |

---

## 7. File Size — Still Over 300 Lines

| File | Lines | Extractable Pieces |
|---|---|---|
| `app/bills/[id].tsx` | ~875 | WhatsApp message builder → `lib/whatsapp.ts`; item editing section → `BillItemEditor.tsx` |
| `app/bills/new.tsx` | ~758 | Scanning overlay → `ScanningOverlay.tsx`; item review section → `ItemReviewForm.tsx` |

---

## 8. Inconsistent Patterns

- **Callback style in settings.tsx** — uses inline arrow functions (`const handleX = (v) => { ... };`) instead of `useCallback` like other screens. Causes unnecessary re-renders.
- **Export style** — most bill components use `export default`, but `SettingsRow` and `SegmentedControl` use named exports via `React.memo`. Should be consistent.
- **billRef pattern** in `new.tsx:69-70` — `const billRef = useRef(bill); billRef.current = bill;` is unusual. Standard pattern is to add `bill` to useCallback dependency arrays.

---

## 9. Convex — Minor Issues

- **`convex/uploads.ts`** — placeholder that throws `'UploadThing not yet configured'`. Either implement or remove.
- **Notification env vars** — `RESEND_API_KEY` and `WHATSAPP_API_TOKEN` accessed via `process.env` without the `requireEnv` validation pattern used elsewhere.
- **STATE_STYLES duplication** — bill state colors exist in both `global.css` (CSS tokens) and `lib/billHelpers.ts` (JS object with hex values + Tailwind classes). Single source of truth would be cleaner.

---

## 10. Setup Screen Side Effect

`app/setup.tsx:31-35` — `setLanguage` called inside `useState` initializer, causing a store mutation during render. Should be in a `useEffect`.

---

## Atomic Task List

### Critical

| # | Task | File(s) | Description |
|---|---|---|---|
| C1 | Add auth to scan operations | `convex/scans.ts` | Add `userId` param and ownership verification to `getScan`, `updateScan`, `deleteScan`. Update call sites in `app/bills/new.tsx`. |
| C2 | Remove sensitive console.logs | `lib/AuthContext.tsx` | Remove or gate with `__DEV__` the console.log statements at lines 130, 132, 138, 153, 155. |

### High

| # | Task | File(s) | Description |
|---|---|---|---|
| H1 | Fix `as any` type casts | `index.tsx`, `new.tsx`, `ai.ts`, `BillShareSheet.tsx` | Replace `as any` with proper Convex `Id<>` types. Type the `contact` prop in BillShareSheet interface. |
| H2 | Replace non-null assertions | `new.tsx`, `ai.ts`, `[id].tsx` | Add null guards before `user!.id`, `response.body!`, `scanProgress.result!`. Handle `userId ?? ''` fallback explicitly. |
| H3 | Add React.memo to sheet components | `BillShareSheet`, `ContactPickerSheet`, `UnassignPickerSheet`, `TipDialog`, `CountryDialog` | Wrap default exports with `React.memo`. |

### Medium

| # | Task | File(s) | Description |
|---|---|---|---|
| M1 | Replace remaining hardcoded colors | `KeyboardDoneButton.tsx`, `BillCard.tsx`, `ContactPickerSheet.tsx`, `UnassignPickerSheet.tsx`, `index.tsx` | Replace `#1a2540`, `#263354`, `#ef4444`, `#64748b`, `#fff` with theme tokens or `iconColors` references. |
| M2 | Fix remaining i18n gaps | `new.tsx`, `BillShareSheet.tsx`, `settings.tsx`, `login.tsx` | Add i18n keys for "Delete", "item"/"items", "$1.99/mo", OAuth provider names. |
| M3 | Use useCallback in settings.tsx | `app/(tabs)/settings.tsx` | Convert inline handlers to `useCallback` for consistency and to prevent unnecessary re-renders. |
| M4 | Validate notification env vars | `convex/notifications.ts` | Add null checks for `RESEND_API_KEY` and `WHATSAPP_API_TOKEN` with descriptive error messages, matching the pattern in `ai.ts`. |
| M5 | Fix setup.tsx side effect | `app/setup.tsx` | Move `setLanguage` from `useState` initializer to `useEffect`. |

### Low

| # | Task | File(s) | Description |
|---|---|---|---|
| L1 | Extract ScanningOverlay from new.tsx | `app/bills/new.tsx` | Move scanning overlay UI (~60 lines) to `components/bills/ScanningOverlay.tsx`. |
| L2 | Extract WhatsApp message builder | `app/bills/[id].tsx` | Move `handleSendWhatsApp` message construction to `lib/whatsapp.ts` as a pure function. |
| L3 | Remove uploads.ts placeholder | `convex/uploads.ts` | Delete the file or implement UploadThing — a throwing stub adds no value. |
| L4 | Normalize billRef pattern | `app/bills/new.tsx` | Replace `useRef(bill); billRef.current = bill` with proper useCallback dependencies. |
| L5 | Consistent export style | `components/settings/*.tsx` | Standardize on `export default React.memo(Component)` across all components. |
