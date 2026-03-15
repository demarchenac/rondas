# Subscriptions (RevenueCat)

## Tiers

| Feature | Free | Pro ($1.99/mo) |
|---|---|---|
| Bills per month | 2 | Unlimited |
| Split types | Equal only | Equal + item-based |
| Contacts per bill | 3 | Unlimited |
| Bill history | 30 days | Full |
| Theme | Light only | Light / Dark / System |
| Language toggle | Yes | Yes |
| Payment tracking | No | Yes |

## Implementation

- Use `react-native-purchases` (RevenueCat SDK)
- Sync subscription status to a Zustand store on app launch
- Gate features client-side by checking subscription status
- When a user hits a gated feature, show the paywall screen — never silently fail
- Support restore purchases for users who reinstall
