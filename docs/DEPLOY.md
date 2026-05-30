# Deploying K Clinics to production (Vercel + Postgres)

A step-by-step guide to host the **full** site — marketing pages, online booking,
the client portal and the staff CRM — and have every push to the `main` branch
deploy itself to production automatically.

> The GitHub **Pages** site is only a static preview (no database). The real,
> fully-functional app runs on **Vercel**, which is what this guide sets up.

---

## What you'll end up with

- A live URL (e.g. `k-clinics.vercel.app`, then your own domain).
- A Postgres database holding clients, bookings and encrypted health records.
- **Push to `main` → it's live in ~2 minutes.** No manual deploy steps.

You'll need ~20 minutes and free accounts at: **GitHub** (you have this),
**Vercel**, **Stripe** and **Resend**.

---

## Step 1 — Create a Vercel account and connect GitHub

1. Go to **https://vercel.com/signup**.
2. Click **“Continue with GitHub”** and authorise Vercel.
3. When asked which repositories Vercel can access, choose **`joekaulpulse/k-clinics`** (or “All repositories”).

## Step 2 — Import the project

1. On the Vercel dashboard click **“Add New…” → “Project”**.
2. Find **`k-clinics`** in the list and click **“Import”**.
3. Vercel auto-detects **Next.js** — leave Framework Preset, Build Command and
   Output as their defaults. **Don’t deploy yet** — add the database and env
   vars first (next steps), or the first build will fail.
4. (If it deploys automatically and fails, that’s fine — we’ll redeploy at the end.)

## Step 3 — Add a Postgres database

1. In your new project, open the **“Storage”** tab.
2. Click **“Create Database” → “Postgres”** (Neon-powered) → pick the region
   closest to London → **Create**.
3. Click **“Connect”** to attach it to the project. Vercel automatically adds
   the `DATABASE_URL` environment variable for you. ✅

## Step 4 — Get your Stripe keys (online booking)

1. Sign in at **https://dashboard.stripe.com**.
2. Top-right, keep **“Test mode”** ON for now.
3. Go to **Developers → API keys**. Copy:
   - **Publishable key** (`pk_test_…`)
   - **Secret key** (`sk_test_…`) — click “Reveal”.
4. (Webhook — do this after Step 7, once you have your live URL.)

## Step 5 — Get your Resend key (emails)

1. Sign in at **https://resend.com**.
2. **API Keys → Create API Key** → copy it (`re_…`).
3. (Optional now) **Domains → Add Domain** to send from `@kclinics.co.uk`.
   Until verified, emails still queue without breaking the app.

## Step 6 — Add the environment variables

In Vercel: **Project → Settings → Environment Variables**. Add each row below
(Name, then Value), with environment **“Production”** ticked (also tick
Preview/Development if you want PR previews to work):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_CRM_ENABLED` | `true` |
| `CRM_ENABLED` | `true` |
| `ADMIN_JWT_SECRET` | *(run `openssl rand -base64 32`)* |
| `CLIENT_JWT_SECRET` | *(run `openssl rand -base64 32` — different value)* |
| `HEALTH_ENCRYPTION_KEY` | *(run `openssl rand -base64 32`)* |
| `HEALTH_HMAC_KEY` | *(run `openssl rand -base64 32` — optional but recommended)* |
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |
| `RESEND_API_KEY` | `re_…` |
| `EMAIL_FROM` | `K Clinics <hello@kclinics.co.uk>` |
| `SENDER_EMAIL` | `hello@kclinics.co.uk` |
| `CRON_SECRET` | *(run `openssl rand -hex 16`)* |
| `NEXT_PUBLIC_SITE_URL` | `https://kclinics.co.uk` |

`DATABASE_URL` is already there from Step 3. `STRIPE_WEBHOOK_SECRET` comes in Step 8.

> **Generating secrets:** on a Mac/Linux terminal run `openssl rand -base64 32`
> once per secret and paste the output. On Windows, use the Git Bash terminal,
> or any “random 32-byte base64” generator.

