# Rondas — Implementation Plan

> Version 1.0 | 2025

---

## Overview

This document describes the full implementation of Rondas broken down into phases and atomic tasks. Each task is designed to be independently completable and testable.

---

## Phase 1 — Project Setup & Infrastructure

### 1.1 Expo Project Bootstrap

- [ ] Initialize Expo project with `create-expo-app` using TypeScript template
- [ ] Configure Expo Router file-based navigation
- [ ] Set up folder structure (`app/`, `components/`, `lib/`, `stores/`, `constants/`)
- [ ] Configure path aliases in `tsconfig.json`
- [ ] Set up `.env` file and `expo-constants` for environment variables

### 1.2 Styling Setup

- [ ] Install and configure NativeWind
- [ ] Configure `tailwind.config.js` with custom color tokens (brand palette)
- [ ] Verify NativeWind works with a test component

### 1.3 UI Components Setup

- [ ] Install React Native Reusables
- [ ] Configure base theme tokens (colors, radius, spacing)
- [ ] Test a sample Reusables component renders correctly

### 1.4 State & Data Layer

- [ ] Install and configure Zustand
- [ ] Install and configure TanStack Query with a QueryClientProvider
- [ ] Install TanStack Form and Zod

### 1.5 Backend — Convex

- [ ] Create Convex project
- [ ] Install Convex client in Expo app
- [ ] Configure ConvexProvider in app root
- [ ] Verify Convex connection with a test query

### 1.6 Authentication — WorkOS

- [ ] Create WorkOS project and configure AuthKit
- [ ] Install WorkOS AuthKit React Native SDK
- [ ] Configure Email OTP provider
- [ ] Configure Sign in with Apple provider
- [ ] Configure Sign in with Google provider
- [ ] Create Convex `users` table and sync WorkOS user on login

### 1.7 File Uploads — UploadThing

- [ ] Create UploadThing project
- [ ] Install UploadThing client in Expo app
- [ ] Configure upload route for bill images

### 1.8 Email — Resend + React Email

- [ ] Create Resend account and obtain API key
- [ ] Set up React Email project in a `/emails` directory
- [ ] Configure Resend client in Convex backend

### 1.9 WhatsApp — Meta Cloud API

- [ ] Create Meta developer account and app
- [ ] Enable WhatsApp product on Meta app
- [ ] Add test phone numbers to sandbox
- [ ] Store WhatsApp API credentials in environment variables
- [ ] Create a Convex action to send a WhatsApp message

---

## Phase 2 — Authentication Screens

### 2.1 Onboarding / Auth Flow

- [ ] Create `/app/(auth)/login.tsx` screen
- [ ] Build Email OTP input form using TanStack Form + Zod
- [ ] Build OTP verification input form
- [ ] Add "Sign in with Apple" button
- [ ] Add "Sign in with Google" button
- [ ] Handle auth state and redirect to home on success
- [ ] Create `/app/(auth)/_layout.tsx` to protect auth routes

### 2.2 Auth Guard

- [ ] Create root layout that checks auth state
- [ ] Redirect unauthenticated users to login screen
- [ ] Redirect authenticated users to home screen
- [ ] Handle loading state while checking auth

---

## Phase 3 — Home Screen

### 3.1 Layout & Navigation

- [ ] Create bottom tab navigator with: Home, Settings
- [ ] Create `/app/(tabs)/index.tsx` as the home screen
- [ ] Create `/app/(tabs)/_layout.tsx` for tab configuration

### 3.2 Bill List

- [ ] Create Convex `bills` table schema
- [ ] Create Convex query to fetch all bills for the current user
- [ ] Build `BillCard` component displaying: name, date, total, state badge
- [ ] Render bills list using `FlashList` for performance
- [ ] Add empty state UI when no bills exist

### 3.3 Bill State Badge

- [ ] Create `StateBadge` component with three variants: Unsplit, Split, Unresolved
- [ ] Apply correct color per state (e.g. gray, green, amber)

### 3.4 Filters

- [ ] Build filter bar component above bill list
- [ ] Add filter by bill state (multi-select toggle)
- [ ] Add filter by contact (contact picker dropdown)
- [ ] Add filter by amount range (dual-handle slider)
- [ ] Wire filters to Convex query or client-side filter logic
- [ ] Add "Clear filters" button

### 3.5 Floating Action Button (FAB)

