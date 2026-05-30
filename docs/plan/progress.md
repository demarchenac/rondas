# Rondas — Progress Tracker

> Last updated: 2026-04-21 (session 10 — Subscriptions, feature gating, app icon, Apple setup)

---

## Phase 1 — Project Setup & Infrastructure

### 1.1 Expo Project Bootstrap

- [x] Initialize Expo project with `create-expo-app` using TypeScript template
- [x] Configure Expo Router file-based navigation
- [x] Set up folder structure (`app/`, `components/`, `lib/`, `stores/`, `constants/`)
- [x] Configure path aliases in `tsconfig.json`
- [x] Set up `.env` file and `expo-constants` for environment variables

### 1.2 Styling Setup

- [x] Install and configure NativeWind
- [x] Configure `tailwind.config.js` with custom color tokens
- [x] Verify NativeWind works with a test component
- [x] Update NativeWind to v5 preview.3
- [x] Restructure dark mode to use `@media (prefers-color-scheme: dark)` instead of custom `dark-*` tokens
- [x] Patch `react-native-css` path.split bug via pnpm patch
- [x] Simplify Input component for NativeWind v5 compatibility

### 1.3 UI Components Setup

- [x] Install React Native Reusables
- [x] Configure base theme tokens (colors, radius, spacing)
- [x] Test a sample Reusables component renders correctly
- [x] Install `expo-blur` and `expo-linear-gradient` for glass UI effects
- [x] Install `expo-image-manipulator` for image compression
- [x] Install `react-native-keyboard-controller` for keyboard UX
- [x] Install `@expo/ngrok` for tunnel development
- [x] Add `GestureHandlerRootView` to root layout
- [x] Add `KeyboardProvider` to root layout

### 1.4 State & Data Layer

- [x] Install and configure Zustand
- [x] ~~Install and configure TanStack Query with QueryClientProvider~~ (removed — Convex handles all data)
- [x] Install TanStack Form and Zod
- [x] Add env validation via `requireEnv()` in `constants/env.ts`

### 1.5 Backend — Convex

- [x] Create Convex project
- [x] Install Convex client in Expo app
- [x] Configure ConvexProvider in app root
- [x] Verify Convex connection with a test query

### 1.6 Authentication — WorkOS

- [x] Create WorkOS project and configure AuthKit
- [x] Install WorkOS AuthKit React Native SDK
- [x] Configure Email OTP provider
- [x] Configure Sign in with Apple provider
- [x] Configure Sign in with Google provider
- [x] Create Convex `users` table and sync WorkOS user on login
- [x] First-login setup dialog with country, tip, language, and theme
- [x] Store user config in Convex (synced across devices)
- [x] Detect new vs returning user via Convex query on login

### 1.7 File Uploads — UploadThing *(deferred — post-launch)*

- [ ] Create UploadThing project
- [x] Install UploadThing client in Expo app
- [ ] Configure upload route for bill images

> Note: Images are sent as base64 directly to Gemini. Photo persistence deferred to post-launch.

### 1.8 Email — Resend + React Email *(deferred — post-launch)*

- [ ] Create Resend account and obtain API key
- [x] Set up React Email project in `/emails` directory
- [x] Configure Resend client in Convex backend

> Note: Not configured. Notifications handled via WhatsApp deep links for v1.

### 1.9 WhatsApp — Meta Cloud API *(deferred — post-launch)*

- [ ] Create Meta developer account and app
- [ ] Enable WhatsApp product on Meta app
- [ ] Add test phone numbers to sandbox
- [ ] Store WhatsApp API credentials in environment variables
- [x] Create a Convex action to send a WhatsApp message

> Note: WhatsApp sharing works via `wa.me/` deep links. Cloud API deferred to post-launch.

---

## Phase 2 — Authentication Screens

### 2.1 Onboarding / Auth Flow

- [x] Create `/app/(auth)/login.tsx` screen
- [x] Build Email OTP input form using TanStack Form + Zod
- [x] Build OTP verification input form
- [x] Add "Sign in with Apple" button
- [x] Add "Sign in with Google" button
- [x] Handle auth state and redirect to home on success
- [x] Create `/app/(auth)/_layout.tsx` to protect auth routes

> Note: Email OTP and verification are handled by WorkOS hosted UI via browser flow.

### 2.2 Auth Guard

- [x] Create root layout that checks auth state
- [x] Redirect unauthenticated users to login screen
- [x] Redirect authenticated users to home screen
- [x] Handle loading state while checking auth
- [x] Fix Android Google OAuth 'dismiss' result handling (Chrome Custom Tab)
- [x] Fix deep link handler not clearing loading on error/missing-code paths
- [x] Add 15s safety timeout for deep link delivery after browser dismiss

