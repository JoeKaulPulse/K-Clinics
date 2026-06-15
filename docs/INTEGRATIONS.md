# K Clinics — API & Credentials Reference

Every external service the platform can use, the exact environment variables it
needs, where to get them, and **what degrades if they're missing**.

The platform follows an **inert-until-credentialed** pattern: every integration
detects whether its keys are present and, if not, falls back to a safe no-op or
dummy data. Nothing crashes when a credential is absent — the related feature is
simply dormant until you supply it. So you can load these into Vercel in any
order, in one go, and each capability lights up as its keys arrive.

To set them in production: **Vercel → Project → Settings → Environment
Variables** (scope to *Production*, and *Preview* if you want previews live).
Redeploy after adding a batch. Locally, copy `.env.example` → `.env`.

> Legend — **Required**: the app's core won't function without it.
> **Recommended**: strongly advised for production. **Optional**: lights up an
> extra capability; safe to defer.

---

## 1. Core platform — **Required**

| Variable | Purpose | Where to get it |
|---|---|---|
| `DATABASE_URL` | Postgres connection (CRM, portal, bookings, all data). | Neon / Vercel Postgres / Supabase connection string (`?sslmode=require`). |
| `CRM_ENABLED` / `NEXT_PUBLIC_CRM_ENABLED` | Turns the CRM + client portal on. Both `true` in prod. | Set to `true`. |
| `ADMIN_JWT_SECRET` | Signs staff/admin session cookies. | `openssl rand -base64 32` |
| `CLIENT_JWT_SECRET` | Signs client-portal session cookies (use a *different* value). | `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for email + booking + review links. | `https://kclinics.co.uk` |

**Without these:** the site falls back to the static marketing-only mode; no
login, bookings, or portal.

---

## 2. Clinical data encryption — **Required once clinical data exists**

| Variable | Purpose | Where to get it |
|---|---|---|
| `HEALTH_ENCRYPTION_KEY` | AES-256-GCM key for health-assessment / clinical notes. Must decode to **exactly 32 bytes**. | `openssl rand -base64 32` |
| `HEALTH_HMAC_KEY` | Integrity HMAC for encrypted clinical records (recommended). | `openssl rand -base64 32` |

> ⚠️ **Never change `HEALTH_ENCRYPTION_KEY` once clinical data is stored** — it
> would render existing encrypted records unreadable.

**Without these:** health-assessment capture and encrypted clinical notes are
disabled.

---

## 3. Email — Resend — **Required for transactional email**

