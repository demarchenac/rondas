# Rondas — Progress Tracker

> Last updated: 2026-03-25

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

### 1.3 UI Components Setup

- [x] Install React Native Reusables
- [x] Configure base theme tokens (colors, radius, spacing)
- [x] Test a sample Reusables component renders correctly

### 1.4 State & Data Layer

- [x] Install and configure Zustand
- [x] Install and configure TanStack Query with QueryClientProvider
- [x] Install TanStack Form and Zod

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

> Note: Image is sent as base64 directly to Gemini via Convex action. UploadThing deferred to later.

### 4.2 AI/OCR Item Extraction

- [x] Create Convex action that calls Gemini 2.0 Flash with bill image
- [x] Write prompt to extract: item name, quantity, unit price, subtotal
- [x] Parse Gemini's JSON response into structured line items
- [x] Handle extraction errors with a manual entry fallback
- [x] Show loading indicator while extraction runs

> Note: Using Gemini 2.0 Flash instead of Claude Vision (better cost/quality ratio).

### 4.3 Item Review Screen

- [x] Display extracted items in an editable list
- [x] Allow user to edit item name
- [x] Allow user to edit item price
- [x] Allow user to delete an item
- [x] Allow user to add a new item manually
- [x] Display subtotal, tax, and total
- [x] Allow user to edit total manually
- [x] Add "Confirm Items" button to proceed

---

## Phase 5 — Bill Splitting

### 5.1 Split Strategy Selection

- [ ] Create split strategy screen
- [ ] Build "Split Equally" option card
- [ ] Build "Split by Items" option card
- [ ] Navigate to appropriate split screen based on selection

### 5.2 Equal Split

- [ ] Create equal split screen
- [ ] Build number-of-people stepper input
- [ ] Display calculated per-person amount in real time
- [ ] Add ability to assign contacts to each portion
- [ ] Show per-person breakdown list
- [ ] Add "Confirm Split" button

### 5.3 Item-Based Split

- [ ] Create item split screen listing all bill items
- [ ] Add "Assign Contact" button per item
- [ ] Open native contact picker on press
- [ ] Request contacts permission
- [ ] Display assigned contact name and avatar next to item
- [ ] Allow reassigning or removing a contact from an item
- [ ] Allow assigning multiple contacts to a single item
- [ ] Highlight unassigned items as a warning
- [ ] Calculate and display each contact's subtotal in real time
- [ ] Add "Confirm Split" button

### 5.4 Summary Generation

- [ ] Create Convex mutation to save confirmed split to database
- [ ] Generate per-contact summary (items + subtotal + tax/tip share)
- [ ] Generate full group summary
- [ ] Update bill state to "Split" or "Unresolved Payments"
- [ ] Navigate to summary screen after confirmation

---

## Phase 6 — Summary & Notifications

### 6.1 Summary Screen

- [ ] Create `/app/bills/[id]/summary.tsx` screen
- [ ] Display full bill summary with all contacts and totals
- [ ] Display individual contact cards with item breakdown
- [ ] Show payment status badge per contact (Paid / Unpaid)
- [ ] Add "Mark as Paid" toggle per contact
- [ ] Add "Send Summary" button per contact

### 6.2 Payment Tracking

- [ ] Create Convex mutation to toggle contact payment status
- [ ] Update bill state to "Split" when all contacts are marked paid
- [ ] Persist payment state in `bills` table

### 6.3 WhatsApp Notifications

- [ ] Create Convex action to send per-contact WhatsApp message
- [ ] Format WhatsApp message template with item list and total
- [ ] Handle send success and error states
- [ ] Show confirmation toast on successful send

### 6.4 Email Notifications

- [ ] Create React Email template for per-contact bill summary
- [ ] Create React Email template for full group summary
- [ ] Create Convex action to send email via Resend
- [ ] Handle send success and error states
- [ ] Show confirmation toast on successful send

---

## Phase 7 — Bill Detail & History

### 7.1 Bill Detail Screen

- [ ] Create `/app/bills/[id]/index.tsx` screen
- [ ] Display bill image thumbnail
- [ ] Display all items
- [ ] Display split strategy used
- [ ] Display per-contact breakdown
- [ ] Display payment status per contact
- [ ] Add navigation back to home

### 7.2 Bill List Interactions

- [ ] Tapping a bill card navigates to bill detail screen
- [ ] Swipe-to-delete on bill card with confirmation dialog
- [ ] Pull-to-refresh on bills list

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

### 8.3 Language Toggle

- [ ] Install and configure `i18next` + `expo-localization`
- [ ] Create English translation file (`en.json`)
- [ ] Create Spanish translation file (`es.json`)
- [ ] Translate all UI strings to both languages
- [x] Build language selector in settings (English / Spanish)
- [ ] Persist language preference to AsyncStorage
- [ ] Apply selected language across the entire app

### 8.4 Account Management

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

- [ ] Add global error boundary
- [ ] Add empty states for all list screens
- [ ] Add error states for failed API calls with retry buttons
- [ ] Add offline detection banner

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

## Progress Summary

| Phase                             | Total Tasks | Done  |
| --------------------------------- | ----------- | ----- |
| Phase 1 — Setup                   | 24          | 21    |
| Phase 2 — Auth Screens            | 11          | 11    |
| Phase 3 — Home Screen             | 18          | 16    |
| Phase 4 — Bill Creation & AI      | 13          | 12    |
| Phase 5 — Bill Splitting          | 22          | 0     |
| Phase 6 — Summary & Notifications | 16          | 0     |
| Phase 7 — Bill Detail & History   | 9           | 0     |
| Phase 8 — Settings                | 14          | 9     |
| Phase 9 — Subscriptions           | 12          | 0     |
| Phase 10 — Polish & Launch        | 14          | 0     |
| **Total**                         | **153**     | **69**|