> ⚠️ Keep these secret. Never commit real values to git (`.env` is gitignored).
> Don’t change `HEALTH_ENCRYPTION_KEY`/`HEALTH_HMAC_KEY` after real health data
> exists, or that data can no longer be decrypted.

## Step 7 — Create the database tables, then deploy

The schema needs to be pushed to the new database once.

**Easiest (from your computer):**
1. Install Node 20+ and clone the repo: `git clone https://github.com/joekaulpulse/k-clinics.git`
2. `cd k-clinics && npm install`
3. Create a `.env` file (copy `.env.example`) and paste the **same**
   `DATABASE_URL` value from Vercel (Storage → your DB → `.env.local` tab).
4. Run **`npx prisma db push`** — this creates all the tables.
5. (Optional) seed a first staff login: `node prisma/seed.mjs` *(check the file
   for the default credentials, then change the password).*

Now back in Vercel, open the **Deployments** tab and click **“Redeploy”** on the
latest deployment (or just push any commit). The build will succeed. 🎉

## Step 8 — Wire the Stripe webhook (charges & confirmations)

1. Note your live URL from Vercel (e.g. `https://k-clinics.vercel.app`).
2. In Stripe: **Developers → Webhooks → “Add endpoint”**.
3. Endpoint URL: `https://YOUR-URL/api/stripe/webhook`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `setup_intent.succeeded` (or “all events” to be safe).
5. Create it, then copy the **Signing secret** (`whsec_…`).
6. Add it in Vercel as `STRIPE_WEBHOOK_SECRET`, then **Redeploy** once more.

---

## ✅ Automatic production deploys (the part you asked for)

This is already on once the project is imported — no extra setup:

- **Push to `main` → Vercel builds & deploys to Production automatically.**
- Open a Pull Request → Vercel posts a **Preview URL** for that branch.
- Merge the PR into `main` → it promotes to Production.

To confirm it’s connected: **Vercel → Project → Settings → Git** should show
`joekaulpulse/k-clinics` with **Production Branch = `main`**. That’s the default.

So your day-to-day is simply:

```bash
git add -A
git commit -m "your change"
git push origin main      # → live in ~2 minutes
```

---

## Step 9 — Add your real domain (optional, when ready)

1. **Vercel → Project → Settings → Domains → Add** `kclinics.co.uk`.
2. Vercel shows the DNS records to set at your domain registrar (an `A` record
   and/or `CNAME`). Add them; SSL is issued automatically.
3. Update `NEXT_PUBLIC_SITE_URL` to `https://kclinics.co.uk` and redeploy.

## Step 10 — Go live (switch Stripe out of test mode)

When you’re ready to take real payments:
1. In Stripe, toggle **Test mode → off**, grab the **live** `pk_live_…` /
   `sk_live_…` keys and a **live** webhook signing secret.
2. Replace the three Stripe values in Vercel’s env vars → **Redeploy**.

---

## Quick reference: the two run modes

| | GitHub Pages (demo) | Vercel (production) |
| --- | --- | --- |
| URL | `joekaulpulse.github.io/K-Clinics` | your Vercel/custom domain |
| Database | none | Postgres |
| Booking | demo (test cards, nothing charged) | real Stripe |
| CRM / portal / health forms | disabled | fully working |
| Deploys on push to `main` | yes (static) | yes (full app) |

## Troubleshooting

- **Build fails: “ADMIN_JWT_SECRET is required”** → you missed an env var in
  Step 6. Add it and redeploy.
- **“PrismaClientInitializationError” / can’t reach database** → `DATABASE_URL`
  is wrong or you skipped `prisma db push` (Step 7).
- **Login works but data doesn’t save** → tables not created; run
  `npx prisma db push` against the production `DATABASE_URL`.
- **Payments don’t complete** → webhook missing/incorrect (Step 8).
- **Health assessment won’t open after a key change** → you rotated
  `HEALTH_ENCRYPTION_KEY`; restore the original value.
