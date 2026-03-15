# Backend (Convex)

## File Structure

```
convex/
├── schema.ts        # All table definitions
├── bills.ts         # Bill queries, mutations, actions
├── users.ts         # User queries, mutations
├── notifications.ts # WhatsApp + email actions
└── ai.ts            # Claude Vision API action
```

## Conventions

- **Queries**: read-only, return data. Use for real-time subscriptions from the client.
- **Mutations**: write data. Always validate inputs with Zod-like argument validators.
- **Actions**: side effects (API calls, file uploads). Use for Claude API, Resend, WhatsApp.
- Always define argument and return validators on every function
- Use `ctx.auth` to scope all queries/mutations to the authenticated user
- Never trust client-sent user IDs — always derive from auth context

## Schema Design

- `users`: synced from WorkOS on login (id, email, name, avatar)
- `bills`: owned by a user (userId, items, imageUrl, state, splitStrategy, contacts, payments)
- Bill states: `"unsplit"` | `"split"` | `"unresolved"`
