# Notifications

## WhatsApp (Meta Cloud API)

- Use sandbox for development, production API for live
- Store API credentials in environment variables (never in code)
- Send per-contact messages with item list and total owed
- Handle rate limits and delivery failures gracefully
- Show toast on send success/failure

## Email (Resend + React Email)

- Templates live in `/emails` directory as React components
- Two templates: per-contact summary, full group summary
- Send via Convex action calling Resend API
- Support both English and Spanish templates based on user's language preference
