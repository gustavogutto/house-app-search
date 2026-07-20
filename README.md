# Dublin Rental Alerts

Watches Daft.ie / Rent.ie / MyHome.ie saved-search alert emails and notifies you and your girlfriend within seconds of a new matching listing, via push notification, SMS, and email.

No scraping: the three sites' own "email me new listings" saved-search feature is pointed at a dedicated inbound-parsing email address, so ingestion is real-time and stays within each site's Terms of Service.

## How it works

1. You create a saved search on each site with instant email alerts, pointed at a Postmark inbound address.
2. The moment an alert email arrives, Postmark POSTs it to `/api/inbound-email`.
3. The raw email is stored immediately (`inbound_emails` table), then parsed for listing details (price, address, bedrooms, link).
4. New listings are checked against your saved filters (`/settings`).
5. On a match, push + SMS + email all fire, and every attempt is logged (`notification_log`).
6. `/dashboard` shows everything ingested; `/dashboard/[id]/raw` shows the raw email next to what was extracted, for debugging.

## One-time setup

### 1. Accounts you need to create
- **Postmark** (https://postmarkapp.com) — for inbound email parsing and outbound notification emails. Free tier is fine to start.
- **Twilio** (https://twilio.com) — for SMS. A trial account works for 2 known phone numbers.
- **Vercel Marketplace Postgres (Neon)** — provisioned through your Vercel project, no separate signup.

### 2. Install dependencies
```bash
npm install
```

### 3. Provision the database
Link this project to Vercel, add a Marketplace Postgres (Neon) database from the Vercel dashboard (Storage tab), then:
```bash
vercel env pull .env.local
```
This fills in `DATABASE_URL`. Then push the schema and seed initial rows:
```bash
npm run db:push
npm run db:seed
```

### 4. Generate secrets
```bash
npm run hash-password -- "your-shared-password"   # -> AUTH_PASSWORD_HASH
npx web-push generate-vapid-keys                   # -> VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```
Also generate a random `SESSION_SECRET` (e.g. `openssl rand -base64 32`).

Copy `.env.example` to `.env.local` and fill in everything (see that file for the full list): Postmark token + inbound webhook basic-auth creds, Twilio SID/token/number, the VAPID keys, the password hash, and the session secret. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the same value as `VAPID_PUBLIC_KEY`.

Add the same values as environment variables in the Vercel project settings before deploying.

### 5. Deploy, then wire up Postmark's inbound webhook
Deploy first (`vercel --prod` or push to your connected git repo) so you have a live URL. Then in Postmark:
- Create an **Inbound** message stream, note the inbound address it gives you (e.g. `xxxx@inbound.postmarkapp.com`).
- Set its webhook URL to `https://<user>:<pass>@your-app.vercel.app/api/inbound-email`, using the same `POSTMARK_INBOUND_WEBHOOK_USER`/`_PASS` you put in your env vars.
- Create a **Server** token (and separate outbound stream, or reuse the default "outbound" stream) for sending notification emails — this is `POSTMARK_SERVER_TOKEN`. For real deliverability, verify a sending domain (SPF/DKIM) in Postmark rather than using their shared default.

### 6. Point the saved searches at Postmark
On Daft.ie, Rent.ie, and MyHome.ie, create a saved search for what you're looking for and set the alert email to the Postmark inbound address from step 5. **Do this one site at a time and check `/dashboard`** — each site sends a confirmation email first, which will show up in the "Needs attention" panel with a one-click link to confirm.

### 7. Set your filters and enable notifications
Go to `/settings`:
- Edit the seeded filter (price range, areas, bedrooms) or add more.
- Fill in your and your girlfriend's email + phone (E.164 format, e.g. `+353871234567`) and toggle which channels each of you wants.
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
- `npm run db:seed` — seed 2 recipients + 1 default filter (safe to re-run, skips if rows exist)
- `npm run hash-password -- "pw"` — generate `AUTH_PASSWORD_HASH`
- `npm run reparse` — backfill listings from previously-failed/partial raw emails
