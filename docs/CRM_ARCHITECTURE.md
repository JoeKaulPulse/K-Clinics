# K Clinics — CRM & Platform Architecture

## Decisions (confirmed)
- **CRM:** custom-built in this codebase (full ownership of client data)
- **Hosting:** Vercel (app + API + cron) + managed Postgres (Neon/Supabase)
- **Email:** Resend (transactional + marketing broadcasts)

## Hosting model change (important)
The marketing site currently static-exports to **GitHub Pages**. A CRM needs an
always-on server + database, which Pages cannot run. Therefore:

- **Production → Vercel** runs the *full* app: marketing site + `/consultation`
  forms + `/api/*` + `/admin` dashboard + cron automations + Postgres + Resend.
- **GitHub Pages stays as a static marketing preview.** The CI build strips the
  server-only routes (`app/api`, `app/admin`) and sets
  `NEXT_PUBLIC_CRM_ENABLED=false`, so forms fall back to mailto and the demo
  keeps building. (Handled in the Pages workflow — no manual steps.)

## Data model (Prisma + Postgres)
- **Client** — name, email, phone, dob (for birthdays), source, tags, marketing
  consent, GDPR fields, timestamps.
- **Consultation** — linked to Client; treatment(s) of interest, concerns,
  medical flags, preferred contact, free-text, status (new → contacted → booked
  → completed), assigned-to.
- **Interaction** — timeline entries (note, call, email, appointment) per client.
- **Appointment** — date, treatment, status (for follow-up scheduling).
- **EmailEvent** — every send logged (type, template, status) for automations &
  audit.
- **AdminUser** — staff login (hashed password, role).
- **Automation/Campaign** — scheduled + broadcast email definitions.

## Forms
- `/consultation` — premium multi-step intake (aesthetic + dental), with consent.
  Posts to `/api/consult` → saves Client + Consultation → notifies clinic +
  auto-replies to client (Resend). Falls back to mailto when CRM disabled.

## CRM dashboard (`/admin`, auth-gated)
- Login (credentials, hashed).
- Clients list + search + detail (timeline, notes, consult history).
- Consultations inbox (status pipeline).
- Email: send 1:1, view history; broadcast campaigns to segments.
- Automations: birthday emails, post-treatment follow-ups, win-back, review
  requests — run by a daily Vercel cron hitting `/api/cron/daily`.

## Email automations (daily cron)
- **Birthday** — clients with dob = today → branded birthday + offer.
- **Follow-up** — N days after an appointment → aftercare / rebook nudge.
- **Win-back** — no visit in X months → return offer.
- **Review request** — days after completed treatment.
All idempotent (logged in EmailEvent so they never double-send).

## Security & compliance
- Admin behind auth (JWT cookie, hashed passwords).
- Marketing consent + unsubscribe link on every marketing email.
- Data export/delete hooks for GDPR.

## Build phases
1. **Foundation (this phase):** schema, DB client, Resend layer, consultation
   form + capture API + auto-reply, env + docs, CI guard, admin login + clients
   dashboard skeleton.
2. Client detail timeline + manual email + status pipeline.
3. Automations (cron) + campaign broadcasts + segments.
4. Polish, GDPR tooling, analytics.

## Env (set in Vercel — see .env.example)
DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, CLINIC_NOTIFY_EMAIL,
ADMIN_JWT_SECRET, CRON_SECRET, NEXT_PUBLIC_CRM_ENABLED