---

## Phase 3 — Home Screen

### 3.1 Layout & Navigation

- [x] Create bottom tab navigator with: Home, Settings
- [x] Create `/app/(tabs)/index.tsx` as the home screen
- [x] Create `/app/(tabs)/_layout.tsx` for tab configuration

### 3.2 Bill List

- [x] Create Convex `bills` table schema
- [x] Create Convex query to fetch all bills for current user
- [x] Build `BillCard` component (name, date, total, state badge)
- [x] Render bills list using `FlashList`
- [x] Add empty state UI when no bills exist
- [x] Add paginated bill queries with `usePaginatedQuery` + "Load more"

### 3.3 Bill State Badge

- [x] Create `StateBadge` component with three variants: Unsplit, Split, Unresolved
- [x] Apply correct color per state

### 3.4 Filters

- [x] Build filter bar component above bill list
- [x] Add filter by bill state (multi-select toggle)
- [x] Add filter by contact (searchable multi-select in FilterSheet, client-side filtering)
- [x] Add filter by amount range (CurrencyInput with dynamic bounds + auto-swap)
- [x] Wire filters to Convex query or client-side filter logic
- [x] Add "Clear filters" button

### 3.5 Floating Action Button (FAB)

- [x] Create `FAB` component with "+" icon
- [x] On press, show action sheet: "Take Photo" or "Choose from Library"
- [x] Handle camera permission request
- [x] Handle photo library permission request
- [x] On photo selected/captured, navigate to new bill screen with image URI

---

## Phase 4 — Bill Creation & AI Scanning

### 4.1 Image Handling

- [x] Create `/app/bills/new.tsx` screen
- [x] Display captured/selected image
- [ ] Upload image to UploadThing and store URL
- [x] Compress image before AI extraction (resize to 1024px, JPEG 80%)
- [x] Redesign scan state with full-screen image background
- [x] Add glass-style scan button with BlurView and primary tint
- [x] Add bottom gradient overlay with LinearGradient (navy theme)
- [x] Add blur overlay scanning state with centered spinner

> Note: Image is sent as base64 directly to Gemini via Convex action. UploadThing deferred to later.

### 4.2 AI/OCR Item Extraction

- [x] Create Convex action that calls Gemini with bill image
- [x] Write prompt to extract: item name, quantity, unit price, subtotal
- [x] Parse Gemini's JSON response into structured line items
- [x] Handle extraction errors with a manual entry fallback
- [x] Show loading indicator while extraction runs
- [x] Upgrade to Gemini 2.5 Flash (from 2.0 Flash Lite)
- [x] Add item deduplication and name normalization post-extraction
- [x] Gemini streaming (SSE) with real-time scan progress via Convex reactive queries
- [x] Scan progress table with status tracking (analyzing → thinking → extracting → complete)
- [x] Items appear in overlay as Gemini streams them
- [x] Refined prompt: extract all lines flat, code-side filtering of $0 items and notes
- [x] Thinking enabled (1024 tokens) for better accuracy

> Note: Using Gemini 2.5 Flash with SSE streaming. Items stream in real-time via Convex reactivity. Add-ons/extras appear as separate line items.

### 4.3 Item Review Screen

- [x] Display extracted items in an editable list
- [x] Allow user to edit item name
- [x] Allow user to edit item price
- [x] Allow user to delete an item
- [x] Allow user to add a new item manually
- [x] Display subtotal, tax, and total
- [x] Allow user to edit total manually
- [x] Add "Confirm Items" button to proceed
- [x] Redesign to flat receipt-style rows (remove card-within-card)
- [x] Add tap-to-edit with inline expanded form (qty, price, subtotal)
- [x] Add swipe-to-delete via Swipeable gesture
- [x] Add swipe/tap conflict prevention (onSwipeableOpenStartDrag)
- [x] Add KeyboardAwareScrollView for input field visibility
- [x] Add floating Done button for keyboard dismiss
- [x] Add usePreventRemove for unsaved data protection
- [x] Add sticky total footer above confirm button
- [x] Fix confirm to save calculatedTotal instead of original bill total
- [x] Present as modal with drag indicator and dismiss gesture

---

## Phase 5 — Bill Splitting & Contact Assignment

> Note: Split strategy selection (equal split) deferred. Item-based split implemented directly in the bill detail screen.

### 5.1 Item-Based Split (via Bill Detail)

