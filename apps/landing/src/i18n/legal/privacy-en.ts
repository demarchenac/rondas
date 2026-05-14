export const privacyEn = `
<h2>Types of Personal Information Collected</h2>
<p>The App collects the following types of information depending on features used:</p>

<h3>Account Information</h3>
<p>When you sign in via WorkOS AuthKit (Email OTP, Apple, or Google), the following is collected: email address, name (if provided), avatar URL (if provided), authentication provider used. Account data is stored in Convex, a cloud database service.</p>

<h3>Receipt and Transaction Data</h3>
<p>When you create or scan bills: bill name, items, quantities, prices, tax and tip amounts, bill category/tags, currency and country settings.</p>

<h3>Contact Information</h3>
<p>The App accesses your device contacts to assign people to bill items. Contact data (name, phone number, profile photo) is read from your device with your permission, stored in Convex to enable bill splitting and sharing, and never sold or shared with third parties.</p>

<h3>Location Data</h3>
<p>With your permission: device GPS location (to identify where a bill was created), resolved to a place name via reverse geocoding.</p>

<h3>Photos and Camera</h3>
<p>With your permission: camera (to photograph receipts for AI scanning), photo library (to select existing receipt photos), EXIF metadata (date/time) from photos for bill timestamps.</p>

<h3>Error and Crash Reporting</h3>
<p>The App uses Sentry for error monitoring which may collect device type, OS, app version, crash logs, and IP address.</p>

<h3>Subscription Data</h3>
<p>The App uses RevenueCat to manage subscriptions which processes purchase receipts, subscription status, and anonymous user identifiers.</p>

<h2>Use of Personal Information</h2>
<p>Personal information is used for: providing core functionality (scanning, splitting, sharing), authenticating your account, syncing data across devices, generating summaries for WhatsApp sharing, processing subscriptions, monitoring errors, and improving AI scanning accuracy.</p>

<h2>Third-Party Services</h2>
<table>
<tr><th>Service</th><th>Purpose</th><th>Data Processed</th></tr>
<tr><td>Convex</td><td>Database and backend</td><td>Account, bills, contacts, tags</td></tr>
<tr><td>WorkOS</td><td>Authentication</td><td>Email, name, OAuth tokens</td></tr>
<tr><td>Google Gemini</td><td>AI receipt scanning</td><td>Receipt images, extracted items</td></tr>
<tr><td>RevenueCat</td><td>Subscriptions</td><td>Purchase receipts, entitlements</td></tr>
<tr><td>Sentry</td><td>Error monitoring</td><td>Crash logs, device info, IP</td></tr>
<tr><td>Expo</td><td>App updates (OTA)</td><td>Device type, app version</td></tr>
</table>

<h2>AI Receipt Processing</h2>
<p>When you scan a receipt, the image is sent to Google Gemini for processing as base64 data. It is not stored permanently. Google does not use API data to train their models.</p>

<h2>Data Storage and Security</h2>
<p>All data is stored in Convex cloud infrastructure. Communication is encrypted via HTTPS/TLS. Authentication is managed by WorkOS with industry-standard security.</p>

<h2>User Rights</h2>
<p>You have the right to: access your personal data, correct inaccurate data, delete your account and data, export your data, and object to certain processing.</p>

<h3>Colombian Data Protection (Ley 1581 de 2012)</h3>
<p>If located in Colombia: right to know, update, and rectify your data; right to request proof of consent; right to revoke consent and request deletion; right to file complaints with the Superintendencia de Industria y Comercio (SIC).</p>

<h3>GDPR (European Economic Area)</h3>
<p>If located in the EEA: right to data portability, restrict processing, and lodge complaints with your local data protection authority. Legal basis: contract performance, legitimate interest, and consent.</p>

<p>To exercise any rights, contact us at <a href="mailto:legal@rondas.co">legal@rondas.co</a>.</p>

<h2>Children's Privacy</h2>
<p>The App is not intended for children under 13. We do not knowingly collect information from children.</p>

<h2>Contact</h2>
<p>Email: <a href="mailto:legal@rondas.co">legal@rondas.co</a><br>Developer: Cristhian De Marchena</p>
`;
