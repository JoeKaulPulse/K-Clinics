# Go Live — deploy the real CRM + booking (Vercel)

The GitHub Pages link is a **static demo** — `/admin`, the booking backend and
email are stripped from it. To run the real CRM you deploy the app to a server
host. This guide uses **Vercel + Neon Postgres + Resend + Stripe**.

Estimated time: ~15 minutes.

---

## 1. Create the external services (free tiers are fine to start)
| Service | What you need | Where |
|---|---|---|
| **Postgres** | a connection string | neon.tech (or supabase.com) → create project → copy `DATABASE_URL` |
| **Resend** | API key + verified sending domain | resend.com → API Keys |
| **Stripe** | secret + publishable keys | dashboard.stripe.com → Developers → API keys |

Generate two random secrets locally:
```bash
openssl rand -hex 32   # use for ADMIN_JWT_SECRET
openssl rand -hex 32   # use for CRON_SECRET
```

## 2. Import the project into Vercel
1. vercel.com → **Add New → Project** → import **JoeKaulPulse/K-Clinics**.
2. Framework preset: **Next.js** (auto-detected). Leave build settings default.
3. **Before the first deploy**, add the Environment Variables below
   (Production + Preview). Full reference: `.env.example`.

```
NEXT_PUBLIC_CRM_ENABLED=true
DATABASE_URL=postgresql://...               # from Neon/Supabase
RESEND_API_KEY=re_...
EMAIL_FROM=K Clinics <hello@kclinics.co.uk>
EMAIL_REPLY_TO=hello@kclinics.co.uk
CLINIC_NOTIFY_EMAIL=frontdesk@kclinics.co.uk
ADMIN_JWT_SECRET=<random hex>
CRON_SECRET=<random hex>
NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN
STRIPE_SECRET_KEY=sk_live_...               # or sk_test_ to trial
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...   # or pk_test_
STRIPE_WEBHOOK_SECRET=whsec_...             # added in step 5
```
4. Click **Deploy**. (Build command is the default `next build`; on Vercel the
   server routes are NOT stripped — the API/admin/middleware all ship.)

> Note: `prisma generate` runs automatically via the installed Prisma version.
> If a build ever fails on the Prisma client, set the build command to
> `prisma generate && next build`.

## 3. Create the database tables
Run once against your `DATABASE_URL` (locally or via Vercel CLI):
```bash
# locally, with the same DATABASE_URL in your shell/.env:
npm install
npx prisma db push          # creates all tables (Client, Booking, …)
```

## 4. Create your admin login
```bash
SEED_ADMIN_EMAIL=you@kclinics.co.uk \
SEED_ADMIN_PASSWORD='choose-a-strong-password' \
SEED_ADMIN_NAME='Your Name' \
node prisma/seed.mjs
```
(You can re-run this any time to reset the password / add the owner.)

## 5. Point Stripe at the webhook
Stripe dashboard → Developers → Webhooks → **Add endpoint**:
- URL: `https://YOUR-DOMAIN/api/stripe/webhook`
- Events: `setup_intent.succeeded`, `payment_intent.succeeded`
- Copy the **Signing secret** → set `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy.

## 6. Sign in to the CRM
- Go to **`https://YOUR-DOMAIN/admin`**
- You'll be redirected to `/admin/login` → sign in with the seeded credentials.

You're in. Sidebar: **Overview · Bookings · Consultations · Clients · Campaigns · Automations.**

---

## What runs automatically once live
- **Bookings** at `/book` save a card (no charge) and appear under `/admin/bookings`.
- **Daily automations** (birthday / follow-up / win-back / review) run via the
  Vercel Cron defined in `vercel.json` hitting `/api/cron/daily` (authorised by
  `CRON_SECRET`). Enable Cron in Vercel → Project → Settings → Cron Jobs if not
  auto-enabled.

## Finalise before taking real payments
- **Opening hours** → `lib/site.ts` (drives booking availability).
- **Prices + durations** → `lib/treatments.ts` → `bookingConfig`.
- **NAP / phone / email** → `lib/site.ts`.
- Switch Stripe keys from `sk_test_`/`pk_test_` to live.

## Custom domain
Vercel → Project → Settings → Domains → add `kclinics.co.uk`. Then update
`NEXT_PUBLIC_SITE_URL` and `site.url` (`lib/site.ts`) to match.