- [x] Assign contact to item via native iPhone contact picker
- [x] Request contacts permission
- [x] Display assigned contact chips with name and photo
- [x] Allow removing a contact from an item (tap chip)
- [x] Allow assigning multiple contacts to a single item
- [x] Multi-select mode for batch contact assignment
- [x] Custom multi-select contact picker with search and photos
- [x] Calculate each contact's proportional amount (items + tax/tip share)
- [x] Auto-update bill state: unsplit → unresolved → split
- [x] Import contact photo from iPhone
- [x] Bulk edit toolbar: assign, unassign, delete
- [x] Batch unassign contacts (multi-select with confirmation)
- [x] Migrate contact-item references from indices to item IDs
- [x] Auto-cleanup stale contact references on item deletion
- [x] Create split strategy via overflow menu (Equal Split)
- [x] Build number-of-people stepper for equal split

### 5.2 Backend Mutations

- [x] Create `assignContactToItem` mutation with deduplication
- [x] Create `assignContactToItems` batch mutation
- [x] Create `removeContactFromItem` mutation with cleanup
- [x] Create `togglePaymentStatus` mutation
- [x] Create `update` mutation for name, items, tax, tip, state
- [x] `computeBillState` helper for auto state transitions
- [x] `recalculateAmounts` helper for proportional splitting
- [x] Add ownership verification (`userId`) to all bill queries/mutations
- [x] Add input sanitization (max string lengths) to mutations
- [x] Fix rounding remainder distribution in `recalculateAmounts`
- [x] Extract shared validators to `convex/validators.ts`
- [x] Add `createdAt`/`updatedAt` timestamps to bills

---

## Phase 6 — Summary & Notifications

### 6.1 Share & Pay Modal

- [x] Create Share & Pay modal (replaces separate summary screen)
- [x] Display per-contact breakdown with avatar, items, amount
- [x] Two-column item layout per contact
- [x] Paid/Unpaid toggle per contact
- [x] WhatsApp deep link sharing with formatted message (WhatsApp SVG icon)
- [x] Receipt-style infographic generation (ViewShot + expo-sharing)
- [x] Redesigned infographic: tear edges, country badge, per-bill currency, translated labels
- [x] "Resumen generado con la app Rondas" footer in messages and infographic
- [x] Redesigned WhatsApp message with full breakdown (location, date, subtotal, tax, before-tip, tip, total)
- [x] Extract WhatsApp message builder to `lib/whatsapp.ts`
- [ ] Create React Email template for per-contact bill summary *(deferred — post-launch)*
- [ ] Create Convex action to send email via Resend *(deferred — post-launch)*

### 6.2 Payment Tracking

- [x] Toggle contact payment status via mutation
- [x] Auto-update bill state to "Split" when all paid
- [x] Persist payment state in bills table

---

## Phase 7 — Bill Detail & History

### 7.1 Bill Detail Screen

- [x] Create `/app/bills/[id].tsx` screen
- [x] Editable bill name
- [x] Display all items with tap-to-edit
- [x] Swipe-to-delete items with height collapse animation
- [x] Editable tax (IVA) and tip (propina)
- [x] Display subtotal and calculated total
- [x] Display location (📍 address) and time metadata (🕐 relative)
- [x] State badge (Draft, Unsplit, Unresolved, Split)
- [x] Category badge (🍽️ Dining / 🛒 Retail / 🔧 Service)
- [x] Computed tax based on country + category (informational for CO)
- [x] Per-bill tip percentage with tip dialog (not global setting)
- [x] Per-bill country with country picker dialog
- [x] Dynamic tax label (Impoconsumo/IVA/Sales Tax)
- [x] Fix impoconsumo calculation: base = subtotal / (1 + rate), tax = base * rate
- [x] Fix total calculation in update mutation for tax-included countries
- [x] Compute tip on base amount (excluding tax) for tax-inclusive countries
- [x] Show base (without tax) as "Subtotal" instead of tax-inclusive total
- [x] Add "Before tip" row between tax and tip for visibility
- [x] Update infographic to match bill detail breakdown layout
- [x] Item sorting strategies (receipt order, price asc/desc, alpha asc/desc)
- [x] Refactor item operations from index-based to ID-based
- [x] Delete bill button with confirmation
- [x] Draft state with "Confirm Items" button
- [x] Navigate back to home

### 7.2 Bill List Interactions

- [x] Tapping a bill card navigates to bill detail screen
- [x] Swipe-to-delete on bill card with confirmation dialog
- [x] ~~Pull-to-refresh on bills list~~ (N/A — Convex real-time subscriptions auto-update, no manual refetch needed)

