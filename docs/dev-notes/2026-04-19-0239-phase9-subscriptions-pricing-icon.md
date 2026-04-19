---
created: 2026-04-19T07:39:12Z
status: inbox
org: me-myself-and-i
project: rondas
cwd: /home/demar/projects/me-myself-and-i/rondas
tags: [subscriptions, revenuecat, pricing, feature-gating, promo-codes, app-icon, swipe-to-delete, ios26, ota]
---

# Phase 9 subscriptions, pricing analysis, app icon y bug fixes

## Contexto

Sesion larga cubriendo bug fixes de iOS 26, UX polish (swipe-to-delete, tip dialog backdrop), analisis de pricing/monetizacion, implementacion de Phase 9 (subscriptions con RevenueCat), y diseno del app icon.

## Que se hizo

### Bug fixes

- **fix: usePreventRemove crash en iOS 26** — `app/bills/new.tsx` importaba `usePreventRemove` de `@react-navigation/core` que tiene un `NavigationContext` diferente al de expo-router canary. Reemplazado por `useEffect` + `beforeRemove` listener usando `useNavigation` de expo-router.
- **fix: tip dialog backdrop invisible** — `components/bills/TipDialog.tsx` usaba `bg-black/50` de NativeWind que no funciona dentro de `Modal` (root nativo separado). Cambiado a inline `style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}`.
- **fix: OTAs crasheaban** — El native build de iOS tenia `async-storage@3.0.2` pero el codigo local tenia `2.2.0`. Mismatch de modulo nativo = crash del bundle OTA. Solucion: nuevo native build con async-storage 2.2.0.

### UX: swipe-to-delete con haptics

- Nuevo `components/bills/SwipeableRow.tsx` — reemplaza `ReanimatedSwipeable` con patron custom de 3 zonas: idle (0px), reveal (-80px), commit (-160px+). Haptic feedback en cada transicion (Medium → Heavy → Success notification).
- Aplicado en `BillItemCard.tsx` (bill detail), `app/bills/new.tsx` (scan review), `app/(tabs)/index.tsx` (home bill list).

### Pricing y monetizacion

- Analisis de costos a $9.900 COP/mes con margenes por escala (20 a 50.000 Pro users).
- Precios regionalizados: CO $9.900, USA $4.99, Latam ~$3.49, Europa ~$4.49.
- Yearly: $89.900 COP (~25% descuento, equivale a 3 meses gratis).
- Analisis de conversion rates (1%, 2%, 5%) y break-even.
- Documentado en `docs/research/pricing.schema.md`.

### Phase 9: subscriptions (RevenueCat)

**Archivos creados:**
- `stores/useSubscriptionStore.ts` — Zustand store para isPro, proOverride, totalBillsCreated
- `lib/revenueCat.ts` — SDK wrapper (init, purchase, restore, presentCustomerCenter, presentRemotePaywall)
- `hooks/useProGate.ts` — hook compartido (isPro, inTrial, unlocked, showPaywall)
- `hooks/useSubscriptionSync.ts` — sincroniza Convex proOverride + RevenueCat en app launch
- `app/paywall.tsx` — paywall modal con features Pro, precios localizados, promo code input, fallback a paywall remoto de RevenueCat
- `convex/promoCodes.ts` — redeemCode, createCode, getCode mutations/queries

**Archivos modificados:**
- `convex/schema.ts` — proOverride, proOverrideAt, totalBillsCreated en users + tabla promoCodes
- `convex/users.ts` — getProStatus query
- `convex/bills.ts` — gate en create (3 bills/mes free, incrementa totalBillsCreated)
- `convex/ai.ts` — gate en extractBillItems (Pro o inTrial)
- `app/_layout.tsx` — useSubscriptionSync + paywall screen registration
- `app/(tabs)/settings.tsx` — Pro card funcional (paywall link o Customer Center), promo code input
- `app/(tabs)/index.tsx` — bill history lock (>90 dias sin Pro = candado)
- `components/bills/FAB.tsx` — AI scan gate + manual entry option + bill count gate
- `components/bills/BillCard.tsx` — locked prop con candado icon overlay
- `components/bills/detail/PeopleSummary.tsx` — payment tracking gate
- `components/ui/icon-symbol.tsx` — agregado `lock.fill`
- `constants/env.ts` — REVENUECAT_IOS_KEY, REVENUECAT_ANDROID_KEY
- `.env.local` — API keys de RevenueCat (test)
- `.env.example` — documentacion de nuevas env vars
- `translations/en.ts` y `es.ts` — ~30 nuevos strings (paywall, gates, promo codes)
- `docs/rules/subscriptions.md` — pricing regionalizado, promo codes, feature gating rules
- `docs/plan/progress.md` — Phase 9.4 promo codes tasks