Powers: booking confirmations, reminders, password resets, **review requests**,
front-desk notifications.

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | API key from [resend.com](https://resend.com) (verify your sending domain first). |
| `EMAIL_FROM` | e.g. `K Clinics <hello@kclinics.co.uk>` |
| `EMAIL_REPLY_TO` | Reply-to address. |
| `CLINIC_NOTIFY_EMAIL` | Internal inbox for new-booking / enquiry alerts. |

**Without `RESEND_API_KEY`:** all email sends become no-ops (logged, not sent).
Bookings still work; clients/staff just don't get emails.

> Resend is **transactional sending only** (from the `mail.kclinics.co.uk`
> subdomain). The **company mailboxes** staff log into are separate. To move them
> from Hostinger to Google Workspace at lowest cost with no data loss — and to
> manage Workspace accounts from `/admin` (**BLD-312**) — see
> [`docs/GOOGLE_WORKSPACE_MIGRATION.md`](./GOOGLE_WORKSPACE_MIGRATION.md). The
> apex MX moves to Google; the Resend subdomains are left untouched.

---

## 4. Payments — Stripe — **Required for online booking with card**

Card is saved at booking (no upfront charge); charged on delivery / late-cancel.

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` (or `sk_test_…` while testing). |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` — client-side. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from your Stripe webhook endpoint (point it at `/api/stripe/webhook`). |
| `SLOT_INTERVAL_MIN` | *Optional.* Booking grid granularity (default `15`). |
| `BOOKING_TIMEZONE` | *Optional.* Default `Europe/London`. |

**Without Stripe keys:** card capture is skipped; bookings can still be taken
without a saved card (no deposit / no-show protection).

---

## 5. Cron / scheduled jobs — **Recommended**

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Bearer secret protecting cron endpoints (reminders, reorder checks, review nudges). Set the same value in the Vercel Cron config. |

**Without it:** scheduled endpoints are unprotected / not driven on a schedule.

---

## 6. Google Calendar (clinician availability sync) — **Optional**

Two-way busy-time sync + event push per clinician (OAuth per user).

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID — Google Cloud Console → APIs & Services → Credentials. |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | `https://kclinics.co.uk/api/admin/gcal/callback` — **must match exactly** or Google returns `redirect_uri_mismatch`. |
| `GOOGLE_INTEGRATION_ENABLED` | `true` switches the sync on (parked otherwise). Read-only `calendar.readonly` scope. |

Enable the **Google Calendar API** on the project. Guards: `googleConfigured()` + `googleEnabled()`.

**Without these:** the "Connect Google Calendar" button is inert; scheduling uses
only the in-app rota.

---

## 7. Google reviews & Business Profile — **Optional**

First-party reviews are nudged to Google for happy clients, and your real Google
rating + reviews can be shown on the site, blended with in-house reviews.

| Variable | Purpose |
|---|---|
| `GOOGLE_PLACE_ID` | Your Google Place ID — powers the public "Share it on Google" deep link and identifies the business for the Places lookup. From the [Place ID finder](https://developers.google.com/maps/documentation/places/web-service/place-id). |
| `GOOGLE_PLACES_API_KEY` | **Required to display your Google star-rating + reviews** on the homepage, `/reviews` and the blended aggregate (`lib/reviews-aggregate.ts`). Google Cloud Console → enable **Places API** → create an API key (restrict to Places API). |
| `GOOGLE_BUSINESS_ACCOUNT_ID` / `GOOGLE_BUSINESS_LOCATION_ID` | Business Profile **management** API: import every Google review into the admin Reviews page + **reply** in-app (`lib/google-business.ts`). Also register the redirect URI `…/api/admin/integrations/google-business/callback` in the OAuth client, have Google grant your project [Business Profile API access](https://developers.google.com/my-business/content/prereqs), then click **Connect Google Business** on the admin Reviews page. Syncs nightly. |

**Without `GOOGLE_PLACE_ID`:** review submission still works and is stored;
clients just aren't offered the Google hand-off. **Without `GOOGLE_PLACES_API_KEY`:**
only in-house reviews feed the public rating (no Google reviews shown). The
leave-a-review and moderation flow is fully functional regardless.

---

## 8. SMS — Twilio — **Optional**

Powers SMS review requests / reminders (email is the default channel).

| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio Console. |
| `TWILIO_AUTH_TOKEN` | Twilio Console. |
| `TWILIO_FROM` | Your Twilio sending number / messaging service. |

Guard: `smsConfigured()`. **Without these:** SMS sends are logged as dummy and
return success without dispatching; email channel is unaffected.

---

## 9. Accounting — Xero — **Optional**

Push invoices / reconcile to Xero.

| Variable | Purpose |
|---|---|
| `XERO_CLIENT_ID` | Xero developer app. |
| `XERO_CLIENT_SECRET` | Xero developer app. |
| `XERO_REDIRECT_URI` | *Optional.* Defaults to `${NEXT_PUBLIC_SITE_URL}/api/admin/integrations/xero/callback`. |

Guard: `xeroConfigured()`. **Without these:** the Xero connect button is inert.

---

## 10. Open banking — TrueLayer — **Optional**

Live cashflow / bank feed in the finance area.

| Variable | Purpose |
|---|---|
| `TRUELAYER_CLIENT_ID` | TrueLayer console. |
| `TRUELAYER_CLIENT_SECRET` | TrueLayer console. |
| `TRUELAYER_REDIRECT_URI` | *Optional.* Defaults to `${NEXT_PUBLIC_SITE_URL}/api/admin/integrations/truelayer/callback`. |

Guard: `trueLayerConfigured()`. **Without these:** cashflow uses CRM data only,
no live bank feed.

---

## 11. Translation (optional convenience)

Auto-translation helper for CRM content (the EN/UK UI is shipped statically and
does **not** depend on this).

| Variable | Purpose |
|---|---|
| `DEEPL_API_KEY` | DeepL key. Set `DEEPL_API_FREE=true` for the free tier host. |
| `GOOGLE_TRANSLATE_KEY` | Alternative: Google Cloud Translation key. |

Guard: `translationConfigured()` (either key activates it).

---

## 12. Content (optional) — Headless WordPress

| Variable | Purpose |
|---|---|
| `WORDPRESS_API_URL` | e.g. `https://cms.kclinics.co.uk/wp-json`. Optional editable content / palette. |

---

## 13. Seeding the first admin (one-off, local)

Used by `npm run db:push && node prisma/seed.mjs`.

| Variable | Purpose |
|---|---|
| `SEED_ADMIN_EMAIL` | First owner login. |
| `SEED_ADMIN_PASSWORD` | Change immediately after first login. |
| `SEED_ADMIN_NAME` | Display name. |

---

## Quick priority for go-live

1. **Core** (§1) + **Encryption** (§2) — the platform runs.
2. **Resend** (§3) — clients & staff get email.
3. **Stripe** (§4) — paid/protected bookings.
4. **Cron** (§5) — reminders & automations on schedule.
5. **Google Place ID** (§7) — turn on the review→Google hand-off.
6. Everything else (§6, §8–§12) as you adopt each workflow.
