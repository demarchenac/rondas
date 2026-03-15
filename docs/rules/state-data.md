# State & Data

## Zustand

- One store per domain: `useThemeStore`, `useBillStore`, `useSubscriptionStore`
- Keep stores flat — avoid deeply nested state
- Use `persist` middleware with AsyncStorage for theme and language preferences
- Never put server state in Zustand — that belongs in TanStack Query / Convex

## TanStack Query

- Use for any data fetching outside of Convex's real-time queries
- Set `staleTime` appropriately — don't refetch data that rarely changes
- Use `queryKey` factories to keep keys consistent (e.g., `billKeys.list()`, `billKeys.detail(id)`)

## TanStack Form + Zod

- Define Zod schemas first, then pass to TanStack Form
- Co-locate form schemas with their form components
- Use Zod for all runtime validation (API responses, user input)
- Show field-level errors inline, not as toasts