**Paquetes instalados:**
- `react-native-purchases` (RevenueCat SDK)
- `react-native-purchases-ui` (Customer Center + remote paywall fallback)

### App icon

- Iteracion con Gemini AI para generar app icon: concepto de "dos manos pasandose una factura".
- Varias rondas de refinamiento: colores distintos por mano (amber = dando, azul = recibiendo), simplificacion a mitten shapes, padding correcto, motion dots.
- Resultado final: icon flat 2D con flow direccional claro.
- Pendiente: port a Figma para version vectorial + efecto Liquid Glass (iOS 26).

### Graphify

- Generado knowledge graph del proyecto: 375 nodos, 294 edges, 122 comunidades.
- Obsidian vault exportado a `/mnt/d/Obsidian/vaults/kb/projects/me-myself-and-i/rondas/docs/grafo/` (497 notes).

## Decisiones clave

1. **Feature gating usage-based con reverse trial** — Las primeras 2 bills tienen TODO desbloqueado. Despues: 3 bills/mes, sin AI scan (solo manual entry), sin payment tracking, historial 90 dias. Split por items, contactos, WhatsApp, dark theme = gratis siempre. **Por que:** reverse trial tiene 5-8% conversion vs 2-3% de freemium clasico (aversion a la perdida).

2. **Promo codes app-managed (no store fee)** — Tabla `promoCodes` en Convex con `redeemCode` mutation que setea `user.proOverride = true`. Bypass total de App Store/Google Play. **Por que:** codigos regalo como "GiftedByDemar" no deben generar comision de Apple. Store Offer Codes se usan solo para descuentos de lanzamiento ($4.900 COP x 2 meses).

3. **Paywall hybrid (custom + remoto)** — Custom paywall como primario (diseño Rondas, i18n, copy). Si no hay Offering disponible (productos no configurados), fallback automatico al paywall remoto de RevenueCat. **Por que:** custom da control total; remoto es safety net y permite A/B testing sin deploy.

4. **Thinking budget bajado a 512 tokens** — Gemini 2.5 Flash tenia 1024. Bajado a 512 para reducir ~40% del costo de AI por scan. **Por que:** thinking tokens son 23x mas caros que input.

## Problemas encontrados

- **OTA crasheaba por mismatch de async-storage**: native build tenia v3.0.2, codigo local tenia v2.2.0. Solucion: nuevo native build + submit a TestFlight.
- **expo-router canary tiene fork interno de @react-navigation/core**: importar hooks de `@react-navigation/core` directo causa dual `NavigationContext`. Solucion: usar solo hooks de `expo-router` o implementar manualmente con `beforeRemove` event.
- **expo-router no exporta `usePreventRemove` en runtime (solo types)**: los d.ts dicen que si pero el JS build chain esta roto. Solucion: reemplazar con `useEffect` + `navigation.addListener('beforeRemove', ...)`.
- **NativeWind classes no funcionan dentro de `Modal`**: `Modal` crea root nativo separado donde NativeWind context no propaga. Solucion: inline `style` para background colors en modals.

## Pendiente

### Configuracion manual (dashboards web)
- [ ] Crear productos de suscripcion en App Store Connect (monthly + yearly, precios regionalizados)
- [ ] Conectar App Store Connect con RevenueCat (Shared Secret)
- [ ] Crear Offering "default" con packages monthly + annual en RevenueCat
- [ ] Crear entitlement `pro` en RevenueCat
- [ ] Agregar env vars RevenueCat al environment `production` de EAS
- [ ] Crear Offer Codes de lanzamiento en App Store Connect
- [ ] Google Play Console: productos equivalentes

### Deploy
- [ ] `npx convex deploy` para desplegar schema changes + promoCodes
- [ ] `eas build --platform ios` nuevo native build (react-native-purchases nativo)
- [ ] `eas submit --platform ios` a TestFlight
- [ ] Testing en sandbox (compras, restore, promo codes)
- [ ] Submit para Apple Review (app + IAP juntos)

### App icon
- [ ] Port a Figma como vectores
- [ ] Aplicar efecto Liquid Glass (iOS 26)
- [ ] Exportar como PNG 1024x1024
- [ ] Reemplazar `assets/images/icon.png`
- [ ] Usar como Subscription Image en App Store Connect

### Commit
- [ ] Commit de todos los cambios de Phase 9 + swipe-to-delete + pricing docs

## Referencias

- Commits: `18e9e93`, `0e7c6cc`
- EAS Build: https://expo.dev/accounts/demarchenac/projects/rondas/builds/af239992-7f9e-4399-9607-ff81129ddb1d
- RevenueCat docs: https://www.revenuecat.com/docs/getting-started/installation/reactnative
- Pricing schema: `docs/research/pricing.schema.md`
- Subscription rules: `docs/rules/subscriptions.md`
- Progress tracker: `docs/plan/progress.md`
