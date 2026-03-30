# Rondas — Progress Tracker

> Last updated: 2026-03-29 (session 4 — codebase review)

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

### 1.7 File Uploads — UploadThing

- [ ] Create UploadThing project
- [x] Install UploadThing client in Expo app
- [ ] Configure upload route for bill images

### 1.8 Email — Resend + React Email

- [ ] Create Resend account and obtain API key
- [x] Set up React Email project in `/emails` directory
- [x] Configure Resend client in Convex backend

### 1.9 WhatsApp — Meta Cloud API

- [ ] Create Meta developer account and app
- [ ] Enable WhatsApp product on Meta app
- [ ] Add test phone numbers to sandbox
- [ ] Store WhatsApp API credentials in environment variables
- [x] Create a Convex action to send a WhatsApp message

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
- [ ] Add filter by contact (contact picker dropdown)
- [ ] Add filter by amount range (dual-handle slider)
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
- [ ] Create split strategy screen (Equal Split)
- [ ] Build number-of-people stepper for equal split

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
- [ ] Create React Email template for per-contact bill summary
- [ ] Create Convex action to send email via Resend

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
- [ ] Pull-to-refresh on bills list

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

- [ ] Create RevenueCat account
- [ ] Install `react-native-purchases` SDK
- [ ] Configure RevenueCat with App Store product IDs
- [ ] Create monthly Pro product in App Store Connect ($1.99/month)
- [ ] Create yearly Pro product in App Store Connect ($14.99/year)
- [ ] Configure offerings in RevenueCat dashboard

### 9.2 Paywall Screen

- [ ] Create paywall screen with Pro feature highlights
- [ ] Display monthly and yearly pricing options
- [ ] Handle purchase flow via RevenueCat
- [ ] Handle restore purchases
- [ ] Show success state after purchase

### 9.3 Feature Gating

- [ ] Create Zustand store for subscription status
- [ ] Sync subscription status from RevenueCat on app launch
- [ ] Gate item-based split behind Pro check
- [ ] Gate bills beyond 5/month behind Pro check
- [ ] Gate contacts beyond 3 per bill behind Pro check
- [ ] Gate dark theme behind Pro check
- [ ] Show paywall when user hits a gated feature

---

## Phase 10 — Polish & Launch Prep

### 10.1 Error Handling

- [x] Add global error boundary
- [x] Add empty states for all list screens
- [ ] Add error states for failed API calls with retry buttons
- [x] Add offline detection banner
- [x] Add retry logic to email/WhatsApp notifications
- [x] Add 60s timeout to Gemini API calls

### 10.2 Loading States

- [ ] Add skeleton loaders for bill list
- [ ] Add loading spinner for AI extraction
- [ ] Add loading indicators for send actions

### 10.3 Animations

- [ ] Add FAB press animation
- [ ] Add bill card entrance animation
- [ ] Add state badge transition animation

### 10.4 App Store Preparation

- [ ] Configure app icon (all required sizes)
- [ ] Configure splash screen
- [ ] Write App Store description (English + Spanish)
- [ ] Prepare screenshots for App Store (6.7" and 6.1" screens)
- [ ] Configure `app.json` with bundle ID, version, permissions descriptions
- [ ] Submit for TestFlight internal testing
- [ ] Fix bugs from TestFlight testing
- [ ] Submit for App Store review

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

## Progress Summary

| Phase                             | Total Tasks | Done  |
| --------------------------------- | ----------- | ----- |
| Phase 1 — Setup                   | 38          | 35    |
| Phase 2 — Auth Screens            | 11          | 11    |
| Phase 3 — Home Screen             | 19          | 17    |
| Phase 4 — Bill Creation & AI      | 34          | 33    |
| Phase 5 — Bill Splitting          | 21          | 19    |
| Phase 6 — Summary & Notifications | 10          | 8     |
| Phase 7 — Bill Detail & History   | 32          | 30    |
| Phase 8 — Settings                | 24          | 23    |
| Phase 9 — Subscriptions           | 12          | 0     |
| Phase 10 — Polish & Launch        | 16          | 5     |
| Codebase Review Refactoring       | 48          | 48    |
| **Total**                         | **265**     | **229**|
