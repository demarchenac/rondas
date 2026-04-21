# Subscriptions (RevenueCat)

## Tiers (Usage-based with Reverse Trial)

First 2 bills: ALL features unlocked (reverse trial). After trial:

| Feature | Free (post-trial) | Pro |
|---|---|---|
| AI receipt scanning | Manual entry only | Unlimited scans |
| Bills per month | 3 | Unlimited |
| Split types | Equal + item-based | Equal + item-based |
| Contacts per bill | Unlimited | Unlimited |
| Bill history | 90 days (locked after) | Full |
| Theme | Light / Dark / System | Light / Dark / System |
| Language toggle | Yes | Yes |
| Payment tracking | No | Yes |
| WhatsApp sharing | Yes | Yes |
| Infographic | Yes | Yes |

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
