# Subscriptions (RevenueCat)

## Tiers

| Feature | Free | Pro |
|---|---|---|
| Bills per month | 2 | Unlimited |
| Split types | Equal only | Equal + item-based |
| Contacts per bill | 3 | Unlimited |
| Bill history | 30 days | Full |
| Theme | Light only | Light / Dark / System |
| Language toggle | Yes | Yes |
| Payment tracking | No | Yes |

## Pricing (regionalized)

| Region | Mensual | Anual (~25% off) |
|---|---|---|
| Colombia | $9.900 COP | $89.900 COP |
| USA | $4.99 USD | $44.99 USD |
| Latam (MX, AR, CL, PE, BR) | ~$3.49 USD equiv. | ~$31.49 USD |
| Europa / otros | $4.49 USD | $40.49 USD |

Configure per-country pricing in App Store Connect and Google Play Console. RevenueCat resolves the correct price automatically via Offerings.

## Promo Codes

### Launch discount (store-managed)

- **Apple**: Offer Codes in App Store Connect → $4.900 COP × 2 months for Colombia
- **Google**: Promo Codes in Google Play Console
- Redeem via `presentCodeRedemptionSheet()` (iOS) or in-app input (Android)
- RevenueCat detects offer codes automatically — no custom logic needed

### Gift codes (app-managed, no store fee)

For permanent Pro grants (e.g., "GiftedByDemar") — bypasses App Store entirely:

- Convex `promo_codes` table: `{ code, type: 'lifetime' | 'duration', expiresAt?, maxUses, uses }`
- `redeemCode` mutation validates code, increments `uses`, sets `user.proOverride = true`
- Feature gating checks: `revenueCatIsPro || user.proOverride`
- No Apple/Google commission — 100% controlled

## Implementation

- Use `react-native-purchases` (RevenueCat SDK)
- Sync subscription status to a Zustand store on app launch
- Gate features client-side by checking: `revenueCatIsPro || user.proOverride`
- When a user hits a gated feature, show the paywall screen — never silently fail
- Support restore purchases for users who reinstall
- Promo code input accessible from settings screen