### 7.3 Bill Creation Flow

- [x] Bills created as draft after Gemini scan
- [x] Items get server-generated UUIDs
- [x] Navigate to detail screen for editing
- [x] usePreventRemove for unsaved data protection
- [x] Background location resolution (native + optional Google Places)
- [x] EXIF time extraction for photo timestamp
- [x] Place name from reverse geocoding as bill name

---

## Phase 8 — Settings

### 8.1 Settings Screen

- [x] Create `/app/(tabs)/settings.tsx` screen
- [x] Display user avatar, name, and email

### 8.2 Theme Toggle

- [x] Create Zustand store for theme preference
- [x] Build theme toggle (Light / Dark / System)
- [x] Apply theme to NativeWind using `colorScheme`
- [x] Persist theme preference to AsyncStorage

### 8.3 Language & i18n

- [x] Install `expo-localization` for device language detection
- [x] Create English translation file (`translations/en.ts`)
- [x] Create Spanish translation file (`translations/es.ts`, typed as `typeof en`)
- [x] Create `useT()` hook (`lib/i18n.ts`) reading from Zustand store
- [x] Translate all UI strings (~150) across all 6 screens
- [x] Build language selector in settings (English / Spanish)
- [x] Persist language preference to AsyncStorage + Convex
- [x] Apply selected language across the entire app (reactive via Zustand)

### 8.4 Billing Settings

- [x] Country picker (Colombia / USA) with segmented control
- [x] US state selector (modal picker with search — replaced Alert)
- [x] Default tip percentage chips (0%, 5%, 10%, 15%, 18%, 20%)
- [x] Tax constants per country + receipt category
- [x] Per-bill currency formatting (COP / USD suffix)
- [x] Settings sync to Convex on every change (fire-and-forget)

### 8.5 Scanning Preferences

- [x] Create useSettingsStore with AsyncStorage persistence
- [x] Add "Auto-extract time" toggle (reads EXIF DateTimeOriginal)
- [x] Add "Capture location" toggle (device GPS for camera)
- [x] Extract GPS from EXIF for library photos
- [x] Reverse geocoding via native + optional Google Places
- [x] Place name resolution as bill name

### 8.5 Account Management

- [x] Add "Sign Out" button with confirmation dialog
- [x] Handle WorkOS sign out and clear local state

---

## Phase 9 — Subscription Model

### 9.1 RevenueCat Setup

- [x] Create RevenueCat account and project
- [x] Install `react-native-purchases` + `react-native-purchases-ui` SDK
- [x] Configure RevenueCat with App Store product IDs (`rondas_pro_monthly`, `rondas_pro_yearly`)
- [x] Create monthly Pro product with regionalized pricing in App Store Connect
- [x] Create yearly Pro product with regionalized pricing (~25% off)
- [x] Configure offerings in RevenueCat dashboard (default offering with monthly + annual packages)
- [x] Configure In-App Purchase P8 key in RevenueCat
- [x] Configure App Store Connect API key in RevenueCat
- [x] Complete Paid Apps Agreement (W-8BEN, bank account, tax forms)
- [x] Sign in with Apple configured (WorkOS + Apple Developer)

### 9.2 Paywall Screen

- [x] Create paywall screen with Pro feature highlights (`app/paywall.tsx`)
- [x] Display monthly and yearly pricing options (localized via RevenueCat Offering)
- [x] Handle purchase flow via RevenueCat (sandbox yearly purchase verified)
- [x] Handle restore purchases
- [x] Show success state after purchase (dismiss paywall, Pro active)
- [x] Custom paywall with remote paywall fallback (hybrid approach)
- [x] Customer Center integration via `react-native-purchases-ui`

### 9.3 Feature Gating (Usage-based with Reverse Trial)

- [x] Create `useSubscriptionStore` Zustand store for subscription status
- [x] Create `useProGate` hook (`isPro`, `inTrial`, `showPaywall`)
- [x] Create `useSubscriptionSync` hook (syncs Convex proOverride + RevenueCat status)
- [x] Sync subscription status from RevenueCat on app launch (`lib/revenueCat.ts`)
- [x] Gate AI scan behind Pro/trial check (FAB + `convex/ai.ts` server-side)
- [x] Gate bills beyond 3/month behind Pro check (FAB + `convex/bills.ts` server-side)
- [x] Gate payment tracking behind Pro/trial check (`PeopleSummary.tsx`)
- [x] Gate bill history >90 days with lock icon (`BillCard.tsx` + `index.tsx`)
- [x] Show paywall when user hits a gated feature
- [x] Add manual entry option in FAB (always available, bypasses scan gate)
- [x] Reverse trial: first 2 bills have all features unlocked
- [x] `totalBillsCreated` counter in Convex users table (lifetime, never resets)

