# Privacy Policy

**Last Updated:** May 13, 2026

This Privacy Policy ("Policy") explains how Cristhian De Marchena ("Developer") collects, uses, and protects the personal information of users ("User" or "you") of the Rondas mobile application ("App").

## Types of Personal Information Collected

The App collects the following types of information depending on features used:

### Account Information

When you sign in via WorkOS AuthKit (Email OTP, Apple, or Google), the following is collected:

- Email address
- Name (if provided by the identity provider)
- Avatar URL (if provided by the identity provider)
- Authentication provider used

Account data is stored in Convex, a cloud database service.

### Receipt and Transaction Data

When you create or scan bills, the following is collected:

- Bill name, items, quantities, and prices
- Tax and tip amounts
- Bill category/tags
- Currency and country settings

### Contact Information

The App accesses your device contacts to assign people to bill items. Contact data (name, phone number, profile photo) is:

- Read from your device with your permission
- Stored in Convex to enable bill splitting and sharing features
- Never sold or shared with third parties

### Location Data

With your permission, the App collects:

- Device GPS location (to identify where a bill was created)
- Location is resolved to a place name via reverse geocoding

### Photos and Camera

With your permission, the App accesses:

- Camera (to photograph receipts for AI scanning)
- Photo library (to select existing receipt photos)
- EXIF metadata (date/time) from photos for bill timestamps

### Error and Crash Reporting

The App uses Sentry for error monitoring. Sentry may collect:

- Device type and operating system
- App version and build number
- Crash logs and stack traces
- IP address (for geolocation of errors)

### Subscription Data

The App uses RevenueCat to manage subscriptions. RevenueCat processes:

- Purchase receipts from the App Store
- Subscription status and entitlements
- Anonymous user identifiers

## Use of Personal Information

Personal information is used for:

- Providing the App's core functionality (bill scanning, splitting, and sharing)
- Authenticating your account
- Syncing data across your devices
- Generating bill summaries for sharing via WhatsApp
- Processing subscription purchases
- Monitoring and fixing errors and crashes
- Improving the AI receipt scanning accuracy

## Third-Party Services

The App uses the following third-party services:

| Service | Purpose | Data Processed |
|---------|---------|----------------|
| **Convex** | Database and backend | Account, bills, contacts, tags |
| **WorkOS** | Authentication | Email, name, OAuth tokens |
| **Google Gemini** | AI receipt scanning | Receipt images (base64), extracted items |
| **RevenueCat** | Subscription management | Purchase receipts, entitlements |
| **Sentry** | Error monitoring | Crash logs, device info, IP address |
| **Expo** | App updates (OTA) | Device type, app version |

No personal data is sold to third parties. Data is only shared with the services listed above to provide the functionality you requested.

## AI Receipt Processing

When you scan a receipt, the image is sent to Google Gemini for processing. The image is transmitted as base64 data and is not stored permanently by the App or by Google beyond their standard API data retention (typically 30 days for abuse monitoring). Google does not use API data to train their models. See Google's API data usage policies for details.

## Data Storage and Security

- All data is stored in Convex cloud infrastructure
- Communication between the App and backend services is encrypted via HTTPS/TLS
- Authentication is managed by WorkOS with industry-standard security practices
- Subscription credentials are managed by RevenueCat and the App Store

## Data Retention

- Account and bill data is retained until you request deletion
- Receipt images are not stored permanently (processed in memory during scanning)
- Sentry error logs are retained according to Sentry's data retention policies
- RevenueCat retains subscription data as required by App Store guidelines

## User Rights

You have the following rights regarding your personal data:

- **Access:** Request a copy of the personal data we hold about you
- **Correction:** Request correction of inaccurate data
- **Deletion:** Request deletion of your account and associated data
- **Export:** Request your data in a portable format
- **Objection:** Object to certain types of data processing

### Colombian Data Protection (Ley 1581 de 2012)

If you are located in Colombia, you have additional rights under the Habeas Data law, including:

- Right to know, update, and rectify your personal data
- Right to request proof of consent
- Right to revoke consent and request deletion of data
- Right to file complaints with the Superintendencia de Industria y Comercio (SIC)

### GDPR (European Economic Area)

If you are located in the EEA, you have additional rights under GDPR:

- Right to data portability
- Right to restrict processing
- Right to lodge a complaint with your local data protection authority

Legal basis for processing: contract performance (providing app services), legitimate interest (security, error monitoring), and consent (optional features like location and contacts).

To exercise any of these rights, contact us at legal@rondas.co.

## International Data Transfers

Your data may be transferred to and processed in countries outside your country of residence, including the United States, where Convex and other service providers operate. These transfers are protected by appropriate safeguards including Standard Contractual Clauses where applicable.

## Children's Privacy

The App is not intended for use by children under the age of 13. We do not knowingly collect personal information from children.

## Changes to This Policy

We may update this Privacy Policy from time to time. Material changes will be communicated through the App or via email.

## Contact

If you have questions about this Privacy Policy, contact us at:

- **Email:** legal@rondas.co
- **Developer:** Cristhian De Marchena
