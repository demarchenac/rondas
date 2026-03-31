# State & Data

## Zustand

- One store per domain: `useThemeStore`, `useSettingsStore`
- Keep stores flat — avoid deeply nested state
- Use `persist` middleware with AsyncStorage for theme and language preferences
- Never put server state in Zustand — that belongs in Convex

## Convex (Real-time Data)

- Use `useQuery` / `usePaginatedQuery` from `convex/react` for all data fetching
- Convex handles real-time subscriptions, caching, and optimistic updates
- Use `usePaginatedQuery` with `{ initialNumItems: 20 }` for large lists
- TanStack Query is **not used** — Convex handles all data needs

## Screen-Level State

- Use a single `activeDialog` state for multiple modal/dialog toggles:
  ```ts
  type DialogType = 'tip' | 'country' | 'share' | null;
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  ```
- Group related state into custom hooks when a screen exceeds ~300 lines
- Use `useMemo` for derived computations (subtotals, tax, filtered lists)
- Use `useCallback` for event handlers passed to child components

## TanStack Form + Zod

- Define Zod schemas first, then pass to TanStack Form
- Co-locate form schemas with their form components
- Use Zod for all runtime validation (API responses, user input)
- Show field-level errors inline, not as toasts
- Use for form-style inputs with a submit button (e.g., item edit card with "Done")
- For inline edits without a submit button (e.g., bill name, tax), use `useBufferedInput` hook instead

## Inline Input Buffering

- Real-time Convex subscriptions overwrite input values during typing — never bind `value` directly to server state on editable fields
- Use `useBufferedInput(serverValue, onCommit, delay?)` from `@/hooks/useBufferedInput` for inline edits
- The hook maintains local state while focused, debounces commits (default 500ms), and syncs from server only when blurred
- Use for: bill name, tax input, or any field that commits on blur without a submit button

## Environment Variables

- All env vars validated on startup via `requireEnv()` in `constants/env.ts`
- Documented in `.env.example` with comments
- Access via `ENV.CONVEX_URL`, `ENV.WORKOS_CLIENT_ID`, `ENV.REDIRECT_URI`