### 9.4 Promo Codes

- [x] Create Convex `promoCodes` table (code, type, expiresAt, maxUses, uses)
- [x] Create `redeemCode` mutation (validate, increment uses, set proOverride)
- [x] Create `createCode` mutation (admin use)
- [x] Add `proOverride` + `proOverrideAt` fields to users table
- [x] Add `getProStatus` query to users
- [x] Add promo code input in settings screen
- [x] Add promo code input in paywall screen
- [x] Add `presentCodeRedemptionSheet()` for iOS store offer codes
- [x] Create "GiftedByDemar" lifetime code in Convex
- [ ] Configure launch Offer Codes in App Store Connect ($4.900 COP × 2 months)
- [ ] Configure Promo Codes in Google Play Console
- [ ] Test promo code redemption E2E (with non-subscribed account)

### 9.5 Settings & UI

- [x] Pro upsell card → links to paywall when free
- [x] Pro active card → shows "Rondas Pro" + links to Customer Center when Pro
- [x] Update Pro pricing in translations to $9.900 COP / $4.99 USD
- [x] ~50 new translation strings (EN + ES) for paywall, gates, promo codes
- [x] Regionalized pricing docs (`docs/research/pricing.schema.md`)
- [x] Updated subscription rules docs (`docs/rules/subscriptions.md`)
- [x] Add Pro badge overlay on avatar in settings (crown icon, gold circle)

---

## Phase 10 — Polish & Launch Prep

### 10.1 Error Handling

- [x] Add global error boundary
- [x] Add empty states for all list screens
- [x] Add error states for failed API calls with retry buttons
- [x] Add offline detection banner
- [x] Add retry logic to email/WhatsApp notifications
- [x] Add 60s timeout to Gemini API calls

### 10.2 Loading States

- [x] Add skeleton loaders for bill list (Skeleton.tsx + BillCardSkeleton with staggered fade-in)
- [x] Add loading/scanning overlay for AI extraction (ScanningOverlay with streaming items)
- [x] Add loading indicator + infographic preview modal for share actions

### 10.3 Animations

- [x] Add FAB press animation (spring scale on press)
- [x] Add bill card entrance animation (FadeInDown staggered)
- [x] Add swipe-to-delete with haptics (3-zone: idle/reveal/commit)
- [x] Add state badge transition animation (scale bounce in AnimatedBadge)

### 10.4 App Store Preparation

