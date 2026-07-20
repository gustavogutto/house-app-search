# Dublin Rental Alerts

Watches Daft.ie / Rent.ie / MyHome.ie saved-search alert emails and notifies you and your girlfriend within seconds of a new matching listing, via push notification, SMS, and email.

No scraping: the three sites' own "email me new listings" saved-search feature is pointed at a dedicated inbound-parsing email address, so ingestion is real-time and stays within each site's Terms of Service.

## How it works

1. You create a saved search on each site with instant email alerts, pointed at a free Resend inbound address.
2. The moment an alert email arrives, Resend POSTs a webhook event to `/api/inbound-email`, which fetches the full email content.
3. The raw email is stored immediately (`inbound_emails` table), then parsed for listing details (price, address, bedrooms, link).
4. New listings are checked against your saved filters (`/settings`).
5. On a match, push + SMS + email all fire, and every attempt is logged (`notification_log`).
6. `/dashboard` shows everything ingested; `/dashboard/[id]/raw` shows the raw email next to what was extracted, for debugging.

Each person has their own login (email + password), managed with `npm run set-password`.

## One-time setup

### 1. Accounts you need to create
- **Resend** (https://resend.com) — for inbound email parsing and outbound notification emails. Free tier, no custom domain needed for inbound.
- **Twilio** (https://twilio.com) — for SMS. A trial account works for 2 known phone numbers.
- **Vercel Marketplace Postgres (Neon)** — provisioned through your Vercel project, no separate signup.

> Outbound notification email is sent from Resend's shared `onboarding@resend.dev` address, which does not require domain verification but has weaker deliverability (may land in spam) — push notifications and SMS are the reliable "instant" channels; treat email as a bonus. Verifying your own domain in Resend later removes this limitation.

### 2. Install dependencies
```bash
npm install
```

### 3. Provision the database
Link this project to Vercel, add a Marketplace Postgres (Neon) database from the Vercel dashboard (Storage tab), then:
```bash
vercel env pull .env.local
```
This fills in `DATABASE_URL`. Then push the schema:
```bash
npm run db:push
```

### 4. Create logins
Each person gets their own email + password:
```bash
npm run set-password -- "you@example.com" "your-password"
npm run set-password -- "partner@example.com" "their-password"
```
Also seed the default filter row:
```bash
npm run db:seed
```

### 5. Generate the remaining secrets
```bash
npx web-push generate-vapid-keys   # -> VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```
Also generate a random `SESSION_SECRET` (e.g. `openssl rand -base64 32`).

Copy `.env.example` to `.env.local` and fill in everything (see that file for the full list): Resend API key + webhook secret, Twilio SID/token/number, the VAPID keys, and the session secret. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the same value as `VAPID_PUBLIC_KEY`.

Add the same values as environment variables in the Vercel project settings before deploying.

### 6. Deploy, then wire up Resend
Deploy first (`vercel --prod` or push to your connected git repo) so you have a live URL. Then in Resend:
- Go to **Emails → Receiving** in the Resend dashboard and enable it — you'll get a free managed address like `xxxx@your-name.resend.app` with no DNS setup. **Copy this address**, you'll need it in step 7.
- Go to **Webhooks**, create one pointed at `https://your-app.vercel.app/api/inbound-email`, subscribed to the `email.received` event only.
- Copy the webhook's signing secret (starts with `whsec_`) into `RESEND_WEBHOOK_SECRET`.
- Get your **API Key** from the Resend dashboard into `RESEND_API_KEY` (used both to fetch full email content and to send notification emails).

### 7. Point the saved searches at Resend
On Daft.ie, Rent.ie, and MyHome.ie, create a saved search for what you're looking for and set the alert email to the Resend inbound address from step 6. **Do this one site at a time and check `/dashboard`** — each site sends a confirmation email first, which will show up in the "Needs attention" panel with a one-click link to confirm.

### 8. Set your filters and enable notifications
Go to `/settings`:
- Edit the seeded filter (price range, areas, bedrooms) or add more.
- Fill in your and your girlfriend's phone number (E.164 format, e.g. `+353871234567`) and toggle which channels each of you wants.
- Click "Enable push on this device" on every phone/laptop you want alerts on. **On iPhone, you must first add the site to your Home Screen** (Share → Add to Home Screen) — Safari only delivers push notifications to installed PWAs, not to the regular browser tab.

## Local development
```bash
npm run dev
```
Note: most pages need a real `DATABASE_URL` to render (they read from Postgres). `/login` works without one.

## If a parser needs tuning
Real alert emails' exact HTML structure isn't known in advance — a generic pattern-matching fallback (`lib/parsers/generic.ts`) extracts what it can from any of the three sites' known listing URL patterns. Once real alerts are flowing, open a few in `/dashboard/[id]/raw` to see raw HTML next to what got extracted, tighten the matching per-source parser (`lib/parsers/{daft,rentie,myhome}.ts`), then backfill history without waiting for new emails:
```bash
npm run reparse
```

## Useful scripts
- `npm run db:generate` / `npm run db:push` — Drizzle migrations
- `npm run db:seed` — seed the default filter (safe to re-run, skips if a filter already exists)
- `npm run set-password -- "email" "password"` — create or update a person's login
- `npm run reparse` — backfill listings from previously-failed/partial raw emails
