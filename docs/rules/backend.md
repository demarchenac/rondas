# Backend (Convex)

## File Structure

```
convex/
├── schema.ts        # All table definitions
├── validators.ts    # Shared validators (billState, billItem, contact, etc.)
├── bills.ts         # Bill queries, mutations (paginated)
├── users.ts         # User queries, mutations
├── scans.ts         # Scan progress tracking
├── notifications.ts # WhatsApp + email actions (with retry)
└── ai.ts            # Gemini OCR action (with streaming + timeout)
```

## Conventions

- **Queries**: read-only, return data. Use for real-time subscriptions from the client.
- **Mutations**: write data. Always validate inputs with argument validators.
- **Actions**: side effects (API calls, file uploads). Use for Gemini API, Resend, WhatsApp.
- Always define argument validators on every function
- Add `userId` to all bill queries/mutations and verify ownership before access
- Use `assertMaxLength()` to validate string inputs (bill name: 200, item name: 200, contact name: 100)

## Shared Validators

All reusable validators live in `convex/validators.ts`:
- `billStateValidator`, `splitStrategyValidator`, `categoryValidator`
- `billItemValidator`, `billContactValidator`, `contactArgValidator`
- `locationValidator`, `scanStatusValidator`, `scanResultValidator`

Import and use these in both `schema.ts` and mutation arg definitions — never duplicate.

## Schema Design

- `users`: synced from WorkOS on login (workosId, email, name, avatar, config)
- `bills`: owned by a user (userId, items, state, contacts, createdAt, updatedAt)
- `scans`: temporary OCR progress tracking (userId, status, result)
- Bill states: `"draft"` | `"unsplit"` | `"split"` | `"unresolved"`

## Pagination

- `list` and `listByState` queries use `.paginate(paginationOpts)` — not `.collect()`
- Frontend uses `usePaginatedQuery` with `{ initialNumItems: 20 }`

## Error Handling

- External API calls (Gemini, WhatsApp, email) use timeouts and retry logic
- Gemini: 60s AbortController timeout
- Notifications: `withRetry` wrapper with 3 attempts and exponential backoff