- [x] Configure app icon (R-receipt logo, 1024×1024)
- [x] Configure splash screen (transparent foreground on navy background)
- [x] Configure Android adaptive icon (foreground/background/monochrome via rembg)
- [x] Configure `app.json` with bundle ID, version, permissions descriptions
- [x] Submit for TestFlight internal testing (build #26)
- [x] Fix bugs from TestFlight testing (Error 23, Convex deploy, keyboard inputs)
- [ ] Write App Store description (English + Spanish)
- [ ] Prepare screenshots for App Store (6.7" and 6.1" screens)
- [x] Privacy Policy URL — rondas.app/privacy (ES) + rondas.app/en/privacy (EN)
- [x] Terms of Service URL — rondas.app/terms (ES) + rondas.app/en/terms (EN)
- [ ] Submit for App Store review
- [ ] Submit for Google Play review

---

## Codebase Review Refactoring (Session 4)

### Component Decomposition

- [x] Decompose `[id].tsx` from 1757→875 lines (8 extracted components)
- [x] Extract BillCard, FilterChip from home screen to `components/bills/`
- [x] Extract SwipeableItem, KeyboardDoneButton from new bill screen
- [x] Extract TipSelector shared component (dedup setup + settings)
- [x] Extract relativeTime, parseExifDate to `lib/date.ts`
- [x] Extract STATE_STYLES, getTaxLabel, getCategoryLabel to `lib/billHelpers.ts`
- [x] Create Avatar component with CVA size variants
- [x] Add bill-state CVA variants to Badge component
- [x] Convert FilterChip to CVA-based active/inactive variants
- [x] Create USStatePicker modal (replaced Alert.alert)
- [x] Create ErrorBoundary component
- [x] Create OfflineBanner component
- [x] Extract auth redirect logic to `hooks/useAuthRedirect.ts`
- [x] Consolidate 5 dialog booleans into single `activeDialog` state

### Styling Cleanup

- [x] Convert ~130 inline `style` instances to `cn()` + Tailwind classes
- [x] Replace all hardcoded hex/rgba colors with CSS token classes
- [x] Eliminate all `colorScheme === 'dark'` ternary patterns
- [x] Extend ICON_COLORS with primaryForeground, foreground, destructive, pro
- [x] Add `--color-state-draft` tokens to global.css
- [x] STATE_STYLES now provides Tailwind class strings (borderClass, bgClass, etc.)
- [x] Use `cn()` consistently for all conditional classNames
- [x] Replace inline fontSize/fontWeight with Tailwind text/font classes
- [x] Add React.memo to BillCard, FilterChip, SettingsRow, TipSelector

### Code Quality

- [x] Rename single-letter variables (ci→contactIdx, n→contactName, i→billItem)
- [x] Replace nested ternaries with switch-based `getScanStatusLabel()` helper
- [x] Split 56-line `pickImage` into `pickFromCamera`/`pickFromLibrary`
- [x] Add `useMemo` for derived bill computations in `[id].tsx`
- [x] Remove deprecated `constants/theme.ts` and unused `use-theme-color` hook
- [x] Unify IconSymbol style prop type to `StyleProp<ViewStyle>`
- [x] Add image compression constants (`IMAGE_MAX_WIDTH`, `IMAGE_QUALITY`)
- [x] Add Gemini model env var fallback
- [x] Internationalize tab titles (Home/Settings)
- [x] Document all env vars in `.env.example`
- [x] Move redirect URI to `constants/env.ts`
- [x] Update all rules docs (project-structure, styling, backend, state-data)

---

## Codebase Review #2 Fixes (Session 5)

### Security & Type Safety

- [x] Add userId auth to scan operations (getScan, updateScan, deleteScan)
- [x] Remove/gate sensitive console.logs with `__DEV__` in AuthContext
- [x] Replace all `as any` casts with proper `Id<>` types
- [x] Replace non-null assertions with null guards and optional chaining
- [x] Type the `contact` prop in BillShareSheet interface

### React.memo & Performance

- [x] Add React.memo to BillShareSheet, ContactPickerSheet, UnassignPickerSheet, TipDialog, CountryDialog

### Code Quality

- [x] Replace remaining hardcoded hex colors with theme tokens (KeyboardDoneButton, BillCard, ContactPickerSheet, UnassignPickerSheet, index.tsx)
- [x] Fix remaining i18n gaps (Delete, item/items count, pro pricing, OAuth provider constants)
- [x] Convert settings.tsx inline handlers to useCallback
- [x] Validate notification env vars (RESEND_API_KEY, WHATSAPP_API_TOKEN)
- [x] Fix setup.tsx side effect (useState → useEffect)

### Extraction & Cleanup

- [x] Extract ScanningOverlay from new.tsx
- [x] Extract WhatsApp message builder to `lib/whatsapp.ts`
- [x] Remove uploads.ts placeholder stub
- [x] Standardize settings components to export default React.memo
- [x] Second inline style audit: convert BillInfographic (~40 instances), BillCard margins, sheet paddingTop, Image positioning

### Bug Fixes

- [x] Fix Android Google OAuth stuck-on-loading (handle 'dismiss' result, clear loading on deep link errors, add safety timeout)
- [x] Fix env var name mismatch (`EXPO_PUBLIC_REDIRECT_URI` → `EXPO_PUBLIC_WORKOS_REDIRECT_URI`)
- [x] Fix deep link handler path mismatch (`Linking.parse` hostname vs path for custom schemes)
- [x] Fix redirect URI to `rondas://auth/callback` (correct URL parsing for Expo Linking)
- [x] Add logout redirect URI (`rondas://auth/logout`) with `return_to` param
- [x] Switch sign-out from `openBrowserAsync` to `openAuthSessionAsync` (auto-close)
- [x] Add `app/auth/callback.tsx` route for OAuth callback deep link (prevents Unmatched Route)
- [x] Add `app/auth/logout.tsx` route for logout redirect deep link
- [x] Update `useAuthRedirect` to recognize `auth` segment (callback/logout routes)
- [x] Set `headerShown: false` globally on root Stack
- [x] Configure EAS Build for Android development builds
- [x] Fix tip computation: compute on base (excluding tax) for tax-inclusive countries
- [x] Show base as "Subtotal", add "Before tip" row in bill detail and infographic
- [x] Localize Pro pricing for Colombia ($15.000/mes)
- [x] Fix hardcoded "ago" in BillCard (pass translations to relativeTime)

---

## Session 7 — Bill Detail UI/UX Redesign & Performance (2026-03-30 to 2026-03-31)

### Lint & Rule Compliance
- [x] Fix all 15 lint warnings (unused imports, missing hook deps)
- [x] Replace hardcoded hex colors with ICON_COLORS tokens (20+ fixes)
- [x] Add `success` and `accent` tokens to ICON_COLORS
- [x] FlatList → FlashList in USStatePicker
- [x] Add React.memo to 4 reusable components
- [x] Wrap expo-image with styled() for NativeWind className support (`lib/expo-image.ts`)

### Bill Detail — Component Extraction
- [x] Extract BillHeader (inline title, overflow menu, progress bar)
- [x] Extract BillMetadata (condensed card with IconSymbol icons)
- [x] Extract SortBar (FilterChip-based, 3 toggle chips + bulk edit)
- [x] Extract BillItemCard (card treatment, left accent border, edit form)
- [x] Extract BillSummaryCard (grouped card, highlighted total)
- [x] Extract PeopleSummary (horizontal scroll of per-person totals)
- [x] Reduce [id].tsx from 884 → ~660 lines

### Bill Detail — UI Polish
- [x] Progress bar in header (paid/unpaid/unassigned segments)
- [x] Staggered FadeInDown entrance animations
- [x] Filled primary share button (was outline)
- [x] Full-width contact chips (moved below name/price row)
- [x] Contact chip tap-to-remove restored (was broken by onLongPress change)
- [x] Pencil icon edit cue on item names
- [x] Inline title with back button (single row header)
- [x] Completion percentage with state-colored text
- [x] Unassigned item "Tap + to assign" hint
- [x] "+" button beside price (was below)
- [x] Spacing rhythm tuned across all sections

### Bill Detail — New Features
- [x] Frequent + recent contacts in contact picker (Convex query)
- [x] Per-person breakdown section (PeopleSummary with paid toggle)
- [x] Address deduplication at source (lib/places.ts)
- [x] One-time migration for existing bill addresses (convex/migrations.ts)

### Performance Fixes
- [x] Fix input lag: useBufferedInput hook for inline edits (bill name, tax)
- [x] Fix input lag: TanStack Form for item edit card (submit on "Done")
- [x] Live currency formatting with react-native-currency-input
- [x] Contact picker: FlashList virtualization (was ScrollView with 500+ nodes)
- [x] Contact picker: two-phase loading (fast fetch → background image fetch)
- [x] Contact picker: 5-minute contact cache in useRef
- [x] Contact picker: fire-and-forget loading (no await blocking modal)
- [x] Contact picker: local search state (stops parent re-renders)
- [x] Contact picker: memoized callbacks for React.memo effectiveness
- [x] Haptic feedback on contact removal

---

## Session 8 — Error States, Custom Tip, Filter Rework (2026-04-01)

### Error Handling
- [x] Classified scan errors (timeout/api/generic) with actionable hints
- [x] High-contrast BlurView error toast over camera backgrounds
- [x] Manual-entry escape hatch after 2 failed scan attempts
- [x] Fullscreen bill-not-found state with muted icon backdrop
- [x] try/catch on all mutation handlers with Alert.alert feedback
- [x] WhatsApp canOpenURL check before deep link
- [x] 12 new i18n error strings (EN + ES)
- [x] 2 new icon mappings (wifi.slash, exclamationmark.triangle)

### Custom Tip
- [x] Per-bill custom tip toggle (useCustomTip field on bills schema)
- [x] Toggle + CurrencyInput inside TipDialog modal
- [x] Tip row shows "Tip (custom)" with chevron when custom active
- [x] Selecting a tip % auto-disables custom tip

### Filter Bar Rework
- [x] Filter button renders first, opens FilterSheet for all changes
- [x] Trash icon clears to defaults (visible only when non-default)
- [x] Applied non-default filters show as dismissible chips with X icon
- [x] Each chip taps to open FilterSheet
- [x] "International" country filter (shows all countries)
- [x] FilterChip gains optional onDismiss prop
- [x] 8 new i18n strings for filter chip labels (EN + ES)

---

## Session 12 — Share Screen Audit & Polish (2026-05-29)

### Share Screen — Code Quality
- [x] Fix stale contactIndex bug (ungrouped contacts shared wrong infographic)
- [x] Replace deprecated accessibilityRole with role prop (RN 0.85)
- [x] Replace deprecated nativewind useColorScheme with react-native
- [x] Replace callback-based Image.getSize with promise-based API
- [x] Extract computeContactItemShare into shared utils (dedup share math)
- [x] Extract buildHeader helper in whatsapp.ts (remove triple duplication)
- [x] Thread bill.decimalPlaces through entire share tree
- [x] Fix inconsistent contactKey usage in ContactGroupSection
- [x] Fix unreadable GroupConfirmToolbar button styling
- [x] Localize hardcoded accessibility labels (en/es)
- [x] Replace hardcoded #10b981 with iconColors.success
- [x] Fix phone.ts false-positive country code detection
- [x] Simplify stateLabel to reuse STATE_LABEL_KEYS
- [x] Move GROUP_TINTS_BG from types.ts to utils.ts
- [x] Tighten contactKey param type from unknown to Id<'contacts'> | string
- [x] Remove trivial dismiss wrapper in InfographicPreview
- [x] Reuse Avatar component in ContactRow (replaced inline avatar)

### Share Screen — UI
- [x] Liquid glass header with MaskedView gradient fade
- [x] Skeleton placeholders during 500ms glass delay
- [x] Fix ContactRow layout (total inside flex-1 for full-width item grid)
- [x] Truncate contact names with numberOfLines={1}
- [x] Consistent px-7 padding between header and scroll content

### Bill Logic
- [x] Bill state 'split' when all contacts paid (regardless of item coverage)
- [x] Deploy simplified computeBillState to Convex production

### UI Polish
- [x] Tip dialog 3x2 grid layout (was 5+1)
- [x] Localize "Tap to edit" in PeopleSummary (was hardcoded English)
- [x] Shorten "Impoconsumo" to "ICO" in tax labels
- [x] Full tax names in Spanish descriptive text
- [x] Move dev log button to bottom-right corner

### Android
- [x] Configure APK build profile with preview channel
- [x] Trigger APK build for shareable Android testing

---

## Phase 11 — Post-Launch Roadmap *(future)*

### 11.1 Analytics — PostHog
- [ ] Install PostHog React Native SDK
- [ ] Configure PostHog provider in app root
- [ ] Track key funnel events: signup, first_bill, reverse_trial_complete, paywall_shown, subscription_started
- [ ] Track retention events: app_open, bill_created, share_sent
- [ ] Set up conversion dashboard (free → Pro funnel)
- [ ] Enable session replay for debugging

### 11.2 Onboarding Flow
- [ ] Design step-by-step guided onboarding for first bill
- [ ] Step 1: Take/select photo of bill
- [ ] Step 2: Review AI-extracted items
- [ ] Step 3: Assign contacts to items
- [ ] Step 4: Share breakdown via WhatsApp
- [ ] Add skip button on each step
- [ ] Persist onboarding completion in user profile
- [ ] Only show for new users (totalBillsCreated === 0)

### 11.3 Auth Migration Evaluation
- [ ] Evaluate Better Auth as WorkOS replacement when WorkOS costs become significant
- [ ] Document migration path: session handling, OAuth providers, token refresh
- [ ] Decision criteria: WorkOS monthly cost > $50 AND >1,000 active users

### 11.4 Deferred Infrastructure
- [ ] UploadThing: persist bill photos for history/re-scan
- [ ] Resend: email summaries per contact
- [ ] WhatsApp Cloud API: push notifications (replace deep links)

---

## Progress Summary

> Last updated: 2026-05-30 (Session 12 — Share screen audit, bill state fix, UI polish)

| Phase                             | Total Tasks | Done  |
| --------------------------------- | ----------- | ----- |
| Phase 1 — Setup                   | 38          | 35    |
| Phase 2 — Auth Screens            | 23          | 23    |
| Phase 3 — Home Screen             | 19          | 19    |
| Phase 4 — Bill Creation & AI      | 34          | 33    |
| Phase 5 — Bill Splitting          | 21          | 21    |
| Phase 6 — Summary & Notifications | 12          | 10    |
| Phase 7 — Bill Detail & History   | 32          | 31    |
| Phase 8 — Settings                | 24          | 24    |
| Phase 9 — Subscriptions           | 46          | 40    |
| Phase 10 — Polish & Launch        | 19          | 16    |
| Codebase Review #1 Refactoring    | 48          | 48    |
| Codebase Review #2 Fixes          | 20          | 20    |
| Session 7 — Bill Detail Redesign  | 30          | 30    |
| Session 8 — Errors, Tip, Filters  | 19          | 19    |
| Session 12 — Share Screen Audit   | 27          | 27    |
| Phase 11 — Post-Launch Roadmap    | 17          | 0     |
| **Total**                         | **429**     | **396**|