- [ ] Create `FAB` component with a "+" icon
- [ ] On press, show action sheet: "Take Photo" or "Choose from Library"
- [ ] Handle camera permission request
- [ ] Handle photo library permission request
- [ ] On photo selected/captured, navigate to new bill screen with image URI

---

## Phase 4 — Bill Creation & AI Scanning

### 4.1 Image Handling

- [ ] Create `/app/bills/new.tsx` screen
- [ ] Display captured/selected image in screen
- [ ] Upload image to UploadThing and store URL

### 4.2 AI/OCR Item Extraction

- [ ] Create Convex action that calls Claude Vision API with the bill image
- [ ] Write prompt to extract: item name, quantity, unit price, subtotal
- [ ] Parse Claude's JSON response into structured line items
- [ ] Handle extraction errors gracefully with a fallback manual entry state
- [ ] Show loading indicator while extraction runs

### 4.3 Item Review Screen

- [ ] Display extracted items in an editable list
- [ ] Allow user to edit item name
- [ ] Allow user to edit item price
- [ ] Allow user to delete an item
- [ ] Allow user to add a new item manually
- [ ] Display extracted subtotal, tax, and total
- [ ] Allow user to edit total manually
- [ ] Add "Confirm Items" button to proceed to split selection

---

## Phase 5 — Bill Splitting

### 5.1 Split Strategy Selection

- [ ] Create split strategy screen
- [ ] Build "Split Equally" option card
- [ ] Build "Split by Items" option card
- [ ] Navigate to appropriate split screen based on selection

### 5.2 Equal Split

- [ ] Create equal split screen
- [ ] Build number-of-people input (stepper or numeric input)
- [ ] Display calculated per-person amount in real time
- [ ] Add ability to add contacts to each split portion
- [ ] Show per-person breakdown list
- [ ] Add "Confirm Split" button

### 5.3 Item-Based Split

- [ ] Create item split screen listing all bill items
- [ ] For each item, show an "Assign Contact" button
- [ ] Open native contact picker on "Assign Contact" press
- [ ] Request contacts permission
- [ ] Display assigned contact name and avatar next to item
- [ ] Allow reassigning or removing a contact from an item
- [ ] Allow assigning multiple contacts to a single item (shared item)
- [ ] Show unassigned items highlighted as a warning
- [ ] Calculate and display each contact's subtotal in real time
- [ ] Add "Confirm Split" button

### 5.4 Summary Generation

- [ ] Create Convex mutation to save confirmed split to database
- [ ] Generate per-contact summary: list of items + subtotal + their share of tax/tip
- [ ] Generate full group summary
- [ ] Update bill state to "Split" or "Unresolved Payments"
- [ ] Navigate to summary screen after confirmation

---

## Phase 6 — Summary & Notifications

### 6.1 Summary Screen

- [ ] Create `/app/bills/[id]/summary.tsx` screen
- [ ] Display full bill summary with all contacts and their totals
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

### 7.2 Bill List on Home

- [ ] Tapping a bill card navigates to bill detail screen
- [ ] Swipe-to-delete on bill card with confirmation dialog
- [ ] Pull-to-refresh on bills list

---

## Phase 8 — Settings

### 8.1 Settings Screen

- [ ] Create `/app/(tabs)/settings.tsx` screen
- [ ] Display user avatar, name, and email

### 8.2 Theme Toggle

- [ ] Create Zustand store for theme preference
- [ ] Build theme toggle (Light / Dark / System)
- [ ] Apply theme to NativeWind using `colorScheme`
- [ ] Persist theme preference to AsyncStorage

### 8.3 Language Toggle

- [ ] Install and configure `i18n-js` or `expo-localization` + `i18next`
- [ ] Create English translation file (`en.json`)
- [ ] Create Spanish translation file (`es.json`)
- [ ] Translate all UI strings to both languages
- [ ] Build language selector (English / Spanish) in settings
- [ ] Persist language preference to AsyncStorage
- [ ] Apply selected language across the entire app

### 8.4 Account Management

- [ ] Add "Sign Out" button with confirmation dialog
- [ ] Handle WorkOS sign out and clear local state

---

## Phase 9 — Subscription Model

### 9.1 RevenueCat Setup

- [ ] Create RevenueCat account
- [ ] Install `react-native-purchases` (RevenueCat SDK)
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
