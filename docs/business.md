# Rondas — Business Overview Document

> Version 1.0 | 2025

---

## 1. Executive Summary

Rondas is a mobile-first iOS application designed to eliminate the friction of splitting shared bills at restaurants and group settings. By combining AI-powered receipt scanning with intelligent bill splitting, contact-based item assignment, and automated payment notifications via WhatsApp and email, Rondas enables groups to resolve shared expenses quickly, fairly, and transparently.

The app is built for the Colombian market and beyond, targeting frequent social diners who regularly share tabs and struggle with manual calculations, awkward follow-ups, and lack of payment visibility.

---

## 2. Problem Statement

Splitting a shared bill at a restaurant is a universally frustrating experience. Common pain points include:

- Manual math errors when dividing totals among a group
- No easy way to track who ordered what when splitting by item
- No built-in mechanism to notify group members of what they owe
- No accountability layer to track who has and has not paid
- Existing apps are either too simple (equal split only) or too complex and slow

Rondas solves all of these with an intuitive, photo-first workflow that takes a bill from receipt to fully resolved in under two minutes.

---

## 3. Product Overview

### 3.1 Core Workflow

1. User photographs the bill using the in-app camera or selects from the photo library
2. AI-powered OCR extracts itemized line items, quantities, prices, and totals
3. User selects a split strategy: equal split by total or split by individual items
4. For item-based splits, contacts from the user's phone are assigned to specific items
5. A full summary is generated showing each person's share
6. Summaries are sent via WhatsApp and/or email — either a full group summary or a per-contact breakdown
7. Payments are tracked and marked as paid or unpaid per contact

### 3.2 Bill States

Every bill in Rondas exists in one of three states:

| State                   | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| **Unsplit**             | Bill captured but no split strategy applied yet              |
| **Split**               | Split defined and summaries generated; all payments resolved |
| **Unresolved Payments** | Split defined but one or more contacts have not yet paid     |

### 3.3 Key Features

- **AI/OCR receipt scanning** — automatic item extraction from a photo
- **Equal split** — divide total bill by N people
- **Item-based split** — assign specific items to specific contacts from the phone's contact list
- **Per-contact summaries** — send each person only their portion
- **WhatsApp notifications** — direct messaging per contact via Meta Cloud API
- **Email notifications** — full or per-contact bill summaries via Resend + React Email
- **Payment tracking** — mark contacts as paid or unpaid
- **Bill filtering** — filter home screen bills by state, contact, or amount range
- **Theme customization** — light and dark mode support
- **Language support** — English and Spanish

### 3.4 Home Screen

The home screen serves as the app's command center:

- Lists all bills with state indicators
- Filters by: bill state, assigned contact, amount range (slider)
- Floating action button (FAB) to add a new bill by taking a photo or selecting from the library

### 3.5 User Settings

- Theme selection (light / dark)
- Language selection (English / Spanish)
- Account management

---

## 4. Target Market

### 4.1 Primary Audience

- Colombian iPhone users aged 20–40
- Frequent social diners, university students, young professionals
- Groups of friends, couples, colleagues who regularly share tabs

### 4.2 Market Context

Colombia has a growing middle class with increasing smartphone penetration. WhatsApp is the dominant messaging platform in the country with near-universal adoption, making it the ideal notification channel. App Store purchasing is done in USD (Apple's pricing tiers apply), but pricing must reflect the economic context of the average Colombian consumer.

---

## 5. Subscription Model

### 5.1 Pricing Philosophy

Apple's App Store uses fixed pricing tiers. The closest tiers that balance value and accessibility for Colombian iPhone users are:

| Plan     | Price (USD/month) | Approx. COP/month | Billing               |
| -------- | ----------------- | ----------------- | --------------------- |
| **Free** | $0                | —                 | —                     |
| **Pro**  | $1.99             | ~COP 8,000        | Monthly               |
| **Pro**  | $14.99            | ~COP 60,000       | Yearly (~37% savings) |

> COP conversion based on approximate 2025 exchange rate of ~4,000 COP/USD.

### 5.2 Free Tier

- Up to **2 bills per month**
- Equal split only (no item-based split)
- WhatsApp and email notifications (limited to 3 contacts per bill)
- Basic bill history (last 30 days)
- Light theme only (no theme customization)

### 5.3 Pro Tier

- **Unlimited bills**
- Equal split and item-based split
- Unlimited contacts per bill
- Full bill history
- Per-contact summary sending (WhatsApp + email)
- Payment tracking
- Full filtering on home screen
- Theme customization (light / dark / system)
- Language toggle (English / Spanish)

### 5.4 Rationale

At ~COP 8,000/month (roughly the price of one coffee in Bogotá), the Pro tier is intentionally priced to minimize friction for upgrade decisions. The free tier is capped at 2 bills/month — enough for a new user to experience the full workflow, but tight enough to convert any user who dines out more than twice a month. Theme customization is gated behind Pro as an additional lifestyle incentive for users who care about personalization.

---

## 6. Technology Stack

| Layer              | Tool                                                        |
| ------------------ | ----------------------------------------------------------- |
| Mobile Framework   | Expo + React Native                                         |
| Styling            | NativeWind (Tailwind for RN)                                |
| UI Components      | React Native Reusables                                      |
| Navigation         | Expo Router                                                 |
| Global State       | Zustand                                                     |
| Data Fetching      | TanStack Query                                              |
| Forms & Validation | TanStack Form + Zod                                         |
| Backend            | Convex                                                      |
| Authentication     | WorkOS (Email OTP, Sign in with Apple, Sign in with Google) |
| File Uploads       | UploadThing                                                 |
| Email              | Resend + React Email                                        |
| WhatsApp           | Meta Cloud API (sandbox for dev, production for live)       |
| AI/OCR             | Claude Vision API (Anthropic)                               |

---

## 7. Monetization & Growth Strategy

### 7.1 Distribution

- iOS App Store (Colombia-first, then Latin America)
- Organic growth via WhatsApp sharing — every bill summary sent is a natural product touchpoint

### 7.2 Conversion Levers

- Free tier bill cap (5/month) creates natural upgrade pressure for regular users
- Item-based split is the most-requested feature in competing apps — gating it drives conversions
- Payment tracking is a Pro-only feature that adds ongoing retention value

### 7.3 Future Opportunities

- Android version
- Group/team plans for corporate expense sharing
- Integration with Colombian payment platforms (Nequi, Bancolombia, Daviplata)
- Export to PDF for expense reports

---

## 8. Success Metrics

| Metric                  | Target (6 months post-launch) |
| ----------------------- | ----------------------------- |
| Downloads               | 1,000+                        |
| Monthly Active Users    | 300+                          |
| Free-to-Pro conversion  | 8–12%                         |
| Bills created per MAU   | 4+                            |
| WhatsApp summaries sent | 2,000+/month                  |

---

## 9. Risks & Mitigations

| Risk                                     | Mitigation                                                  |
| ---------------------------------------- | ----------------------------------------------------------- |
| Meta WhatsApp API approval delays        | Use sandbox for MVP; ship with email-only fallback          |
| OCR inaccuracy on handwritten bills      | Allow manual item editing after scan                        |
| Low Colombian App Store purchasing power | Keep Pro price at lowest viable tier (~$1.99)               |
| User trust with contact data             | All contact data stays on-device; never uploaded to backend |
