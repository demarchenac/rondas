<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Rondas iOS app (Expo + React Native). The integration covers the full user journey — from first sign-in through onboarding, bill scanning, contact assignment, sharing, and Pro subscription purchase.

**Files created or modified:**

- `app.config.ts` — added `posthogProjectToken` and `posthogHost` to the `extra` block so they flow to the app via `expo-constants`
- `apps/mobile/.env.local` — added `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` (gitignore coverage confirmed)
- `lib/posthog.ts` *(new)* — PostHog client singleton using `Constants.expoConfig.extra`, with lifecycle capture, batching, and flag preloading
- `app/_layout.tsx` — wrapped root with `PostHogProvider` (autocapture on), added `useEffect` for manual screen tracking with `posthog.screen()` via Expo Router's `usePathname`
- `lib/AuthContext.tsx` — `posthog.identify()` on session restore and sign-in callback; `posthog.capture('user_signed_in')` on login; `posthog.reset()` + `posthog.capture('user_signed_out')` on logout
- `app/setup.tsx` — `posthog.capture('onboarding_completed')` with country, language, tip, and theme properties
- `app/bills/new.tsx` — scan funnel events (`bill_scan_started`, `bill_scan_succeeded`, `bill_scan_failed`), `bill_created` for both scan and manual paths, `bill_manual_entry_started`
- `app/paywall.tsx` — `paywall_viewed` on mount, `subscription_purchased` (with plan), `subscription_restored`, `promo_code_redeemed`
- `app/bills/share.tsx` — `bill_shared` for individual WhatsApp, group WhatsApp, and full-bill summary; `payment_marked_paid` when toggling a contact to paid

| Event | Description | File |
|---|---|---|
| `user_signed_in` | User successfully signs in (email, Apple, or Google) | `lib/AuthContext.tsx` |
| `user_signed_out` | User signs out | `lib/AuthContext.tsx` |
| `onboarding_completed` | New user completes initial setup (country, language, tip, theme) | `app/setup.tsx` |
| `bill_scan_started` | User taps scan button to begin AI receipt extraction | `app/bills/new.tsx` |
| `bill_scan_succeeded` | AI scan completed and items extracted | `app/bills/new.tsx` |
| `bill_scan_failed` | AI scan failed (not_a_receipt, timeout, api, or generic error) | `app/bills/new.tsx` |
| `bill_manual_entry_started` | User chooses manual entry instead of scanning | `app/bills/new.tsx` |
| `bill_created` | Bill successfully saved (creation_method: scan or manual) | `app/bills/new.tsx` |
| `paywall_viewed` | User opens the Pro upgrade paywall screen | `app/paywall.tsx` |
| `subscription_purchased` | User completes a Pro purchase (plan: monthly or yearly) | `app/paywall.tsx` |
| `subscription_restored` | User restores a prior Pro purchase | `app/paywall.tsx` |
| `promo_code_redeemed` | User successfully redeems a promo code | `app/paywall.tsx` |
| `bill_shared` | User shares a bill via WhatsApp (individual, group, or bill summary) | `app/bills/share.tsx` |
| `payment_marked_paid` | User marks a contact's payment as paid on the share screen | `app/bills/share.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/420761/dashboard/1678524)
- [New user sign-ins](https://us.posthog.com/project/420761/insights/kbR7lnFi)
- [Bills created by method (scan vs manual)](https://us.posthog.com/project/420761/insights/n3kr0rLl)
- [Scan success rate](https://us.posthog.com/project/420761/insights/2BehSrxR)
- [Paywall → Purchase funnel](https://us.posthog.com/project/420761/insights/cfA5YVyx)
- [Bill sharing activity](https://us.posthog.com/project/420761/insights/Ay9OS7N1)

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-expo/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
