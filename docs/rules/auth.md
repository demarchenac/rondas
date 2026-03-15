# Authentication (WorkOS)

## Providers

- Email OTP (primary)
- Sign in with Apple
- Sign in with Google

## Flow

1. User authenticates via WorkOS AuthKit
2. On success, sync user to Convex `users` table (upsert by WorkOS user ID)
3. Store auth token securely on device
4. Root layout checks auth state → redirect to `(auth)/login` or `(tabs)/`

## Auth Guard

- Root `_layout.tsx` handles all auth routing
- Unauthenticated users see only the `(auth)` group
- Show a loading/splash screen while auth state resolves — never flash the wrong screen

## Contact Data Privacy

- All contact data stays on-device — never upload to backend
- Only send contact names/phone numbers/emails when the user explicitly triggers a notification
