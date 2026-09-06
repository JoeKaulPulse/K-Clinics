# K-Clinics — account migration and full handover plan

Move the whole platform (website and app on Vercel, the Neon Postgres database, the
Prisma migration state, the source code on GitHub, DNS, transactional email, error
monitoring, AI, payments and every other third-party account) out of the
developer's accounts and into accounts owned by the clinic, set up by Inna. Then
hand over every asset, every credential and every document, and remove the
developer's access.

| | |
| --- | --- |
| Reference | BLD-1650 (Build board) |
| Status | Draft for Inna and Joe to work through together |
| Written | 6 September 2026 |
| People | **Inna** — clinic owner, becomes the owner of every account. **Joe** — developer, initiates every transfer and does the technical steps. |
| Source of truth | This file. Update it as steps complete (tick the boxes, add dates). |

Read section 0 first. Sections 1 to 3 are decisions and preparation. Sections 4 to
10 are the migration itself. Section 11 is what to do if something goes wrong.
The appendices are the detailed registers the plan is built on.

---

## 0. Read this first

**The principle: transfer, don't rebuild.** Everywhere a provider lets an existing
project or account change hands, we change hands. The website keeps its domain,
its database, its files and its settings; visitors and staff notice nothing.
We only create something new where a provider offers no transfer, or where the
existing account is shared with Joe's other projects.

**What stays exactly the same:** the domain `kclinics.co.uk`, the database and
all its data, the uploaded files, the encryption keys that protect health
records, the admin logins, the staff passkeys, the email addresses the app sends
from, the Stripe payments set-up, the URLs every third party calls.

**What changes:** who owns and pays for each account, which GitHub organisation
holds the code, which Vercel team runs the site, and every credential the
developer has ever seen (rotated at the end).

**Expected downtime for visitors:** none. DNS does not move (it already sits
in the clinic's Hostinger account). One step carries a small risk and is done
in the evening with a rollback ready: a database copy, and only if a transfer
is refused (section 7.5, path C).

**Three rules that never bend:**

1. **Nothing on the old side is deleted until the sign-off checklist in section 14
   passes and 30 days have gone by.** Every step copies or transfers; nothing is
   destroyed until the very end.
2. **Secrets never travel by email, WhatsApp or text.** They go through a
   password-manager share or a one-time self-destructing link
   (https://onetimesecret.com), one item per message. Wherever possible we
   grant *access* (an invite) rather than send a *password*.
3. **Inna owns; Joe operates.** Every new account is created by Inna, in her name,
   with her card and her two-step verification. Joe is invited in as a temporary
   member to do the work, and removed (or downgraded) at the end.

**Timeline:** about two weeks of calendar time, roughly three evenings of actual
work, then a 30-day quiet period before the old accounts are closed.

| When | What | Who |
| --- | --- | --- |
| Days 1–3 | Decisions (section 2) and the ownership check (Appendix A) | Inna + Joe |
| Days 3–5 | Inna creates the new homes (section 5); Joe prepares and takes backups (section 4) | both |
| Evening 1 (Day 6) | Code, website, database and monitoring transfers (sections 7.1–7.6) | Joe initiates, Inna accepts |
| Days 7–8 | Email, payments, Turnstile, Google, telephony, AI and the smaller accounts (sections 7.7–7.12); new credentials loaded (section 8) | both |
| Evening 2 (Day 9) | Only if a transfer was refused: database copy (7.5 path C) or Blob copy (Appendix B) | Joe, Inna on call |
| Days 10–12 | Verification (section 9), then revoke and rotate (section 10) | both |
| Day 30+ | Decommission the old side, update the records (section 12), final sign-off (section 14) | both |

---

## 1. Where everything lives today

Established from the repository, the live Vercel project and the live GitHub
repository on 6 September 2026. Items marked **[CONFIRM]** could not be verified
from the code and must be confirmed by Joe (or Inna) in Appendix A before the
work starts.

### 1.1 The platform

| Asset | Today | Notes |
| --- | --- | --- |
| Website + app (Next.js 16) | Vercel project `k-clinics` on Vercel team **KAUL** (`kaul-joe`, Pro plan) — Joe's team, shared with six of Joe's other projects | Node 24, London region (`lhr1`), five cron jobs in `vercel.json`, deployment protection (SSO) on preview URLs. Domains attached: `kclinics.co.uk`, `www.kclinics.co.uk`, `k-clinics.vercel.app`. |
| Database | **Neon** Postgres in **AWS eu-west-2 (London)**, reached through Neon's pooler endpoint | 165 tables; versioned Prisma migrations (`prisma/migrations`, `0_init` baseline) applied by `scripts/db-sync.mjs` on production deploys. Whether the Neon project was created *from Vercel's Storage tab* (Vercel-managed, billed through Vercel) or *at console.neon.tech* (Neon-native, Joe's Neon account) is **[CONFIRM]** — it decides which transfer path applies (section 7.5). |
| Prisma | Prisma 7 + `@prisma/adapter-pg` (direct to Neon). Prisma Accelerate/Prisma Postgres are **not** used in production. | A leftover Prisma Console (console.prisma.io) workspace or Prisma Postgres instance from an earlier set-up may still exist under Joe's account **[CONFIRM]**; it must be audited and closed (section 7.6). |
| File storage | Vercel Blob store connected to the project (currently provisioned **public-only**, see BLD-1304) | Holds media library images, kiosk photos, academy homework and portfolio files, team-chat attachments, facility documents, CVs. Copied or transferred with the project (section 7.4 and Appendix B). |
| Rate limiting | Upstash Redis via the Vercel Marketplace | Transient counters only; nothing to migrate. |
| Source code | GitHub `JoeKaulPulse/K-Clinics` — Joe's **personal** account, Joe is the only collaborator. **The repository is public.** | 378 branches, 139 open issues (the Build board mirror), GitHub Pages demo enabled. CI: Typecheck, Security checks, CodeQL, Dependabot. |
| Build-board GitHub identity | Private GitHub App `kclinics-board` owned by Joe (+ a PAT fallback) | Credentials are in Vercel (`GITHUB_APP_*`, `GITHUB_TOKEN`). |
| Automation | Claude Code environment + Routine on **Joe's Anthropic account**; the board fires it via `CLAUDE_ROUTINE_FIRE_URL/TOKEN` stored in Vercel | See decision D6. |

### 1.2 Domain, DNS and email

| Asset | Today | Notes |
| --- | --- | --- |
| Domain registration `kclinics.co.uk` | Hostinger — the clinic's account **[CONFIRM]** | Nothing changes unless the registration sits under Joe's Hostinger login. |
| DNS zone | **Hostinger DNS** (nameservers `apollo.dns-parking.com` / `athena.dns-parking.com`, checked live 6 Sep 2026) — the clinic's Hostinger account **[CONFIRM]** | Holds the Vercel records (apex `A 216.150.1.1`, `www` CNAME to a `vercel-dns-017.com` target), the Resend records on `mail.` / `send.mail.` / `reply.mail.`, the Workspace MX and the verification TXTs. Several repo docs and `lib/go-live.ts` say "Cloudflare" — that is stale; Cloudflare is not in the DNS path. |
| Bot protection | Cloudflare Turnstile widget(s) — Cloudflare account owner **[CONFIRM]** (Joe or clinic) | Cloudflare is used **only** for Turnstile. Keys live in Vercel (`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). Widgets are per account: a new Cloudflare account means new keys and a redeploy. |
| Transactional email | Resend — team owner **[CONFIRM]** | Sends from `mail.kclinics.co.uk` (DKIM TXT on `resend._domainkey.mail`, SPF + return-path on `send.mail.`); **receives** chat replies on the same `mail.` subdomain (MX → Resend Inbound); `reply.mail.` is a CNAME for Resend link tracking. Two webhooks into the app. The env values `CHAT_INBOUND_DOMAIN` and `EMAIL_REPLY_TO` must be carried over exactly (the code defaults point at `reply.mail.`, which cannot receive mail). |
| Company mailboxes | Google Workspace — the clinic's | `webmaster@kclinics.co.uk` is **Joe's identity** inside the clinic's Workspace (Super Admin) and is Owner of the Google Cloud project `KClinics`. |
| Google Cloud project `KClinics` | The clinic's Workspace organisation | OAuth client (calendar, SSO, Business Profile), Places API key, Translate key, the Workspace Directory service account. |
| Shared clinic calendar | Hostinger CalDAV (parked Google Calendar sync) | Clinic's; nothing to move. |

### 1.3 Money, monitoring, AI and the rest

| Asset | Today | Notes |
| --- | --- | --- |
| Payments | Stripe — the legal entity should be **KCLINICS SKIN & LASER LIMITED** (company 17101088); account *owner* login **[CONFIRM]** | Keys in Vercel; webhook at `/api/stripe/webhook`. |
| Error monitoring | Sentry — org owner **[CONFIRM]** | `SENTRY_DSN`. |
| AI (chat assistant, kiosk skin analysis, marketing copy) | Anthropic API key — account **[CONFIRM]** (probably Joe's) | `ANTHROPIC_API_KEY` (env or the in-app credential store). Health-adjacent data flows through it: the clinic must hold this contract. |
| Voice transcription | Deepgram **[CONFIRM]** | Optional feature. |
| SMS | Twilio (sender +44 7828 877444) **[CONFIRM]** | |
| Telephony | yay.com — the clinic's **[CONFIRM]** | Webhook token in Vercel. |
| Accounting / bank feed | Xero and TrueLayer — the clinic's data; the *developer app registrations* (client id/secret) **[CONFIRM]** | |
| Google Business Profile, Search Console, GA4, Google Ads, Meta, TikTok | Clinic's marketing accounts **[CONFIRM]** who is primary owner/admin | |
| Translation | DeepL (retired) / Google Translate key (in the `KClinics` Cloud project) | |
| GIFs in team chat | Tenor or GIPHY key **[CONFIRM]** | Trivial to recreate. |
| Alerting | `CRON_ALERT_WEBHOOK_URL` (Slack/Discord/Make) **[CONFIRM]** whose workspace | Must point at a clinic channel after handover. |
| Admin dashboard accounts | `AdminUser` rows: Inna (OWNER), Joe / `webmaster@` (OWNER or DEVELOPER), any `qa-*@kaulindustries.com` demo users | Inside the app; handled in section 10.4. |
| Documents | `docs/`, `audit/`, the branded PDFs in the repo root and `docs/*/` | Several name the developer or Joe's accounts; updated in section 12. |

---

## 2. Decisions Inna must make before we start

Each decision has a recommendation. Inna records the answer in the table in
Appendix A (column "Decision") so Joe can plan the exact route.

**D1 — GitHub: organisation or personal account?**
Create a GitHub **organisation** named `kclinics` (or similar), owned by Inna.
An organisation survives staff changes, lets Joe (or any future developer) be
an *outside collaborator* who can be removed in one click, and lets Vercel and
the build board be installed on the organisation rather than on a person.
*Recommended: organisation.*

**D2 — Keep the code public, or make it private?**
The repository is public today. Anyone can read the platform code, its open
issues and the Build board's notes about fixed vulnerabilities. For a clinic
platform holding health data, *private* is the safer default. Private costs a
little: branch protection (which stops anyone pushing straight to `main`) needs
the GitHub **Team** plan (about $4 per user per month) on a private repository,
and the free CodeQL and dependency-review scans only run on public
repositories (on a private one they need the paid Code Security add-on, or the
`npm audit` + gitleaks checks that stay free). *Recommended: private, GitHub
Team plan, one or two seats.* If Inna prefers to stay public, nothing else in
the plan changes.

**D3 — Vercel plan.**
The site runs on Pro today (cron jobs, London region, deployment protection,
usage limits). A project can only be transferred into a team with a valid
payment method. *Recommended: Vercel Pro, one seat for Inna, plus one for Joe
while he is still working on it (about $20 per seat per month).*

**D4 — Database home.**
Keep whatever model exists today. If the Neon project is *Vercel-managed* it
should travel with the Vercel project; if it is *Neon-native* it is transferred
between Neon organisations with its connection string unchanged. Only if a
transfer is refused do we copy the data to a fresh Neon project (path C in
7.5). *Recommended: keep the existing model; never copy data unless forced.*

**D5 — Joe's access after handover.**
Either (a) remove Joe from everything, or (b) keep Joe as a least-privilege
member (GitHub outside collaborator with write access behind branch
protection; Vercel Member; no owner rights anywhere) for an agreed support
period, revocable at any moment. *Recommended: (b) for 90 days, then review.*
Either way every credential Joe has seen is rotated (section 10).

**D6 — The overnight build automation (Claude Code).**
The Build board can wake an unattended Claude Code session that fixes queued
items. That runs on Joe's Anthropic subscription. Options: (a) Inna takes a
Claude subscription that includes Claude Code on the web, connects the new
GitHub organisation and Joe recreates the environment and the Routine under
her account; (b) switch it off (remove two environment variables; the board
keeps working, items just wait for a human). *Recommended: (b) at handover,
revisit (a) once the dust settles.*

**D7 — File store: fix the private-storage issue during the move?**
The Blob store is public-only, which is why kiosk photo upload and academy
portfolio upload are broken (BLD-1304). Vercel fixes a store's access tier
when it is created, and the app asks for *private* only for kiosk selfies and
portfolio photos, so the lasting fix is **two stores** (one public, one
private) plus a small code change — see Appendix B, "Decision: store
topology". If Vercel transfers the existing store with the project, keep it
and do the two-store change as a separate follow-up afterwards. If a new
store has to be created anyway, create both stores then and run the copy in
Appendix B. *Recommended: don't combine the two changes unless forced.*

**D8 — Turnstile: where should the Cloudflare account live?**
DNS itself does not move: every record already sits in the clinic's Hostinger
account (nameservers `apollo/athena.dns-parking.com`). Cloudflare is used only
for the Turnstile bot-protection widget. If the Cloudflare account holding
that widget is Joe's: (a) if it serves only K-Clinics, hand the *account* to
Inna (change its email to hers, she sets password + two-step, Joe is removed)
— nothing else changes; (b) if it is shared with Joe's other sites, Inna
creates a free clinic Cloudflare account, Joe creates a new widget there and
swaps the two Turnstile keys in Vercel with a redeploy (section 7.9). No
nameserver change, no downtime. *Recommended: (a) wherever possible.* If the
account is already the clinic's, D8 is moot.

---

## 3. The plan at a glance

```
Phase 0  Prepare and back up (Joe)              → nothing changes for anyone
Phase 1  Inna creates the new homes             → nothing changes for anyone
Phase 2  Transfers, Joe initiates / Inna accepts→ site keeps running throughout
Phase 3  Load re-issued credentials, redeploy   → one production deploy
Phase 4  Verify everything (both)               → test booking, email, payments…
Phase 5  Revoke Joe's access, rotate secrets    → staff sign in again once
Phase 6  Day 30: decommission the old side, update the records, sign off
```

The order inside Phase 2 matters and is fixed:

1. Code (GitHub) — because Vercel needs to re-link to the new repository owner.
2. Website (Vercel project, with its domains, settings and connected storage).
3. Database (only if it did not travel with the Vercel project).
4. Monitoring (Sentry), then email (Resend), then payments (Stripe).
5. Turnstile keys (no DNS change), Google, telephony, AI, SMS and the smaller accounts.
6. Any forced data copy (database path C, Blob) last, on its own evening,
   because it is the one kind of step with a real blast radius.

---

## 4. Phase 0 — Preparation and backups (Joe)

- [ ] **4.1 Ownership check.** Fill in Appendix A: for every account, who holds the
      owner login today and whether the account also serves other projects of
      Joe's. This decides "hand over the account" versus "move out of it".
- [ ] **4.2 Freeze.** Announce a change freeze on `main` from Evening 1 until
      verification passes. Merge or park every open PR. Pause the Build board's
      overnight automation for the period (set the board's
      `routine_fire_daily_cap` setting to `0`, or temporarily remove
      `CLAUDE_ROUTINE_FIRE_URL` in Vercel).
- [ ] **4.3 Full database backup, three ways.**
      1. Neon: create a branch named `pre-handover-YYYY-MM-DD` from the
         production branch (Neon console → Branches → Create branch). A branch is
         a full point-in-time copy that can be restored or promoted.
      2. App export: sign in as OWNER at `/admin`, run Settings → Data export
         (`/api/admin/export`, passkey step-up required). Store the JSON file in
         the clinic's encrypted storage, not on a laptop desktop. This file
         restores with `scripts/restore.mjs` and needs the same encryption keys.
      3. `pg_dump` of the production branch (`pg_dump "$DATABASE_URL_UNPOOLED"
         --no-owner --no-privileges -Fc -f kclinics-YYYY-MM-DD.dump`) — the
         format Neon's own import path expects if path C is ever needed.
- [ ] **4.4 File-store inventory.** List every blob (`vercel blob list` or the SDK
      `list()` loop) into a CSV with pathname, size, uploadedAt. Keep it with the
      backups; it is the checklist for Appendix B if the store has to be copied.
- [ ] **4.5 Environment export.** From a linked checkout: `vercel env pull
      .env.production.local --environment=production` and the same for
      `preview`. Also screenshot Vercel → Settings → Environment Variables (names
      + scopes only). Put the pulled files straight into the shared password
      manager vault (section 5.2) as a secure note, then delete the local copies.
      **These files are the crown jewels: they contain the health-data
      encryption keys.**
- [ ] **4.6 Record the fixed identifiers** that must be reproduced or verified
      afterwards: Vercel project id `prj_KXAOC4uXaRNsYIiA8IwYGfiMYZUE`; the
      Neon project id, branch id and endpoint host; the Blob store id (the
      hostname prefix in any stored blob URL); the Upstash database name; the
      Sentry project slug and DSN; the Resend domain ids; the Stripe webhook
      endpoint id; the GitHub App id and installation id.
- [ ] **4.7 Export the DNS zone and lower TTLs.** In Hostinger hPanel →
      Domains → `kclinics.co.uk` → DNS / Name Servers → DNS records: screenshot
      or export every record (there are Vercel, Resend, Workspace and
      verification records — Appendix E lists them), then set the TTL on the
      apex/`www` and the `mail.` / `send.mail.` / `reply.mail.` records to 300
      seconds so any change during the Resend step (7.7) propagates fast.
      Confirm Joe's access to hPanel is via Hostinger "Account sharing" (so it
      can be removed in 10.5), not via Inna's own login.
- [ ] **4.8 Code changes, as one PR** (merge before Evening 1): the items in
      Appendix C marked *before* and *at* — the hard-coded GitHub/Vercel links
      in `components/admin/dashboard/DeveloperView.tsx`, the repository
      pre-fill in `components/admin/BuildBoard.tsx`, the PR-link base in
      `lib/build-backlog.ts`, the example text in `lib/build-board.ts`, the
      default `GOOGLE_SSO_ALLOWED_DOMAINS` narrowed to `kclinics.co.uk` in
      `lib/google-sso.ts` and `.env.example`, the QA seed users in
      `prisma/seed.mjs`, the repository URLs in `docs/DEPLOY.md` and
      `docs/GO_LIVE.md`, and a note in `CLAUDE.md` pointing to this plan.
      Read the new links from env where possible so the next move is a
      variable change, not a code change.
- [ ] **4.8a Workspace admin repoint (before Joe's Super Admin is removed).**
      The dashboard's Workspace page (`/admin/workspace`) impersonates the
      super-admin named in the encrypted secret `GOOGLE_WORKSPACE_ADMIN_EMAIL`,
      which is `webmaster@kclinics.co.uk` today. Inna creates (or nominates) a
      clinic-owned super-admin (for example `admin@kclinics.co.uk`, a real
      seat, 2-Step on), Joe changes `GOOGLE_WORKSPACE_ADMIN_EMAIL` to it in
      Admin → Settings → Credentials & keys, re-checks domain-wide delegation
      (admin.google.com → Security → API controls → Domain-wide delegation)
      still lists the service account, and opens `/admin/workspace` to confirm
      users load. Only then can `webmaster@` lose Super Admin (10.5) without
      breaking the page with `invalid_grant`.
- [ ] **4.8b Joe's own accounts in the data.** Deactivate the academy test
      account that runs under Joe's address (see
      `audit/academy-portal-visual-audit.md`), and list every `AdminUser` row
      on `@kaulindustries.com` or `webmaster@` for 10.4.
- [ ] **4.9 Turn off the GitHub Pages demo** (Settings → Pages → Source: None)
      and set the repository "Website" field to `https://kclinics.co.uk`. The
      demo URL will not redirect after transfer; nothing links to it that
      matters.
- [ ] **4.10 Confirm the restore works.** Restore the `pg_dump` into a scratch
      Neon branch (or a local Postgres) and run `npx prisma migrate status`
      against it. A backup that has never been restored is not a backup.

Done when: Appendix A has no blank "Today's owner" cells, three backups exist
and one has been test-restored, the env export sits in the vault, the code PR
is merged, and TTLs are lowered.

---

## 5. Phase 1 — Inna creates the new homes

Everything below is done by Inna, on her own computer, signed in as herself.
Each block ends with "Done when". Joe is available by phone or screen-share
throughout, and should be sent the invitations named in each block.

### 5.1 The identity everything hangs off

1. Decide the email address that will own every new account. Use your own
   Workspace mailbox (`inna.k@kclinics.co.uk`). Do **not** use a personal
   Gmail, a shared inbox, or `webmaster@`.
2. Make sure two-step verification is on for that Google account
   (myaccount.google.com → Security → 2-Step Verification → On). Every service
   below will send its verification and billing email here.
3. Nominate a **backup admin** — a second real person at the clinic (or a
   second address you control). Most services let you add a second owner or
   admin; add them wherever the block below says "add backup admin".

Done when: your mailbox has 2-Step Verification on and you have chosen a
backup admin.

### 5.2 A password manager with a shared vault

1. If the clinic does not have one, create a business account at
   https://bitwarden.com (Teams) or https://1password.com (Business). Either is
   fine; Bitwarden is cheaper.
2. Create a **collection/vault called "Platform — K-Clinics"**.
3. Share it with your backup admin. Share it with Joe **read/write, temporarily**
   (he removes himself at the end; you can also remove him).
4. From now on every login, recovery code and API key created in this plan is
   saved here, never in a note on your phone.

Done when: the vault exists, Joe and the backup admin can see it.

### 5.3 GitHub organisation (decision D1)

1. Go to https://github.com and sign in. If you have no GitHub account, click
   **Sign up** and create one with `inna.k@kclinics.co.uk`. Verify the email.
2. Turn on two-factor authentication: top-right profile photo → **Settings** →
   **Password and authentication** → **Enable two-factor authentication** (use
   the authenticator app option; save the recovery codes to the vault).
3. Create the organisation: profile photo → **Your organizations** → **New
   organization** → choose **Free** (or **Team** if decision D2 says private
   with branch protection) → Organization name `kclinics` (if taken, `k-clinics`
   or `kclinics-ltd`) → Contact email `inna.k@kclinics.co.uk` → "This
   organization belongs to: A business or institution" → name of the business
   → **Next** → skip adding members for now → **Complete setup**.
4. Require two-factor for everyone: organisation page → **Settings** →
   **Authentication security** → tick **Require two-factor authentication for
   everyone in the kclinics organization** → **Save**.
5. Invite Joe temporarily: organisation page → **People** → **Invite member** →
   type `JoeKaulPulse` → role **Member** → **Send invitation**. (Member is
   enough for him to transfer the repository in; the organisation's default
   lets members create repositories. Leave "Owner" unticked.)
6. Send Joe the organisation name.

Done when: the organisation exists, 2FA is required, and Joe has accepted the
Member invitation.

### 5.4 Vercel team (decision D3)

1. Go to https://vercel.com/signup. Choose **Continue with Email** and use
   `inna.k@kclinics.co.uk` (you can use "Continue with GitHub" instead now that
   you have a GitHub account; either works). Complete the sign-up.
2. Turn on two-factor: top-right avatar → **Account Settings** →
   **Authentication** → **Two-factor authentication** → Enable. Save the recovery
   codes to the vault.
3. Create the team: top-left scope switcher (your name) → **Create Team** →
   Team name `K-Clinics` → plan **Pro** → **Continue** → enter the clinic card
   → **Confirm**. (Pro is required: a project can only be transferred into a
   team with a payment method on file.)
4. Billing details: team → **Settings** → **Billing** → add the company name
   `KCLINICS SKIN & LASER LIMITED`, address and VAT/company number as shown.
5. Invite Joe temporarily: team → **Settings** → **Members** → **Invite** →
   `joe@kaulindustries.com` → role **Member** → **Send**. (Member, not Owner.)
6. Note the team's slug (the word after `vercel.com/` when the team is
   selected) and send it to Joe.

Done when: the Pro team exists with the clinic card, and Joe has accepted the
Member invitation.

### 5.5 Neon (only if decision D4 says the database is Neon-native)

Skip this block if Joe confirms the database was created from Vercel's Storage
tab — it will travel with the Vercel project.

1. Go to https://console.neon.tech → **Sign up** with `inna.k@kclinics.co.uk`
   (or "Continue with Google" using that mailbox).
2. Create an organisation: top-left account menu → **Create organization** →
   name `K-Clinics` → choose the plan Joe names (it must be the *same or
   higher* tier than the one the project is on today, or Neon refuses the
   transfer) → add the clinic card.
3. Invite Joe temporarily: organisation → **People** → **Invite** →
   `joe@kaulindustries.com` → role **Admin** (needed to accept a project
   transfer) → **Invite**. Downgrade to Member after the transfer.
4. Send Joe the organisation name.

Done when: the organisation exists on the right plan and Joe has accepted.

### 5.6 Resend (transactional email)

Do this block only if Joe's Appendix A check says the Resend team is not
already the clinic's. If it is the clinic's, just confirm you are its Owner and
Joe is at most a Member.

1. Go to https://resend.com → **Sign up** with `inna.k@kclinics.co.uk`.
2. Settings → **Two-factor** → enable. Save recovery codes to the vault.
3. Name the team `K-Clinics` (Settings → General). Add the clinic card under
   Settings → **Billing** and choose the plan Joe names (the free tier covers
   3,000 emails a month; the clinic sends more with campaigns, so expect
   **Pro**).
4. Invite Joe temporarily: Settings → **Team** → **Invite** →
   `joe@kaulindustries.com` → **Admin** (he needs to add domains and
   webhooks). Downgrade later.

Done when: the team exists with billing, Joe is an Admin.

### 5.7 Sentry (error monitoring)

1. Go to https://sentry.io/signup → sign up with `inna.k@kclinics.co.uk`.
   When asked for a data storage location choose **EU** if offered *and* Joe
   confirms the current Sentry organisation is EU; otherwise match whatever the
   current one is (projects can only transfer between organisations in the
   same region).
2. Organisation name `K-Clinics`. Enable two-factor under **User settings →
   Security**.
3. Settings → **Members** → **Invite Member** → `joe@kaulindustries.com` → role
   **Manager** (needed to accept and configure the transferred project).

Done when: the organisation exists in the right region and Joe is a Manager.

### 5.8 Anthropic Console (AI)

The app's live chat assistant, kiosk skin analysis and marketing copy use
Claude. The clinic should hold this contract directly.

1. Go to https://console.anthropic.com → **Sign up** with
   `inna.k@kclinics.co.uk`. Verify the email.
2. Create an organisation named `K-Clinics`. Go to **Settings → Billing** →
   add the clinic card → buy an initial credit (£50 is plenty to start; the app
   caps monthly usage with `AI_MONTHLY_CAP`).
3. **Settings → Members** → invite `joe@kaulindustries.com` as **Developer**
   (can create API keys, cannot change billing).
4. Read and accept the commercial terms shown at sign-up; the data-protection
   register (section 12) records that the clinic, not the developer, is the
   contracting party.

Done when: the organisation has credit and Joe is a Developer member.

### 5.9 Twilio, Deepgram, Tenor/GIPHY, Upstash (only where Appendix A says "create new")

For each of these the pattern is the same:

1. Sign up with `inna.k@kclinics.co.uk`; enable two-factor where offered; add
   the clinic card.
2. Invite `joe@kaulindustries.com` with the lowest role that can create an API
   key (Twilio: **Developer**; Deepgram: **Member**; Tenor/GIPHY have no teams —
   Joe will tell you the exact key name to create and you paste it into the
   vault).
3. Upstash does not need an account of its own if the database is created from
   the Vercel Marketplace inside the new Vercel team — Joe does that in
   section 8.

Done when: each account named in Appendix A exists and Joe is invited.

### 5.10 Cloudflare, for Turnstile only (only if decision D8 = route (b))

1. Go to https://dash.cloudflare.com/sign-up → sign up with
   `inna.k@kclinics.co.uk` (Free plan). Enable two-factor: profile →
   **Authentication**.
2. Do **not** add the domain `kclinics.co.uk` to Cloudflare and do **not**
   change nameservers anywhere — DNS stays at Hostinger. Turnstile works
   without the domain being on Cloudflare.
3. **Manage Account → Members → Invite** → `joe@kaulindustries.com` → role
   **Administrator** (temporary; needed to create the Turnstile widget).
   Remove at the end.

Done when: the account exists, 2FA is on, Joe is invited.

### 5.11 Accepting the transfers (what will happen next)

During Evening 1 and Days 7–8 Joe will trigger transfers. For each one you will
receive an email or an in-app prompt in the new account:

- **GitHub**: an email "JoeKaulPulse wants to transfer K-Clinics to kclinics"
  with an **Accept** button (only if Joe cannot complete it himself as a
  Member). Click it.
- **Vercel**: Joe transfers directly into your team because he is a Member;
  you will see the project appear at vercel.com under the K-Clinics team.
- **Neon** (native path): an email to the organisation admins with a link to
  accept the project transfer. Accept it.
- **Sentry**: an email "Transfer project k-clinics to your organization" with
  a link. Accept it, then assign the project to a team when prompted.
- **Stripe**: an in-dashboard prompt to accept account ownership (only if the
  Stripe owner is currently Joe). Accept it.
- **Resend / Cloudflare / others**: you will not need to accept anything; Joe
  does the work with the temporary role you granted.

Keep the emails; they are the audit trail.

---

## 6. Phase 1b — Small things Inna does inside the clinic's existing accounts

These accounts are already the clinic's; the change is only about roles.

- [ ] **6.1 Google Workspace.** Admin console (admin.google.com) → **Directory →
      Users** → `webmaster@kclinics.co.uk` → **Admin roles and privileges** →
      note that it is Super Admin. *Leave it in place until section 10.5*, when
      it is downgraded. Make sure **you** are a Super Admin (Directory → Users →
      your user → Admin roles) so the clinic is never locked out. Then create
      the dedicated admin identity the dashboard will use from now on:
      **Directory → Users → Add new user** → first name `Platform`, last name
      `Admin`, email `admin@kclinics.co.uk` → Add → open the user → **Admin
      roles and privileges → Super Admin → Save**. Sign in once as that user,
      set a strong password from the vault and turn on 2-Step Verification.
      Tell Joe it exists (he repoints the dashboard to it in 4.8a).
- [ ] **6.2 Google Cloud.** console.cloud.google.com → project picker →
      **KClinics** → **IAM & Admin → IAM** → **Grant access** → New principals
      `inna.k@kclinics.co.uk` → Role **Owner** → **Save**. (Joe's `webmaster@`
      Owner role is removed in section 10.5, *after* yours is confirmed working.)
- [ ] **6.3 Stripe.** dashboard.stripe.com → **Settings → Team and security →
      Team members**: confirm which login is marked **Owner**. If it is not
      you, tell Joe (section 7.8 handles the transfer).
- [ ] **6.4 yay.com, Xero, TrueLayer, Google Business Profile, Search Console,
      GA4, Google Ads, Meta Business, TikTok.** For each: confirm the primary
      owner/admin is a clinic identity, and that no developer login has *owner*
      rights. Note anything else in Appendix A.

Done when: you are Owner on Google Cloud `KClinics`, Super Admin in Workspace,
and every marketing/finance account has a clinic-owned primary admin.

---

## 7. Phase 2 — Transfers (Joe initiates, Inna accepts)

Every subsection: **Pre-checks → Steps → Verify → Rollback.** Work them in
order. Stop at the first failed verify and roll back before continuing.

### 7.1 Code: transfer the GitHub repository to the `kclinics` organisation

Official: https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository

Pre-checks: 4.8 merged; 4.9 done (Pages off); Joe has accepted the org Member
invite; no deploy in flight.

1. GitHub → `JoeKaulPulse/K-Clinics` → **Settings** → scroll to **Danger Zone**
   → **Transfer** → type the repository name to confirm → **Select one of my
   organizations** → `kclinics` → **I understand, transfer this repository**.
   If GitHub says Joe lacks permission to create repositories in the org, Inna
   receives an email and clicks **Accept** (5.11).
2. What carries automatically: code, branches, issues (all 139), pull requests,
   repository-level Actions secrets, deploy keys, webhooks, Dependabot config,
   the CodeQL workflow. Old URLs redirect. What does **not** carry:
   environment-level secrets (none are used), GitHub Pages (already off), and
   installed GitHub Apps' access (re-installed in 7.2 and 7.3).
3. Rename for consistency: org → repository → **Settings → General** → name
   `k-clinics` (lowercase). Redirects follow renames as well.
4. If D2 = private: **Settings → General → Danger Zone → Change visibility →
   Private**. Then **Settings → Rules → Rulesets → New branch ruleset**: target
   `main`, tick **Require a pull request before merging** and **Require status
   checks to pass** (choose `typecheck` and the Security checks), **Block force
   pushes**. (On the Free plan with a private repo these rules will not
   activate — that is the D2 trade-off.)
5. CI on an organisation: the secret scan step uses `gitleaks-action`, which
   needs a licence key (`GITLEAKS_LICENSE` repository secret) when the
   repository is owned by an organisation — free for personal accounts only.
   Either obtain the free/paid key at gitleaks.io and add the secret, or
   replace the step with GitHub's built-in secret scanning (free on public
   repos; part of the Code Security add-on on private ones). CodeQL and
   dependency-review keep running free on a public repository; on a private
   one they need Code Security, otherwise remove those two jobs so CI does
   not fail on every PR. Check **Settings → Code security** → Dependabot
   alerts and security updates are on (organisation defaults can override).
6. Update the local remote for every checkout Joe uses:
   `git remote set-url origin https://github.com/kclinics/k-clinics.git`.

Verify: `git ls-remote https://github.com/kclinics/k-clinics.git main` returns
the same SHA as before; Issues tab shows the same count; Actions tab lists the
four workflows; https://github.com/JoeKaulPulse/K-Clinics redirects.

Rollback: **Settings → Danger Zone → Transfer** back to `JoeKaulPulse` (Inna,
as org owner, or Joe as org member can do it). Nothing is lost either way.

### 7.2 Build-board GitHub App and PAT

Official: https://docs.github.com/en/apps/maintaining-github-apps/transferring-ownership-of-a-github-app

1. Joe: GitHub → profile → **Settings → Developer settings → GitHub Apps →
   kclinics-board → Advanced → Transfer ownership** → new owner `kclinics` →
   confirm. Inna (org owner) accepts if prompted.
2. In the org: **Settings → GitHub Apps** → `kclinics-board` → confirm it is
   installed on `k-clinics` only, permissions Issues (read/write) + Metadata.
   If the installation did not survive, **Install App** → Only select
   repositories → `k-clinics`. Note the new **installation id** (the number at
   the end of the installation URL).
3. Generate a **new private key** (App settings → Private keys → Generate) and
   delete the old one. Record `GITHUB_APP_ID` (unchanged), the new
   `GITHUB_APP_PRIVATE_KEY` and the `GITHUB_APP_INSTALLATION_ID` for section 8.
4. Delete the fallback PAT the board used (`GITHUB_TOKEN`): Joe's Settings →
   Developer settings → Personal access tokens → the K-Clinics token → Delete.
   Also clear the encrypted copy the board may hold: Admin → Build & Issues →
   GitHub connection → **Disconnect** (this removes the `github`
   `ExternalConnection` row), then reconnect with the new `owner/name`. The
   board prefers the App when all three App variables are set; the
   `GITHUB_REPO` value becomes `kclinics/k-clinics`.

Verify (after section 8's redeploy): `/admin/api-health` shows **GitHub (board
mirror)** green; creating a P1 test item on the Build board creates an issue in
`kclinics/k-clinics` (then delete both).

Rollback: transfer the App back; the board tolerates a missing GitHub identity
(mirror disabled, board still works).

### 7.3 Website: transfer the Vercel project to the K-Clinics team

Official: https://vercel.com/docs/projects/transferring-projects ·
https://vercel.com/docs/domains/working-with-domains/transfer-your-domain ·
https://vercel.com/docs/integrations/install-an-integration/transferring-an-integration

Pre-checks: Inna's Pro team exists with a card; Joe accepted the Member
invite; 7.1 complete; no deploy in flight; `vercel env pull` backups in the
vault (4.5).

1. Vercel (KAUL team) → project `k-clinics` → **Settings → General** → scroll to
   **Transfer Project** → **Transfer** → choose the destination team
   **K-Clinics** → confirm. Vercel moves the project with its domains
   (`kclinics.co.uk`, `www`), environment variables, deployments, aliases,
   cron configuration (from `vercel.json`) and any connected storage it can
   move. **The live site is not interrupted**: the domain stays attached to the
   same deployment; the DNS records at Hostinger need no change.
2. In the **K-Clinics** team, open the project and check in this order:
   - **Settings → Domains**: `kclinics.co.uk` and `www.kclinics.co.uk` are
     listed and valid. If Vercel now shows a *different* recommended value for
     the `www` CNAME (today it is a project-specific `…vercel-dns-017.com`
     target) or the apex `A` record, update that one record in Hostinger DNS
     — otherwise leave DNS alone. The old `k-clinics-kaul-joe.vercel.app`
     alias is gone; `k-clinics.vercel.app` may need re-adding (optional).
   - **Settings → Environment Variables**: the same names exist for Production
     and Preview as in the 4.5 screenshot. Any variable that came from a
     Marketplace integration (`POSTGRES_*`, `DATABASE_URL*`, `UPSTASH_*`,
     `BLOB_READ_WRITE_TOKEN`) is still present.
   - **Storage**: which resources came across (Neon, Upstash, Blob). Anything
     missing is handled in 7.4/7.5 and section 8. (Through the API the accept
     response lists `transferredStoreIds` and `resourceTransferErrors`; the
     dashboard shows the same as connected/absent.)
   - **Settings → Deployment Protection**: re-enable **Vercel Authentication**
     for all deployments except custom domains (it was on before).
   - **Settings → Functions**: region London (`lhr1`); **Settings → General**:
     Node.js 24.x, framework Next.js.
   - **Settings → Cron Jobs**: five jobs listed (daily 08:00, dispatch every
     15 min, kiosk-cleanup 03:30, health every 5 min, api-health every 30 min).
   - **Settings → Security/Firewall**: recreate any custom WAF or rate-limit
     rules that existed on the old team (screenshot them first in 4.6; they do
     not always transfer).
   - **Settings → Notifications / Integrations**: Speed Insights and Web
     Analytics may need switching back on; historic analytics stays behind.
3. Re-link Git: **Settings → Git** → if it shows "Disconnected" or still
   `JoeKaulPulse/K-Clinics`, click **Disconnect**, then **Connect Git
   Repository → GitHub** → when prompted, **install the Vercel GitHub App on
   the `kclinics` organisation** (Inna may need to approve: GitHub org →
   Settings → GitHub Apps → Pending requests) → choose `kclinics/k-clinics` →
   Production Branch `main`.
4. Trigger a deploy by pushing an empty-change commit to `main` is **not**
   necessary; instead open the last production deployment → **Redeploy** (same
   build, new team) and watch it finish. `scripts/db-sync.mjs` will report
   "schema already in sync".

Verify: https://kclinics.co.uk loads (check the footer commit hash via
`/api/health` → `commit`); `/admin` login works; a PR opened on the new repo
gets a Preview deployment comment; **Deployments** shows the redeploy as
Current.

Rollback: transfer the project back to KAUL (same menu). Domains and env vars
travel back. If the Git link is the only problem, the previous deployment keeps
serving; nothing is down while it is fixed.

### 7.4 File store (Vercel Blob)

- **If the Blob store came across** with the project (visible under Storage in
  the new team and `BLOB_READ_WRITE_TOKEN` unchanged): nothing to do now.
  Schedule BLD-1304 (private store) as a follow-up after handover.
- **If it did not**: create a new store in the K-Clinics team
  (**Storage → Create Database → Blob** → name `kclinics-media` → **Private**
  access → region London) and run the copy + URL rewrite in **Appendix B**.
  Until the copy is done the old store keeps serving existing URLs (do not
  delete it), and uploads go to the new store once section 8 sets the new token.

Verify: upload an image in **Admin → Media** and it appears; open an existing
academy homework file; kiosk upload once the store is private.

Rollback: point `BLOB_READ_WRITE_TOKEN` back at the old store.

### 7.5 Database (Neon)

Official: https://neon.com/docs/manage/orgs-project-transfer ·
https://neon.com/docs/guides/vercel-managed-integration ·
https://neon.com/docs/guides/neon-managed-vercel-integration

First determine the path (Joe, five minutes):

- Open Vercel → old team → **Storage**. If the Postgres resource is listed
  there as a Marketplace/Neon resource → **Vercel-managed** → path A.
- Otherwise open https://console.neon.tech, find the project holding the
  `*.eu-west-2.aws.neon.tech` endpoint. If its organisation is named like
  "Vercel: KAUL" → still Vercel-managed → path A. If it is under Joe's personal
  account or a normal organisation → **Neon-native** → path B.

**Path A — Vercel-managed.** The resource should have transferred in 7.3.
Confirm in the new team: Storage shows the Neon resource, its **Settings**
show billing on the K-Clinics team, and **Open in Neon** signs Inna into the
Neon console for it. Connection strings are unchanged; nothing to deploy.
Inna: from Vercel → Storage → the Neon resource → **Open in Neon**, then in
Neon set up a second admin (your backup admin) so the console is never
single-person.
If the resource did **not** transfer (`resourceTransferErrors`), Vercel's
Marketplace resource **Settings → Transfer** on the old team can move it to
the K-Clinics team; if that is refused too, go to path C.

**Path B — Neon-native.** Neon transfers projects between organisations with
credentials and connection strings **unchanged** (nothing to redeploy). Neon
console → the project → **Settings → General → Transfer project** → choose the
destination organisation `K-Clinics` (Joe must be an Admin there, hence 5.5).
The destination plan must be the same tier or higher. Neon lists the project
under the new organisation within a minute. Note: Neon does not allow
Vercel-managed organisations as source or destination, which is why the two
paths are separate.

**Path C — copy to a fresh Neon project (only if A and B both refuse).** This
is the one path with a write freeze. Do it in the evening:

1. In the K-Clinics Neon organisation create project `kclinics` in region
   **AWS eu-west-2 (London)** (the nightly region guard `DB_APPROVED_REGIONS`
   and the data-protection register both require London), Postgres 17 (match
   the current major version from `SELECT version()`).
2. Enable the extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`.
3. Put the app in maintenance for writes: in Vercel set `DB_SYNC_NONFATAL`
   aside and pause the crons (Settings → Cron Jobs → disable), then announce a
   15-minute booking pause to staff.
4. Fresh dump from the *unpooled* URL, then restore into the new project:
   `pg_dump "$OLD_DATABASE_URL_UNPOOLED" -Fc --no-owner --no-privileges -f
   final.dump` and `pg_restore --no-owner --no-privileges -d
   "$NEW_DATABASE_URL_UNPOOLED" final.dump`. The `_prisma_migrations` table
   comes with the dump, so `prisma migrate status` shows every migration
   applied and `scripts/db-sync.mjs` will find nothing to do.
5. In Vercel (new team) replace `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
   `POSTGRES_PRISMA_URL` (pooler host, keep `?pgbouncer=true` if present) and
   `POSTGRES_URL_NON_POOLING` for Production and Preview with the new project's
   strings → **Redeploy**. Re-enable the crons.
6. Verify with the read-only role: row counts of `Client`, `Booking`,
   `AdminUser`, `ManagedSecret`, `MediaAsset` match the old database;
   `/api/health` (with `CRON_SECRET`) returns `database: connected` and every
   probe `ok`.
7. Keep the old project untouched for 30 days.

Verify (all paths): `/api/health` green; `/admin/api-health` **Database**
green; the nightly cron does not raise a region alert; Inna can open the Neon
console for the project.

Rollback: path A/B — transfer back. Path C — put the old connection strings
back in Vercel and redeploy (writes made in between are lost, which is why
step 3 freezes writes).

### 7.6 Prisma Console clean-up (Joe)

1. Sign in at https://console.prisma.io with the account used in 2026 for
   Prisma Postgres/Accelerate. List every workspace, project and database.
2. For anything named for K-Clinics: confirm the live app does not use it
   (`PRISMA_DATABASE_URL` and `ACCELERATE_URL` are absent in Vercel — see
   `lib/db.ts`), take a final export if it holds any data, then either
   **transfer the project** to a workspace Inna creates (Prisma's Management
   API and Console support project transfer) or **delete it** (Project →
   Settings → Delete). Recommended: delete; the runtime does not depend on it.
3. Remove any Prisma-issued env vars that are still present in Vercel but
   unused (`ACCELERATE_URL`, `PRISMA_DATABASE_URL`) so nobody is misled later.

Verify: `lib/platform-status.ts` shows the direct/pooled Neon path, no Prisma
Accelerate; no billing line from Prisma remains on Joe's card.

### 7.7 Email: Resend

Official: https://resend.com/changelog/domain-claim ·
https://resend.com/docs/dashboard/domains/manage-domains

Choose the route from Appendix A:

**Route A — hand over the existing team** (Resend team serves only K-Clinics).
Resend → Settings → Team → invite `inna.k@kclinics.co.uk` as **Owner/Admin**;
Inna accepts, changes Billing to the clinic card; Inna then removes Joe (or
downgrades to Member per D5). Nothing changes for the app. Then rotate the
API key and both webhook secrets in section 10.

**Route B — move the domains to Inna's new team** (team is shared or is Joe's
personal identity).

1. New team (Inna's, Joe as Admin): **Domains → Add Domain** →
   `mail.kclinics.co.uk`. Resend detects it is verified elsewhere and offers
   **Domain Claim**: add the TXT record it shows in **Hostinger DNS** →
   **Verify ownership**. Resend releases the domain from the old team and
   shows the sending records (DKIM TXT on `resend._domainkey.mail`, SPF TXT
   and return-path MX on `send.mail.`). If Resend asks you to contact support
   because the old team sent recently, do that first — support releases it
   within a working day; plan for it.
2. Add the records exactly as shown. If the DKIM value differs from the old
   one, replace it in the same record (only one `resend._domainkey.mail` TXT
   can exist), verify, and re-send a test within minutes so the gap is short.
3. Enable **Receiving** (inbound) on the same `mail.kclinics.co.uk` domain —
   today's MX on `mail.` points at Resend Inbound, so keep that MX exactly as
   it is — and point the inbound webhook at
   `https://kclinics.co.uk/api/webhooks/chat-inbound`. Leave the
   `reply.mail.` CNAME (Resend link tracking) in place; re-enable open/click
   tracking on the domain so the same CNAME target stays valid, or update it
   to the value the new team shows.
4. **Webhooks → Add Endpoint** → `https://kclinics.co.uk/api/webhooks/resend`
   → events `email.delivered`, `email.opened`, `email.clicked`,
   `email.bounced`, `email.complained` → copy the signing secret.
5. **API Keys → Create** → name `vercel-production` → Sending access → copy.
6. Load `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_INBOUND_SECRET` in
   section 8. Until the redeploy the app keeps sending through the old key
   (still valid while the old team holds the domain), so there is no gap if
   steps 1–5 and the redeploy happen within the same hour.
7. Old team: delete the API key after the redeploy; delete the domains only
   after 30 days (section 12).

Verify: `/admin/api-health` **Email (Resend)** green; book a test appointment
and receive the confirmation; reply to it and see the reply thread in Admin →
Chat; https://www.mail-tester.com score unchanged (10/10 previously).

Rollback: put the old `RESEND_API_KEY` back and redeploy; if a domain claim is
half-done, re-add the old DKIM record.

### 7.8 Payments: Stripe

Official: https://support.stripe.com/questions/change-the-owner-of-a-stripe-account

The Stripe account holds the clinic's money and should already be registered
to KCLINICS SKIN & LASER LIMITED. The only question is which login is the
**Owner**.

- If Inna is Owner: nothing to transfer. Joe's team login is downgraded to
  **Developer** now and removed in section 10.
- If Joe is Owner: Joe → **Settings → Team and security → Team members** →
  Inna's row → if she is not yet **Super Administrator** set that role and
  Save → overflow menu (⋯) → **Transfer ownership to this user** → confirm.
  Inna gets a prompt to accept.
- Keys: because the *account* does not change, `STRIPE_SECRET_KEY`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET` keep
  working. They are rotated in section 10.2 (Stripe → Developers → API keys →
  **Roll key**, with a grace period; Webhooks → endpoint → **Roll secret**).
- Check **Settings → Business details** shows the clinic's legal name and bank
  account, and that no personal card of Joe's is the billing method.

Verify: `/admin/api-health` **Payments (Stripe)** green; a £0 SetupIntent
through the booking flow succeeds; Stripe → Developers → Webhooks shows recent
2xx deliveries.

### 7.9 Turnstile (Cloudflare) and the DNS zone (Hostinger) — decision D8

DNS does not move. All records for `kclinics.co.uk` live in Hostinger DNS
(nameservers `apollo.dns-parking.com` / `athena.dns-parking.com`), and the
site is served directly by Vercel. The only Cloudflare dependency is the
Turnstile bot-protection widget, whose two keys sit in Vercel.

**Route (a) — hand over the Cloudflare account** (it serves only K-Clinics):
Joe → dash.cloudflare.com → profile → **Change email** → enter
`inna.k@kclinics.co.uk` → Inna confirms from her mailbox → Inna sets a new
password and **enables 2FA** → Inna adds her backup admin under **Manage
Account → Members** → Joe's own identity is now gone from the account. The
widget and both keys are untouched. No redeploy, no downtime.

**Route (b) — new widget in Inna's Cloudflare account (5.10):**

1. New account (Joe as temporary Administrator) → **Turnstile → Add widget**
   → widget name `kclinics.co.uk` → hostnames `kclinics.co.uk` and
   `www.kclinics.co.uk` → widget mode **Managed** → **Create** → copy the
   **Site key** and the **Secret key** into the vault.
2. In Vercel (K-Clinics team) replace `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and
   `TURNSTILE_SECRET_KEY` for Production and Preview, then **Redeploy** (the
   site key is baked into the build). Do both keys in the same change: in
   production the login CAPTCHA **fails closed**, so a mismatched pair means
   every login attempt after the third failure is rejected until the next
   redeploy. Do not leave it overnight.
3. Old account: delete the old widget after verification (12.4).

**DNS zone (both routes):** nothing changes. Joe's access to Hostinger must be
through Hostinger "Account sharing" on the clinic's account (4.7); it is
removed in 10.5. Do not add `kclinics.co.uk` to Cloudflare and do not change
nameservers as part of this plan.

Verify: login page shows the Turnstile widget; after three wrong passwords the
CAPTCHA appears and a correct password then succeeds; `/admin/go-live` DNS
group unchanged; `dig NS kclinics.co.uk +short` still returns the two
`dns-parking.com` servers.

Rollback: old Turnstile keys back in Vercel, redeploy. Nothing else was
touched.

### 7.10 Google (Workspace, Cloud, Business Profile, Search Console, Ads, GA4)

1. Google Cloud project `KClinics`: after 6.2, Joe signs in as `webmaster@`
   and confirms Inna's Owner role works (she can open **APIs & Services →
   Credentials**). The OAuth client id/secret, Places key, Translate key and
   the Workspace service account are project resources and **do not change**.
   Add Inna as **Billing account administrator** if a billing account is
   attached (Billing → Account management).
2. OAuth consent screen: **APIs & Services → OAuth consent screen** → change
   the support email and developer contact to a clinic address.
3. Google Business Profile: business.google.com → **Business Profile settings →
   People and access** → Inna is **Primary owner**; any developer login is
   **Manager** at most.
4. Search Console: property owners → Inna is a verified owner; the HTML-tag
   token (`GOOGLE_SITE_VERIFICATION`) stays valid whoever owns it.
5. GA4 / Google Ads / Meta Business / TikTok: Inna is Administrator/Primary;
   the app's stored OAuth tokens (`ExternalConnection`) keep working because
   the OAuth client is unchanged. Nothing to redeploy.

Verify: `/admin/api-health` **Google rating**, **Google Business Profile**,
**Google Ads**, **GA4** stay green.

### 7.11 Telephony, SMS, AI, transcription, GIFs

- **yay.com** (clinic's): confirm the clinic login is the account owner; in
  **Web Hooks** the Call Ended / Voicemail hooks point at
  `https://kclinics.co.uk/api/integrations/yay` with the token in each hook's
  **Auth Token** field (the route accepts it as a bearer/`X-Auth-Token`
  header or in the body, and rejects `?token=` in the URL). The token is
  rotated in section 10.2 (paste the new value in both hooks). Click-to-dial
  depends on yay's "Allowed IP ranges" matching Vercel's egress addresses,
  which are dynamic; test it after cutover and either widen the allow-list or
  record that click-to-dial is off.
- **Twilio**: if the account is Joe's and serves only K-Clinics, change the
  account owner (Console → **Settings → Account settings → Account details &
  security → Change account owner**; for accounts not under a Twilio
  Organization this is a Support request — allow a few days). If shared,
  create the clinic's own account (5.9), buy/port the sender number (porting a
  UK number between Twilio accounts is a support ticket; alternatively buy a new
  number and update `TWILIO_FROM`), and load `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` in section 8.
- **Anthropic**: in Inna's Console (5.8) Joe creates an API key named
  `vercel-production`; load `ANTHROPIC_API_KEY` in section 8 (or in Admin →
  Credentials & keys, which stores it encrypted in the database). After the
  redeploy, delete the key in Joe's organisation.
- **Deepgram**: same pattern (`DEEPGRAM_API_KEY`, stored in Admin →
  Credentials & keys).
- **Tenor/GIPHY**: same pattern (`TENOR_API_KEY` / `GIPHY_API_KEY`).

Verify: `/admin/api-health` **SMS**, **AI (Anthropic)**, **Voice
transcription**, **Telephony** green; a kiosk session analyses a test photo;
the live-chat assistant answers.

### 7.12 Xero, TrueLayer, IndexNow, web push, misc

- **Xero / TrueLayer developer apps**: if the app registrations live under
  Joe's developer login, invite Inna as a collaborator/owner on the app
  (developer.xero.com → app → **Manage** → add user; console.truelayer.com →
  team → invite) and remove Joe later. Client id/secret unchanged; the stored
  OAuth connections keep working.
- **IndexNow**, **VAPID** (web push), **KIOSK_IP_SALT**, **INDEXNOW_KEY**: these
  are plain values, not accounts. They travel inside the Vercel env vars. Do
  not rotate VAPID (it would silently disconnect every staff device's push
  notifications) unless section 10 decides to.
- **Hostinger**: if the registration or the mailbox plan is under Joe's login,
  use Hostinger's "move a domain/service between Hostinger accounts" support
  flow (https://www.hostinger.com/support/4068055-how-to-move-a-domain-between-hostinger-accounts/)
  to Inna's account; otherwise just remove Joe's account-sharing access.

### 7.13 Noticed while checking the live DNS (out of scope, worth fixing)

- The apex SPF record still says `v=spf1 include:_spf.mail.hostinger.com
  ~all` and there is no `google._domainkey` DKIM record, although the apex MX
  already points at `smtp.google.com`. Mail sent *from Gmail* as
  `@kclinics.co.uk` is therefore not fully authenticated. Finish Phase 4 of
  `docs/GOOGLE_WORKSPACE_MIGRATION.md` (replace the apex SPF with
  `v=spf1 include:_spf.google.com ~all`, add Google's DKIM) — a five-minute
  job in Hostinger DNS that Inna can do with Joe on a call. The Resend
  records on `mail.` / `send.mail.` are separate and unaffected.
- `/indexnow-key.txt` returns 404: `INDEXNOW_KEY` is unset. Optional.
- No search-engine verification meta tags are served; Search Console is
  verified by the apex `google-site-verification` TXT instead. Keep that
  record.

---

## 8. Phase 3 — Load the re-issued credentials and redeploy (Joe)

Only the **account-bound** variables change. Everything **data-bound** (the
health-data encryption keys, VAPID keys, salts) is left byte-for-byte as it
was. The full catalogue with categories is Appendix D.

1. In Vercel (K-Clinics team) → project → **Settings → Environment
   Variables**, update **Production** and **Preview** together:

   | Variable | New value from | Only if |
   | --- | --- | --- |
   | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_INBOUND_SECRET` | 7.7 route B | Resend moved |
   | `ANTHROPIC_API_KEY` | 7.11 | always (clinic contract) |
   | `DEEPGRAM_API_KEY`, `TENOR_API_KEY` / `GIPHY_API_KEY` | 7.11 | if new accounts |
   | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | 7.11 | if new account |
   | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 7.9 route (b) | if new Cloudflare account |
   | `BLOB_READ_WRITE_TOKEN` | 7.4 | if new store |
   | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | new Marketplace resource: Storage → Create → Upstash Redis → connect to project | if Upstash did not transfer |
   | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Sentry → project → Client Keys | only if a new Sentry project was created instead of transferred |
   | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_REPO` | 7.2 | always |
   | `GITHUB_TOKEN` | delete | always |
   | `CLAUDE_ROUTINE_FIRE_URL`, `CLAUDE_ROUTINE_FIRE_TOKEN` | delete (D6-b) or Inna's new Routine (D6-a) | always |
   | `CRON_ALERT_WEBHOOK_URL` | a clinic Slack/Discord/Make webhook | always |
   | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` | 7.5 path C | only path C |
   | `ACCELERATE_URL`, `PRISMA_DATABASE_URL` | delete if present | 7.6 |

   Variables the owner can hold in **Admin → Settings → Credentials & keys**
   instead (encrypted in the database): Resend, Twilio, Anthropic, Deepgram,
   Google keys, Xero/TrueLayer client secrets, the Workspace service account.
   Prefer that route for anything Inna will rotate herself in future; the env
   var is only a fallback.
2. **Deployments → Redeploy** the current production deployment (untick "use
   existing build cache"). The `NEXT_PUBLIC_*` values are baked in at build
   time, so a redeploy is mandatory after changing Turnstile or Stripe
   publishable keys.
3. Run `node scripts/healthcheck.mjs` with `CRON_SECRET` set, then open
   `/admin/api-health` and wait for every light.

Done when: healthcheck prints no red lines and `/admin/api-health` has no red
light that was green before the migration.

---

## 9. Phase 4 — Verification matrix (both)

Run every row; tick with the date. Rows marked **I** are for Inna to do on her
own devices so the handover is proven from her side.

| # | Check | How | Pass |
| --- | --- | --- | --- |
| 1 | Site up, right commit | `curl -s https://kclinics.co.uk/api/health` → `ok:true`; commit hash matches the latest deployment | [ ] |
| 2 | Healthcheck script | `node scripts/healthcheck.mjs` (with `CRON_SECRET`) all green | [ ] |
| 3 | API health page | `/admin/api-health` — no new red lights | [ ] |
| 4 | Go-live tracker | `/admin/go-live` — DNS group green, Stripe LIVE, Resend ready | [ ] |
| 5 | **I** Admin login + passkey | Inna signs in at `/admin/login` with password, then with her passkey (Face ID / Touch ID) | [ ] |
| 6 | **I** Client portal | Inna logs into a test client account at `/account` | [ ] |
| 7 | Booking end-to-end | Book a test slot at `/book` with a Stripe test card (or a £0 setup) → appears in Admin → Bookings; confirmation email received | [ ] |
| 8 | Email reply threads | Reply to the confirmation email → appears in Admin → Chat/Inbox via `reply.mail.` | [ ] |
| 9 | Stripe webhook | Stripe → Developers → Webhooks → endpoint → **Send test event** → 2xx | [ ] |
| 10 | Cron heartbeats | `/admin/api-health` **Scheduled jobs** shows fresh heartbeats for daily, dispatch, kiosk-cleanup (wait for the next slot) | [ ] |
| 11 | Sentry | Trigger the test error (Admin → Status → "Send test event", or `/api/debug/sentry` if present) → event visible in Inna's Sentry | [ ] |
| 12 | Push notifications | A staff device receives a test push (Admin → Notifications → Test) | [ ] |
| 13 | File upload | Admin → Media → upload an image → renders on the site | [ ] |
| 14 | Kiosk | Full kiosk session with a photo (once the store is private) or the graceful 503 message if not yet | [ ] |
| 15 | AI chat | Public live chat → the assistant answers | [ ] |
| 16 | SMS | Send a test reminder to a staff mobile (Admin → Clients → test client) | [ ] |
| 17 | Telephony | Make a test call to the clinic line → Call log entry appears | [ ] |
| 18 | Preview deploys | Open a PR in `kclinics/k-clinics` → Vercel preview comment; preview URL requires Vercel login (deployment protection) | [ ] |
| 19 | CI | The PR runs Typecheck + Security checks (+ CodeQL if public) | [ ] |
| 20 | Build board ↔ GitHub | A P1 test item mirrors to a GitHub issue; delete both | [ ] |
| 21 | Visual QA | `node scripts/visual-qa.mjs` from a full-network session: no console errors, screenshots reviewed | [ ] |
| 22 | Region guard | Next morning's daily cron raised no "database region" alert | [ ] |
| 23 | **I** Billing emails | Inna received the first invoice/receipt emails from Vercel, Neon (if native), Resend, Sentry, Anthropic | [ ] |
| 24 | **I** Console access | Inna can open, on her own: Vercel project, Neon console, Sentry project, Resend domains, Stripe dashboard, Hostinger DNS records, Cloudflare Turnstile, GitHub org | [ ] |

Done when: every row is ticked, including all **I** rows.

---

## 10. Phase 5 — Revoke access and rotate secrets

Do this only after section 9 passes. Order matters: **rotate first, then
remove Joe**, so that if a rotation breaks something Joe can still fix it.

### 10.1 What is never rotated (and why)

- `HEALTH_ENCRYPTION_KEY`, `HEALTH_HMAC_KEY`, `HEALTH_ENCRYPTION_KEYS_OLD`,
  `HEALTH_HMAC_KEYS_OLD` protect every health record, every stored
  credential in Admin → Credentials & keys, staff two-factor secrets and
  OAuth tokens. They *can* be rotated safely — but only through the keyring
  procedure in `docs/KEY_ROTATION.md` (old key into `*_KEYS_OLD`, new key
  active, redeploy, the nightly cron re-encrypts, remove the old key only when
  Admin → Integrations → "Clinical data encryption" shows 0 remaining).
  Because Joe has seen these values, **do rotate them this way** as the last
  rotation (10.3), never by simply replacing the value.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: rotating silently disconnects every
  staff push subscription. Leave them unless Inna wants every device to
  re-subscribe.
- `KIOSK_IP_SALT`: rotating resets the kiosk anti-abuse counters; harmless, but
  pointless.

### 10.2 Rotation table (Joe, with Inna watching)

Generate new values with `openssl rand -base64 32` (or `-hex 32` where the
current value is hex). Change the value in Vercel, redeploy, then tick.

| Secret | Where else it must be updated | Side effect | Done |
| --- | --- | --- | --- |
| `ADMIN_JWT_SECRET`, `CLIENT_JWT_SECRET`, `ACADEMY_JWT_SECRET` | nowhere | every staff member, client and student is signed out once; passkeys, passwords and two-factor keep working | [ ] |
| `CRON_SECRET` | Claude/QA tooling if it uses it; any external uptime monitor calling `/api/health` with the bearer | none for users | [ ] |
| `BOARD_QUEUE_TOKEN` (= `QA_TOKEN`) | the Claude Code environment, if retained (D6-a) | none | [ ] |
| `GOOGLE_REVIEW_IMPORT_TOKEN`, `MIGRATE_TOKEN`, `MW_BLOCK_SECRET` | nowhere | none | [ ] |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → **Roll key** (keep the old valid for 1 hour) | none | [ ] |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → endpoint → **Roll secret** | none (Stripe overlaps old/new) | [ ] |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_INBOUND_SECRET` | Resend → API keys / Webhooks (new endpoint or rotate) | none | [ ] |
| `YAY_WEBHOOK_SECRET` | yay.com → Web Hooks → both hooks' URL `?token=` and Auth Token field | calls logged during the seconds in between are missed | [ ] |
| `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `TWILIO_AUTH_TOKEN`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_TRANSLATE_KEY`, `TENOR_API_KEY`/`GIPHY_API_KEY` | regenerate in each provider console; delete the old key there | none | [ ] |
| `GOOGLE_CLIENT_SECRET`, `XERO_CLIENT_SECRET`, `TRUELAYER_CLIENT_SECRET` | regenerate in the provider's app settings (Google: add a new secret, then delete the old after the redeploy) | existing stored OAuth connections keep working; staff who *connect* again use the new secret | [ ] |
| `GOOGLE_WORKSPACE_SA_KEY` (Admin → Credentials & keys) | Google Cloud → service account → Keys → add new JSON key, paste, delete old key; `GOOGLE_WORKSPACE_ADMIN_EMAIL` already repointed in 4.8a | none | [ ] |
| `GITHUB_APP_PRIVATE_KEY` | done in 7.2 | none | [ ] |
| `HOSTINGER_CALDAV_PASS` | Hostinger → mailbox → new app password | none | [ ] |
| `INDEXNOW_KEY` | none (served automatically at `/indexnow-key.txt`) | none | [ ] |
| Neon database password (path A/B kept the old strings) | Neon console → Roles → reset password → update the four `DATABASE_URL*`/`POSTGRES_*` vars → redeploy | a few seconds of failed queries during the redeploy; do it late evening | [ ] |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → store → Settings → **Regenerate token** (or new store token) | none | [ ] |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console → Reset token | none | [ ] |
| `SENTRY_DSN` | Sentry → project → Client Keys → create new, disable old | none | [ ] |

### 10.3 Health keyring rotation (last, and only via the runbook)

1. `openssl rand -hex 32` for the new AES key (and a second one for the HMAC
   key **only if `HEALTH_HMAC_KEY` is set today** — if it is unset, the AES
   ring doubles as the HMAC ring and you must not introduce a separate HMAC
   key now; if you ever do, put the AES key's value into
   `HEALTH_HMAC_KEYS_OLD` at the same moment).
2. Vercel: set `HEALTH_ENCRYPTION_KEYS_OLD` = current `HEALTH_ENCRYPTION_KEY`
   (comma-append if a value exists) and, where it exists,
   `HEALTH_HMAC_KEYS_OLD` = current `HEALTH_HMAC_KEY`; then set the new active
   key(s). Redeploy.
3. Confirm health records, Admin → Credentials & keys and staff two-factor
   still work (old data decrypts through the ring).
4. Set `HEALTH_KEY_REENCRYPT=true` temporarily, or wait for the nightly cron;
   watch Admin → Integrations → **Clinical data encryption** until **0
   remaining** (a few nights for a large database).
5. Remove the old values from both `*_KEYS_OLD` variables, redeploy, and set
   `HEALTH_KEY_REENCRYPT` back to `false`.
6. **Back the new keys up outside Vercel** (the vault, plus an offline copy
   Inna keeps): a lost key is unrecoverable; `docs/KEY_ROTATION.md`.

### 10.4 Accounts inside the app

- Admin → **Staff**: Inna is **OWNER** (she must be, or the export/passkey
  step-up will not be available to her); set Joe's and `webmaster@`'s staff
  records to **DEVELOPER** (or Inactive per D5); delete any
  `qa-*@kaulindustries.com` demo users; review every OWNER/ADMIN row.
- Admin → **Security**: confirm two-factor is required for OWNER/ADMIN roles;
  check the passkey list on Inna's account.
- Admin → **Settings → Credentials & keys**: every key shows source **app** or
  **env** and a recent "updated by" that is not Joe.
- `GOOGLE_SSO_ALLOWED_DOMAINS` = `kclinics.co.uk` (no `kaulindustries.com`).

### 10.5 Remove or downgrade Joe (Inna does this, from her own logins)

| Where | Action (D5-a remove / D5-b downgrade) |
| --- | --- |
| GitHub org | People → Joe → Remove, **or** convert to **Outside collaborator** with *Write* on `k-clinics` only |
| Vercel team | Settings → Members → Joe → Remove, **or** keep **Member** |
| Neon org | People → Joe → Remove or Member |
| Resend, Sentry, Anthropic, Twilio, Deepgram, Cloudflare | Team/Members → Joe → Remove or lowest role |
| Stripe | Team → Joe → Remove (or Developer, view-only) |
| Google Workspace | Only after 4.8a: Directory → Users → `webmaster@` → remove **Super Admin**; keep the mailbox only if D5-b, as a normal user; otherwise **Suspend** (keeps the mail) |
| Google Cloud `KClinics` | IAM → `webmaster@` → remove **Owner** (after 7.10 confirms Inna's works) |
| Xero / TrueLayer / GBP / Search Console / GA4 / Ads | remove Joe's logins or set to view-only |
| Hostinger | Account sharing → remove; delete any app passwords issued to Joe |
| Password manager | remove Joe from the "Platform — K-Clinics" collection; Joe confirms he has deleted the local `.env*` pulls |
| Claude Code (Joe's account) | Joe deletes the K-Clinics environment variables (`BASE_URL`, `QA_TOKEN`, `BOARD_QUEUE_TOKEN`, `QA_ADMIN_*`, `QA_ACADEMY_*`, `DATABASE_URL`) and the Routine; the read-only DB role used there is dropped in Neon |

Done when: every rotated secret is ticked, the keyring shows 0 remaining, and
Joe can no longer sign in anywhere with owner rights.

---

## 11. If something goes wrong (rollback summary)

| Symptom | Do this | Data at risk |
| --- | --- | --- |
| Site down right after the Vercel transfer | Transfer the project back to KAUL (Settings → General → Transfer) | none |
| Site up but no new deploys | Fix the Git link (7.3 step 3); the current deployment keeps serving | none |
| Emails stop or land in spam | Put the old `RESEND_API_KEY` back and redeploy; re-add the old DKIM record; check SPF has exactly one record on `mail.` | none |
| Payments fail | Confirm the three Stripe vars match the account's live keys; check the webhook endpoint URL and secret; Stripe retries webhooks for days | reconcile later |
| Login CAPTCHA broken | Old Turnstile keys back in Vercel, redeploy | none |
| A DNS record was changed by mistake | Restore it from the 4.7 export in Hostinger hPanel (TTLs are 300 s) | none |
| Database unreachable after path C | Old connection strings back, redeploy | writes since the freeze |
| Health records will not open | Restore the exact previous `HEALTH_*` values (and `*_KEYS_OLD`) from the vault; never "fix" by generating new keys | none if the vault copy is intact |
| Staff all signed out | Expected after JWT rotation; not a fault | none |

Anything not in this table: stop, do not improvise, and restore the last
known-good state from the backups in section 4.3 with Joe on a call.

---

## 12. Phase 6 — Day 30: decommission, records and documents

- [ ] **12.1 Old Vercel team (KAUL):** delete the leftover `k-clinics` Blob
      store, Upstash and Neon resources *only if* new ones replaced them;
      remove the `k-clinics` project if it was recreated rather than
      transferred. Cancel nothing that other projects use.
- [ ] **12.2 Old Neon project / Prisma Console:** delete after confirming 30
      days of clean operation and that the backups in 4.3 have been re-verified
      against the *new* database.
- [ ] **12.3 Old Resend team:** delete the domains and remaining keys; close
      the team if it was K-Clinics-only.
- [ ] **12.4 Old Turnstile widget** (D8 route b): delete the widget in the old
      Cloudflare account; if that account held nothing else for the clinic,
      Joe closes or keeps it as he likes.
- [ ] **12.5 Old Sentry / Anthropic / Twilio / Deepgram** projects or keys:
      delete; cancel any subscription still on Joe's card.
- [ ] **12.6 Joe's card:** Joe reviews his statements for any remaining charge
      from Vercel, Neon, Resend, Sentry, Anthropic, Twilio, Upstash, Prisma,
      Cloudflare, GitHub and cancels it; Inna confirms the same services now
      bill the clinic.
- [ ] **12.7 Documents in the repository** (one PR, cite this plan's ref):
      `docs/DEPLOY.md`, `docs/GO_LIVE.md`, `README.md` (repository URLs, Pages
      table row), `CLAUDE.md` (session provisioning, `BASE_URL`/`QA_TOKEN`
      ownership), `.env.example` (`GOOGLE_SSO_ALLOWED_DOMAINS`), `lib/go-live.ts`
      (the "Domain & DNS (Cloudflare)" group heading and its links should say
      Hostinger DNS; Cloudflare is Turnstile only),
      `docs/GOOGLE_WORKSPACE_MIGRATION.md` §1 (DNS is at Hostinger, not
      Cloudflare), `docs/data-protection/processors.md`
      (Vercel, Neon, Resend, Sentry, Anthropic rows: contracting party is the
      clinic; date accepted; region), `docs/data-protection/breach-response.md`
      (Technical responder now named), `docs/data-protection/README.md`
      (hosting facts), the three PDF generators
      (`scripts/build-access-request-guide.mjs`,
      `scripts/build-workspace-guide.mjs`, `scripts/build-golive-guide.mjs`) —
      regenerate the PDFs so nothing tells Inna to grant `webmaster@`
      anything; `docs/WORKSPACE_ADMIN_SDK_SETUP.md` rewritten for the
      clinic-owned admin; the processors register and ROPA corrected where
      they say applicant CVs are uploaded to Blob (they are pasted links, see
      Appendix B); `scripts/migrate-wp/README.md` `--scope`. Appendix C lists
      every line.
- [ ] **12.8 Handover pack** stored in the vault and given to Inna: Appendix A
      completed with dates; the env export (current values, post-rotation); the
      offline copy of the health keys; the backup files' locations; this
      document; the support arrangement (what Joe still does, until when, how
      to reach him, and what happens if he is unavailable).
- [ ] **12.9 Board item:** mark BLD-1650 shipped with a comment
      linking the sign-off.

---

## 13. What the clinic will pay after handover (monthly, approximate)

| Service | Plan | Approx. cost | Confirm at |
| --- | --- | --- | --- |
| Vercel | Pro, 1–2 seats + usage | $20 per seat + usage | vercel.com/pricing |
| Neon | Launch (or the tier the project is on today) | ~$5–25 + usage | neon.com/pricing |
| GitHub | Free, or Team if private with branch protection | $0 or ~$4 per user | github.com/pricing |
| Resend | Pro | ~$20 | resend.com/pricing |
| Sentry | Developer (free) or Team | $0–26 | sentry.io/pricing |
| Anthropic | usage, capped by `AI_MONTHLY_CAP` | £10–50 | console.anthropic.com |
| Upstash | pay-as-you-go via Vercel | £0–8 | — |
| Twilio | usage | ~£0.04 per SMS | twilio.com/pricing |
| Cloudflare | Free | $0 | — |
| Google Workspace / Cloud | already the clinic's | unchanged | — |
| Password manager | Bitwarden Teams | ~$4 per user | bitwarden.com |

Roughly £70–120 a month of fixed platform cost plus usage, all on the clinic's
card, all cancellable by Inna alone.

---

## 14. Sign-off checklist

The handover is complete when Inna can tick every line without Joe's help.

- [ ] I am the owner (billing + admin) of: GitHub org, Vercel team, Neon
      organisation or Vercel-managed Neon resource, Resend, Sentry, Anthropic,
      Stripe, Cloudflare (Turnstile), Twilio (if used), Deepgram (if used),
      Hostinger (domain + DNS), Google Workspace, Google Cloud `KClinics`.
- [ ] A second clinic person is admin on each of those (no single point of
      failure).
- [ ] Two-step verification is on for every one of those logins; recovery
      codes are in the vault.
- [ ] I can open the live site's settings, database console, error monitor
      and email logs on my own laptop.
- [ ] I have the health-data encryption keys in two places (vault + offline).
- [ ] Every secret in section 10.2 has been rotated after Joe's access ended.
- [ ] Joe has no owner or admin role anywhere (Appendix A, column "Joe now").
- [ ] The verification matrix (section 9) passed on a date after the last
      rotation.
- [ ] The processors register and breach-response roles are updated.
- [ ] I know who to call if the site breaks, and what it costs.

Signed: Inna ____________ date ______ · Joe ____________ date ______

---

## Appendix A — Asset and account register (fill in before Phase 2)

| # | Asset | Provider | Today's owner login | Shared with Joe's other projects? | Decision / route | Target owner | Joe now (end state) | Done |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Source code `K-Clinics` | GitHub | JoeKaulPulse (personal) | n/a (repo) | Transfer → org `kclinics` (7.1); visibility per D2 | Inna (org owner) | Outside collaborator or none | [ ] |
| A2 | GitHub App `kclinics-board` | GitHub | JoeKaulPulse | no | Transfer ownership (7.2) | org `kclinics` | none | [ ] |
| A3 | Website project `k-clinics` | Vercel | team KAUL (Joe) | yes (6 other projects) | Transfer project (7.3) | team K-Clinics (Inna) | Member or none | [ ] |
| A4 | Blob store | Vercel | team KAUL | [CONFIRM] | with A3, else copy (7.4) | team K-Clinics | — | [ ] |
| A5 | Upstash Redis | Vercel Marketplace | team KAUL | [CONFIRM] | with A3, else recreate (8) | team K-Clinics | — | [ ] |
| A6 | Postgres database | Neon | [CONFIRM: Vercel-managed or Neon-native] | [CONFIRM] | path A/B/C (7.5) | Inna | none | [ ] |
| A7 | Prisma Console leftovers | Prisma | Joe [CONFIRM exists] | [CONFIRM] | delete or transfer (7.6) | — | none | [ ] |
| A8 | Domain registration + DNS zone | Hostinger (nameservers `dns-parking.com`) | [CONFIRM] | — | keep; remove Joe's account sharing (7.12, 10.5) | clinic | none | [ ] |
| A9 | Turnstile widget | Cloudflare | [CONFIRM] | [CONFIRM] | D8 route a/b (7.9) | Inna | Administrator (temp) → none | [ ] |
| A10 | Transactional email | Resend | [CONFIRM] | [CONFIRM] | route A/B (7.7) | Inna | Member or none | [ ] |
| A11 | Company mailboxes | Google Workspace | clinic | — | roles only (6.1, 10.5) | Inna (Super Admin) | `webmaster@` demoted/suspended | [ ] |
| A12 | Google Cloud project `KClinics` | Google | clinic org; `webmaster@` Owner | — | add Inna Owner (6.2), remove Joe (10.5) | Inna | none | [ ] |
| A13 | Payments | Stripe | [CONFIRM owner] | — | owner transfer if needed (7.8) | Inna | none / Developer | [ ] |
| A14 | Error monitoring | Sentry | [CONFIRM] | [CONFIRM] | transfer project or new (7.3/8) | Inna | Manager (temp) → none | [ ] |
| A15 | AI | Anthropic | [CONFIRM] | [CONFIRM] | new org + key (5.8, 7.11) | Inna | Developer (temp) → none | [ ] |
| A16 | Transcription | Deepgram | [CONFIRM] | [CONFIRM] | new key (7.11) | Inna | none | [ ] |
| A17 | SMS | Twilio | [CONFIRM] | [CONFIRM] | owner change or new (7.11) | Inna | none | [ ] |
| A18 | Telephony | yay.com | clinic [CONFIRM] | — | token rotation only (10.2) | clinic | none | [ ] |
| A19 | Accounting / bank apps | Xero, TrueLayer | [CONFIRM app owner] | — | add Inna, remove Joe (7.12) | Inna | none | [ ] |
| A20 | Marketing accounts | GBP, Search Console, GA4, Ads, Meta, TikTok | [CONFIRM] | — | roles (7.10) | Inna | none | [ ] |
| A21 | GIF keys | Tenor/GIPHY | [CONFIRM] | — | new key (7.11) | Inna | none | [ ] |
| A22 | Alert webhook | Slack/Discord/Make | [CONFIRM] | — | clinic channel (8) | clinic | none | [ ] |
| A23 | Build automation | Claude Code (Anthropic) | Joe | yes | D6 | Inna or off | none | [ ] |
| A24 | Admin dashboard accounts | the app | Inna OWNER; Joe/webmaster | — | 10.4 | Inna | DEVELOPER or inactive | [ ] |
| A25 | Backups + keys | vault | — | — | 4.3, 10.3, 12.8 | Inna | no copies | [ ] |

---

## Appendix B — Blob storage: what must move

#### How the app addresses the store

- One Vercel Blob store, addressed only through the auto-injected `BLOB_READ_WRITE_TOKEN`. No call passes a `token:` option, so the SDK reads the env var on every `put`/`get`/`list`/`del`/`handleUpload` (`node_modules/@vercel/blob/dist/chunk-A7B3MEJ5.cjs:198,211`).
- The SDK takes the store id from the token (4th `_`-separated segment, `chunk-A7B3MEJ5.cjs:120`) and builds every URL as `https://<storeId>.<public|private>.blob.vercel-storage.com/<pathname>` (`chunk-A7B3MEJ5.cjs:338-340`). A new store therefore means a new hostname for every stored URL.
- Every reference in the database is an **absolute URL** (only `MediaAsset` also keeps the pathname). No store-specific hostname is committed anywhere in the repo; every hostname check is a suffix/wildcard match (`lib/portfolio-blob.ts:18,26`, `lib/portfolio.ts:26`, `app/api/academy/pdf/route.ts:50`, `components/academy/LessonMedia.tsx:23`, `next.config.mjs:200-201`, `next.config.mjs:35`, `middleware.ts:46`). **A new store id needs no code change.** A change of access tier (public to private) would.
- The live store is provisioned **public-only** (BLD-1304, `lib/kiosk-blob.ts:36-107`). Every `access:'private'` upload fails: kiosk selfies (`app/api/kiosk/sessions/[token]/photo/route.ts:64`, `photos/route.ts:73`), portfolio photos (`components/academy/PortfolioManager.tsx:106`) and the daily portfolio re-homing sweep (`lib/portfolio-blob.ts:91`). So every blob that exists today sits on the `.public.` hostname. Vercel fixes a store's tier at creation (`lib/build-backlog.ts:3846`), and one token cannot serve both tiers — the transfer is the moment to create the store(s) deliberately (see "Decision" below).

#### Database inventory: every column holding a Blob URL

Access column = what the writer asks for; on the current public-only store everything that exists is public.

| Model.field | Type | Writer (upload path, pathname prefix) | Reader | Access | Rewrite |
| --- | --- | --- | --- | --- | --- |
| `MediaAsset.url` (+ `pathname`) | text | `app/api/admin/media/route.ts:48-56` server `put`, `<folder>/<ts>-<name>`, `addRandomSuffix:false` | `media/route.ts:24`, `components/admin/MediaPicker.tsx:33` (next/image) ; `del` `:81` | public | text |
| `FacilityDoc.fileUrl` | text | `app/api/admin/facility/route.ts:57-64`, `facility/<type>/…` | `components/admin/FacilityDocsViewer.tsx:53-59` direct ; `del` `:80` | public | text |
| `KioskSession.photoUrl` | text | `photo/route.ts:64-68,94-97` via `lib/kiosk-blob.ts:93-107`, `kiosk/<token>-…` | relay `photo-view/route.ts:33-38`; AI `lib/kiosk-ai.ts:131,338`; `del` `lib/kiosk.ts:145-154`, `cron/kiosk-cleanup/route.ts:46,66`, `kiosk/test-cleanup/route.ts:32-34` | private (failing) | text |
| `KioskSession.photoUrls[]` | text[] | `photos/route.ts:73-77,97-107` | as above | private (failing) | array |
| `KioskResult.photoUrl`, `bestPhotoUrl` | text | `lib/kiosk.ts:131,223-224,235-236` (copies) | never public (`app/kiosk/result/[slug]/page.tsx:11`) | mirror | text |
| `Lesson.videoUrl`, `captionsUrl`, `audioUrl`, `imageUrl` | text | `components/admin/CurriculumManager.tsx:143-151` via `lib/upload-client.ts` → `/api/admin/blob-upload` (`academy/`, `academy/audio`, `academy/quiz`) or client-direct `/api/admin/academy/blob-token`; saved by `app/api/admin/academy/route.ts` | `lib/lms.ts:186-189`, `LessonMedia.tsx` direct `<video>/<audio>` | public (mixed with YouTube/Vimeo links) | text |
| `Lesson.pdfUrls[]`, `pdfNoDownload[]` | text[] | same editor (`uploadPdf`) | `lib/lms.ts:268-274` → relay `app/api/academy/pdf/route.ts:41-53` (index-addressed, `.public.` guard) | public | array, **both in lockstep, order preserved** |
| `Lesson.attachments` (`[{label,url,sizeBytes,kind}]`), `citations`, `resources`, `steps` | jsonb | `CurriculumManager.tsx:184-189` | `lib/lms.ts` `attArr` | public | jsonb |
| `DemoVideo.videoUrl`, `captionsUrl` | text | `components/admin/DemosManager.tsx:29-32` client-direct `academy/demos/…`; `app/api/admin/demos/route.ts:34` | trainee player direct | public | text |
| `QuizQuestion.imageUrl` | text | `CurriculumManager.tsx:392` (`academy/quiz`) | portal direct | public | text |
| `Flashcard.imageUrl` | text | `components/admin/FlashcardsManager.tsx:75` (`academy/flashcards`); `app/api/admin/flashcards/route.ts:60` | portal direct | public | text |
| `Exercise.imageUrl` | text | `components/admin/ExercisesManager.tsx:60` (`academy/exercises`); `app/api/admin/exercises/route.ts:43` | portal direct | public | text |
| `HomeworkSubmission.files[]`, `HomeworkSubmissionHistory.files[]` | text[] | `components/academy/HomeworkPanel.tsx:39-45` client-direct `academy/homework/…`; `app/api/academy/homework/route.ts:16,34-38` | `HomeworkPanel.tsx` href, `components/admin/HomeworkReview.tsx:45`; `del` `app/admin/actions.ts:366-372` | public | array |
| `PortfolioEntry.photos` (`[{url,caption?,kind}]`) | jsonb | `PortfolioManager.tsx:102-107` client-direct `portfolio/…` `access:'private'`; validated `lib/portfolio.ts:26-53` | relay `app/api/academy/portfolio/photo/route.ts:17-47` (exact-string match `:36`); sweep `lib/portfolio-blob.ts:60-123`; `del` `lib/portfolio.ts:253-270` | private (failing; rows hold public URLs) | jsonb |
| `BuildItem.attachments[]`, `screenshots[]` | text[] | `components/admin/BuildBoard.tsx:41-62` (`/api/admin/build/upload` `build/<ts>-<name>` or client-direct `build/…`), `components/admin/ReportProblem.tsx:41`; `lib/build-board.ts:641-649` | board UI direct | public | array |
| `TeamMessageAttachment.url` | text | `components/admin/teamchat/util.ts:44-45` (`team-chat/`); `lib/team-chat.ts:277-300` | chat UI direct; no delete path | public | text |
| `Client.leaderboardPhotoUrl` | text | `components/admin/LeaderboardCard.tsx:17-22` (via `/api/admin/media`, folder `leaderboard`, also creates a `MediaAsset`) ; `app/admin/clients/actions.ts:145` | public leaderboard | public | text |
| `AdminUser.photoUrl` | text | typed `components/admin/StaffManager.tsx:350`; `app/api/admin/staff/route.ts:98`, `onboarding/route.ts:21` | public team page | public (may be pasted library URL) | text |
| `Post.coverImage`; `Post.blocks` (image `src`, `lib/blocks.ts:20`); `Post.content` (rendered HTML, `lib/blocks.ts:111`) | text / jsonb / text | `components/admin/PostEditor.tsx:107` MediaField; `app/api/admin/posts/route.ts:69` | public journal | public | text + jsonb + text |
| `Page.draft`, `Page.published`, `PageRevision.data`, `GlobalSection.data` | jsonb | MediaField via `components/admin/SectionFields.tsx:91`; image keys `lib/sections.ts:69,89,188` | public pages | public | jsonb |
| `PageSeo.ogImage` | text | `components/admin/PageBuilder.tsx:255`; `app/api/admin/seo/route.ts:45` | meta tags | public | text |
| `Course.heroImage`, `CourseBundle.heroImage`, `MarketingCampaign.heroImage` | text | typed; `app/api/admin/academy/route.ts:54`, `bundles/route.ts:48`, `marketing/campaigns/route.ts:48` | public | public (if pasted) | text |
| `Product.images[]` | text[] | typed list `components/admin/ProductEditor.tsx:39`; `app/api/admin/products/route.ts:48` | shop | public (if pasted) | array |
| `PastPaper.fileUrl` | text | typed `components/admin/ExamBankManager.tsx:177`; `app/api/admin/exam-bank/route.ts:82` | portal | public (if pasted) | text |
| `SiteConfig.data`, `SiteConfigRevision.data` (`hero.videoUrl`, `hero.videoPoster`) | jsonb | typed `components/admin/SiteConfigEditor.tsx:88-89`; `lib/site-config.ts:20-21,92` | home page | public (if pasted) | jsonb |
| `Setting.value` where `key='brand_kit'` (`logos.*`) | text | typed `components/admin/BrandKitManager.tsx:71`; `lib/brand.ts:20,25` | brand pages | public (if pasted) | text |
| `JobApplication.cvUrl` | text | **not an upload** — applicant pastes an http(s) link (`components/careers/ApplyForm.tsx:76`, `app/api/careers/apply/route.ts:14-20`); cron `del()` `app/api/cron/daily/route.ts:274-290` | admin careers | external | text (sweep anyway); fix `docs/data-protection/processors.md:21`, `ROPA.md:170` which claim CV uploads go to Blob |

Not Blob, no action: `GalleryItem.beforeImage/afterImage` (Bytes), `BeforePhoto.dataEnc`, `AiAnalysisImage.dataEnc`, `KioskSession.liveFrame` (all in-DB); Google post/review photos and yay.com `recordingUrl` (external); `TeamChannel.avatarUrl` (never written).

#### Code that depends on the token / upload routes

- Presence gates: `lib/api-health.ts:101-111` (health light does `list({limit:1})`), `lib/kiosk.ts:147`, `photo/route.ts:53`, `photos/route.ts:63`, `kiosk/test-cleanup/route.ts:33`, `lib/portfolio-blob.ts:67`, `lib/portfolio.ts:258`, `cron/daily/route.ts:274`, `app/admin/actions.ts:366`, `admin/media/route.ts:33`, `admin/facility/route.ts:36`, `admin/blob-upload/route.ts:20`, `admin/build/upload/route.ts:16`.
- `handleUpload` client-token routes (browser chooses `access`; the server cannot pin it, `lib/portfolio-blob.ts:61-63`): `admin/build/blob-token` (`build/`), `admin/academy/blob-token` (unscoped, 500 MB), `admin/team-chat/blob-token` (`team-chat/`), `academy/homework/blob-token` (`academy/homework/`), `academy/portfolio/blob-token` (`portfolio/`, private). Client callers: `lib/upload-client.ts:27-31`, `BuildBoard.tsx:51`, `DemosManager.tsx:31`, `HomeworkPanel.tsx:44`, `PortfolioManager.tsx:106`. The browser posts to `https://vercel.com/api/blob` and the store host, both already in CSP `connect-src` (`next.config.mjs:35`, `middleware.ts:46`).
- Delete paths call `del(url)` and swallow errors: `lib/kiosk.ts:145-154`, `cron/kiosk-cleanup/route.ts:46,66`, `cron/daily/route.ts:283-286`, `app/admin/actions.ts:368`, `lib/portfolio.ts:260-261`, `admin/media/route.ts:81`, `admin/facility/route.ts:80`. With a new token, `del` on an old-host URL fails silently and the file is orphaned (the SDK only checks the `.blob.vercel-storage.com` suffix, `index.cjs:117-121`).
- Config: `next.config.mjs:200-201` remotePatterns (`*.public.blob.vercel-storage.com`, `*.blob.vercel-storage.com`), `img-src`/`media-src` `https:` (`:16-23`), `connect-src` (`:35`, `middleware.ts:46`). All store-agnostic. `vercel.json` carries no Blob config.
- Copy text to update after the move: `components/admin/MediaPicker.tsx:85`, `.env.example:203-207`, `docs/staff-manual/content.js:512`, `scripts/restore.mjs:22-23,164`, `lib/build-backlog.ts:3846` (BLD-1304 ask names "the team named KAUL").

#### Decision: store topology (owner, before anything is copied)

Vercel fixes a store's access tier when it is created. The code assumes one token, and asks for `private` in `lib/kiosk-blob.ts:100`, `lib/portfolio-blob.ts:91` and `PortfolioManager.tsx:106` while asking for `public` everywhere else.

1. **One public store (status quo).** Media, academy, chat, board all work; kiosk photo analysis stays disabled (503 "temporarily unavailable") and portfolio photo uploads stay broken.
2. **Two stores (recommended).** `kclinics-public` for everything currently public and `kclinics-private` for `kiosk/` and `portfolio/`. Code change (small): a second env var, e.g. `BLOB_PRIVATE_READ_WRITE_TOKEN`, passed as `token` in `lib/kiosk-blob.ts:14,100`, `lib/portfolio-blob.ts:33,69`, `lib/kiosk.ts:150`, `lib/portfolio.ts:261`, `app/api/academy/portfolio/blob-token/route.ts:18` (`handleUpload({ token })`), and a second light in `lib/api-health.ts`. This closes BLD-1304 and BLD-740.

#### Option A: keep the store (Vercel transfers it with the project)

Blob is native Vercel storage, and the accept-transfer response lists `transferredStoreIds`. If the store id is in that list the hostname is unchanged, `BLOB_READ_WRITE_TOKEN` moves with the project env vars, and nothing in the database or the store changes.

Verify:
1. New team → Storage shows the store, connected to `k-clinics`.
2. The store-id segment of the token (Settings → Environment Variables; reveal the prefix only) equals the hostname prefix from `SELECT DISTINCT substring(url from '^https://([^/]+)/') FROM "MediaAsset";`.
3. `/admin/api-health` (perm `platform.status`): Blob light green ("Store reachable, token accepted").
4. Open one media-library image, one lesson video, one facility PDF, one build attachment, one team-chat image.
5. `node scripts/visual-qa.mjs` (kiosk photo step returns the deliberate 503 until a private store exists).

If `resourceTransferErrors` names the store, fall through to Option B.

#### Option B: new store(s) — copy blobs, then rewrite hostnames

Mapping: `OLD = <oldStoreId>.public.blob.vercel-storage.com` → `NEW_PUBLIC = <newStoreId>.public.blob.vercel-storage.com`; if a private store is created, additionally `OLD` → `NEW_PRIVATE = <privateStoreId>.private.blob.vercel-storage.com` for pathnames starting `kiosk/` and `portfolio/`. Store ids come from the tokens' 4th `_` segment (never print the tokens).

1. **Snapshot.** Neon branch or `/api/admin/export` (OWNER + passkey), so the rewrite can be rolled back.
2. **Copy** (`scripts/blob-rehost.mjs`, to be written; `copy()` in the SDK is same-store only, `index.cjs:255-275`): `list({cursor, token: OLD_TOKEN})` page by page → `fetch(blob.downloadUrl)` → `put(blob.pathname, bytes, { access, addRandomSuffix: false, contentType, token: NEW_TOKEN })`, choosing the private token for `kiosk/`/`portfolio/`. Skip when `head(pathname, {token: NEW_TOKEN})` succeeds (idempotent, re-runnable). Preserving the pathname is what makes the DB change a pure hostname swap. Write a manifest of old→new URLs and byte totals.
3. **Freeze.** Out of opening hours; after the first copy pass, either block uploads for the window or re-run the copy for blobs with `uploadedAt` after the first pass.
4. **Rewrite** in one transaction (all tables use Prisma default naming: quoted model/field names; Json = `jsonb`, `String[]` = `text[]`). Patterns, with `:old`/`:new` bound:
   - text: `UPDATE "T" SET "c" = replace("c", :old, :new) WHERE "c" LIKE '%'||:old||'%';`
   - text[] (order preserved — required for `Lesson.pdfUrls`/`pdfNoDownload` and `KioskSession.photoUrls`): `UPDATE "T" SET "c" = (SELECT array_agg(replace(x, :old, :new) ORDER BY ord) FROM unnest("c") WITH ORDINALITY AS u(x, ord)) WHERE EXISTS (SELECT 1 FROM unnest("c") x WHERE x LIKE '%'||:old||'%');`
   - jsonb: `UPDATE "T" SET "c" = replace("c"::text, :old, :new)::jsonb WHERE "c"::text LIKE '%'||:old||'%';` (hostnames contain no JSON-significant characters).
   - Apply the private mapping first (`WHERE "c" LIKE '%'||:old||'/kiosk/%'` and `'/portfolio/%'`), then the public mapping for the remainder.
   - Columns: text — `MediaAsset.url`, `FacilityDoc.fileUrl`, `KioskSession.photoUrl`, `KioskResult.photoUrl`, `KioskResult.bestPhotoUrl`, `Lesson.videoUrl/captionsUrl/audioUrl/imageUrl`, `DemoVideo.videoUrl/captionsUrl`, `QuizQuestion.imageUrl`, `Flashcard.imageUrl`, `Exercise.imageUrl`, `TeamMessageAttachment.url`, `Client.leaderboardPhotoUrl`, `AdminUser.photoUrl`, `Post.coverImage`, `Post.content`, `PageSeo.ogImage`, `Course.heroImage`, `CourseBundle.heroImage`, `MarketingCampaign.heroImage`, `PastPaper.fileUrl`, `JobApplication.cvUrl`, `Setting.value` (`key='brand_kit'`); text[] — `KioskSession.photoUrls`, `Lesson.pdfUrls`, `Lesson.pdfNoDownload`, `HomeworkSubmission.files`, `HomeworkSubmissionHistory.files`, `BuildItem.attachments`, `BuildItem.screenshots`, `Product.images`; jsonb — `Lesson.attachments/citations/resources/steps`, `PortfolioEntry.photos`, `Post.blocks`, `Page.draft`, `Page.published`, `PageRevision.data`, `GlobalSection.data`, `SiteConfig.data`, `SiteConfigRevision.data`.
   - Safer implementation: generate the statements from `Prisma.dmmf.datamodel.models` (the pattern in `lib/data-export.ts:42`) for every `String`, `String[]` and `Json` field, and check that the touched set equals the list above.
5. **Switch the app**: set the new `BLOB_READ_WRITE_TOKEN` (and the private token, if any) on the new project, redeploy, confirm `/admin/api-health` green, then run the verification below and the Option A visual checks.
6. **Retire the old store** only after: verification returns zero rows twice (immediately and after 24 h so `cron/daily` and `cron/kiosk-cleanup` have run) and 30 days have passed (one kiosk retention cycle). Deleting it earlier turns every missed URL into an unreachable file with no reference — a retention/erasure gap for selfies, portfolio photos and homework files.

#### Verification query (must return zero rows)

```sql
SELECT loc, n FROM (
  SELECT 'MediaAsset.url' loc, count(*) n FROM "MediaAsset" WHERE url LIKE '%'||:old||'%'
  UNION ALL SELECT 'FacilityDoc.fileUrl', count(*) FROM "FacilityDoc" WHERE "fileUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'KioskSession.photoUrl', count(*) FROM "KioskSession" WHERE "photoUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'KioskSession.photoUrls', count(*) FROM "KioskSession" WHERE array_to_string("photoUrls",' ') LIKE '%'||:old||'%'
  UNION ALL SELECT 'KioskResult', count(*) FROM "KioskResult" WHERE "photoUrl" LIKE '%'||:old||'%' OR "bestPhotoUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'Lesson.scalars', count(*) FROM "Lesson" WHERE concat_ws(' ',"videoUrl","captionsUrl","audioUrl","imageUrl") LIKE '%'||:old||'%'
  UNION ALL SELECT 'Lesson.arrays', count(*) FROM "Lesson" WHERE array_to_string("pdfUrls"||"pdfNoDownload",' ') LIKE '%'||:old||'%'
  UNION ALL SELECT 'Lesson.json', count(*) FROM "Lesson" WHERE concat_ws(' ',attachments::text,citations::text,resources::text,steps::text) LIKE '%'||:old||'%'
  UNION ALL SELECT 'DemoVideo', count(*) FROM "DemoVideo" WHERE concat_ws(' ',"videoUrl","captionsUrl") LIKE '%'||:old||'%'
  UNION ALL SELECT 'QuizQuestion.imageUrl', count(*) FROM "QuizQuestion" WHERE "imageUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'Flashcard.imageUrl', count(*) FROM "Flashcard" WHERE "imageUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'Exercise.imageUrl', count(*) FROM "Exercise" WHERE "imageUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'HomeworkSubmission.files', count(*) FROM "HomeworkSubmission" WHERE array_to_string(files,' ') LIKE '%'||:old||'%'
  UNION ALL SELECT 'HomeworkSubmissionHistory.files', count(*) FROM "HomeworkSubmissionHistory" WHERE array_to_string(files,' ') LIKE '%'||:old||'%'
  UNION ALL SELECT 'PortfolioEntry.photos', count(*) FROM "PortfolioEntry" WHERE photos::text LIKE '%'||:old||'%'
  UNION ALL SELECT 'BuildItem', count(*) FROM "BuildItem" WHERE array_to_string(attachments||screenshots,' ') LIKE '%'||:old||'%'
  UNION ALL SELECT 'TeamMessageAttachment.url', count(*) FROM "TeamMessageAttachment" WHERE url LIKE '%'||:old||'%'
  UNION ALL SELECT 'Client.leaderboardPhotoUrl', count(*) FROM "Client" WHERE "leaderboardPhotoUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'AdminUser.photoUrl', count(*) FROM "AdminUser" WHERE "photoUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'Post', count(*) FROM "Post" WHERE concat_ws(' ',"coverImage",content,blocks::text) LIKE '%'||:old||'%'
  UNION ALL SELECT 'Page', count(*) FROM "Page" WHERE concat_ws(' ',draft::text,published::text) LIKE '%'||:old||'%'
  UNION ALL SELECT 'PageRevision.data', count(*) FROM "PageRevision" WHERE data::text LIKE '%'||:old||'%'
  UNION ALL SELECT 'GlobalSection.data', count(*) FROM "GlobalSection" WHERE data::text LIKE '%'||:old||'%'
  UNION ALL SELECT 'PageSeo.ogImage', count(*) FROM "PageSeo" WHERE "ogImage" LIKE '%'||:old||'%'
  UNION ALL SELECT 'Course.heroImage', count(*) FROM "Course" WHERE "heroImage" LIKE '%'||:old||'%'
  UNION ALL SELECT 'CourseBundle.heroImage', count(*) FROM "CourseBundle" WHERE "heroImage" LIKE '%'||:old||'%'
  UNION ALL SELECT 'MarketingCampaign.heroImage', count(*) FROM "MarketingCampaign" WHERE "heroImage" LIKE '%'||:old||'%'
  UNION ALL SELECT 'Product.images', count(*) FROM "Product" WHERE array_to_string(images,' ') LIKE '%'||:old||'%'
  UNION ALL SELECT 'PastPaper.fileUrl', count(*) FROM "PastPaper" WHERE "fileUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'JobApplication.cvUrl', count(*) FROM "JobApplication" WHERE "cvUrl" LIKE '%'||:old||'%'
  UNION ALL SELECT 'SiteConfig.data', count(*) FROM "SiteConfig" WHERE data::text LIKE '%'||:old||'%'
  UNION ALL SELECT 'SiteConfigRevision.data', count(*) FROM "SiteConfigRevision" WHERE data::text LIKE '%'||:old||'%'
  UNION ALL SELECT 'Setting.brand_kit', count(*) FROM "Setting" WHERE key='brand_kit' AND value LIKE '%'||:old||'%'
) s WHERE n > 0;
```

Stricter variant: bind `:old` to `.blob.vercel-storage.com` and add `AND col NOT LIKE '%'||:new_public||'%' AND col NOT LIKE '%'||:new_private||'%'` to each branch, which also catches any third hostname. Complement with `SELECT DISTINCT substring(url from '^https://([^/]+)/') FROM "MediaAsset";` (only the new hostname may appear) and `/admin/api-health` Blob light green. Run after the rewrite, after 24 h, and immediately before the old store is deleted.

## Appendix C — Code and documentation touchpoints

Scope: `rg` over the whole tree excluding `node_modules`, `.git`, `.next`, `package-lock.json` for `JoeKaulPulse`, `kaul-joe`, `kaulindustries`, `github.io/K-Clinics`, `KAUL`, `webmaster@`, `joe@`, `team_CPOn9dK6i3wsqbQRuiFfKeYU`, `prj_KXAOC4uXaRNsYIiA8IwYGfiMYZUE`, `k-clinics.vercel.app`, `k-clinics-kaul-joe`, plus a targeted review of the files named in the brief. The Vercel team id, project id, `k-clinics-kaul-joe.*` hostnames and `joe@kaulindustries.com` occur nowhere in the repo. Every webhook and OAuth redirect URI in `.env.example` (lines 50, 94, 100, 125, 170) is on `kclinics.co.uk`, so the change of Vercel team slug invalidates no external registration.

Classes: **(a)** change in code/docs when the repo and Vercel project move · **(b)** historical note, leave · **(c)** security-relevant default to tighten. "When": *before* = do before the transfer weekend; *at* = same change set as the transfer; *after* = within the two-week cleanup window; *leave* = no change.

#### Application code

| file:line | what it says | action | when |
|---|---|---|---|
| `components/admin/dashboard/DeveloperView.tsx:13-14` (used `:66-67`) | `REPO_URL = 'https://github.com/JoeKaulPulse/K-Clinics'`, `VERCEL_URL = 'https://vercel.com/kaul-joe/k-clinics'` shown as "GitHub repository" / "Deployments (Vercel)" quick links on the developer dashboard | (a) Point at the new owner/repo and new Vercel team slug, or read from env (`GITHUB_REPO`, new `VERCEL_PROJECT_URL`) | at |
| `components/admin/BuildBoard.tsx:105` | GitHub connect form pre-fills `repo: 'JoeKaulPulse/K-Clinics'` | (a) Default to the new owner/name or leave blank | at |
| `lib/build-board.ts:844` | Error text: "use owner/name, e.g. JoeKaulPulse/K-Clinics" | (a) Update the example | at |
| `lib/build-backlog.ts:77` | `PR(n)` builds every seeded board PR link on `github.com/JoeKaulPulse/K-Clinics/pull/n` | (a) Change the base to the new owner/name (PR numbers survive transfer; GitHub's redirect only holds until a new repo of that name appears under JoeKaulPulse) | at |
| `lib/build-board.ts:745-773`, `:850`; `lib/github-app.ts:11-22`, `:50`; `lib/build-backlog.ts:398` | Board GitHub identity: GitHub App `kclinics-board` (Joe's account; `GITHUB_APP_ID/PRIVATE_KEY/INSTALLATION_ID`) → `GITHUB_TOKEN`+`GITHUB_REPO` PAT → encrypted `github` connection whose `accountRef` is "owner/repo". App installed only on JoeKaulPulse/K-Clinics | (a) Transfer the App (GitHub → Developer settings → Advanced → Transfer ownership) or recreate under the clinic's account; reinstall on the moved repo; set the new installation id (and id/key if recreated); set `GITHUB_REPO` to the new owner/name; reconnect on `/admin/build`; revoke Joe's PAT | at |
| `lib/build-board.ts:1112`, `:1139-1140` | `CLAUDE_ROUTINE_FIRE_URL` / `CLAUDE_ROUTINE_FIRE_TOKEN` fire a Claude Code Routine on Joe's Anthropic account; feature is off when unset | (a) Recreate the Routine under a clinic-owned Anthropic account and set new values, or unset both | at |
| `lib/google-sso.ts:35-38` | `allowedDomains()` defaults to `['kclinics.co.uk','kaulindustries.com']`; comment calls them "the clinic's two Workspace domains" | (c) Default to `['kclinics.co.uk']`, fix the comment, set `GOOGLE_SSO_ALLOWED_DOMAINS=kclinics.co.uk` explicitly in Vercel | before |
| `lib/google-sso-provision.ts:17-19`, `:64-71` | New SSO emails only create a DISABLED account pending owner approval | none (mitigates the item above for *new* users; existing active `@kaulindustries.com` rows still sign in) | — |
| `lib/google-workspace.ts:20`, `:44`, `:60`; `lib/secrets.ts:51`; `lib/integrations.ts:260-270` | `/admin/workspace` impersonates the super-admin in the encrypted secret `GOOGLE_WORKSPACE_ADMIN_EMAIL`; `invalid_grant` if that user loses Super Admin | (c) Repoint to a clinic-owned dedicated super-admin (e.g. `admin@kclinics.co.uk`) and re-authorise domain-wide delegation **before** removing `webmaster@`'s Super Admin role | before |
| `prisma/seed.mjs:26-34` (`:28` fallback password literal) | Seeds `qa-practitioner/reception/developer/contractor@kaulindustries.com` AdminUsers when `SEED_QA_ROLES=true`, with a hard-coded fallback password | (c) Delete/deactivate any `@kaulindustries.com` AdminUser rows in production; change the seed domain to a non-routable one; require `SEED_QA_PASSWORD` (drop the literal) | before |
| `lib/go-live.ts:120-136` | `EXT` links are generic provider dashboards (`vercel.com/dashboard`, `dash.cloudflare.com`, `resend.com/domains`…) | none | — |
| `vercel.json` | Region `lhr1` + crons only; nothing team-specific | none (note: `vercel.json` `env` blocks would need re-creating on transfer, but there are none) | — |

#### Tooling and environment docs

| file:line | what it says | action | when |
|---|---|---|---|
| `CLAUDE.md:16-19`, `:24`, `:29-33` | "Claude environment (Settings → Environment variables)" holds `BASE_URL`, `QA_TOKEN`, `BOARD_QUEUE_TOKEN`, `QA_ADMIN_EMAIL/PASSWORD`, `QA_ACADEMY_LOGIN/PASSWORD`, read-only `DATABASE_URL` — this is Joe's Claude Code environment | (a)+(c) Rotate `BOARD_QUEUE_TOKEN`; retire the QA admin and academy accounts; revoke the read-only DB role; rewrite the section to name the clinic's environment (or state the tooling is retired) | after |
| `.env.example:275-289` | Same environment/tooling notes (`BOARD_QUEUE_TOKEN` "set here AND in the Claude Code environment") | (a) Update wording with `CLAUDE.md` | after |
| `.env.example:106-107` | `GOOGLE_SSO_ALLOWED_DOMAINS="kclinics.co.uk,kaulindustries.com"` "defaults to the two below if unset" | (c) Change to `kclinics.co.uk` only | before |
| `.env.example:258-260` | `SEED_ADMIN_EMAIL="you@kclinics.co.uk"`, `SEED_ADMIN_NAME="Clinic Owner"` | none (placeholder; re-running seed resets an OWNER password, useful for Inna's first login) | — |
| `.env.example:5`, `:184-188` | GitHub Pages demo note; "clinic's email/calendar is on Hostinger (Google Workspace is parked)" + `HOSTINGER_CALDAV_*` | (a-review) Refresh after the Workspace migration; confirm the CalDAV mailbox is a clinic account | after |
| `.claude/hooks/session-start.sh:98-106`, `:118-127` | Readiness report reads `BASE_URL`, `QA_TOKEN`, `BOARD_QUEUE_TOKEN`, `DATABASE_URL`, `ANTHROPIC_API_KEY` from the Claude environment | none in code; the variables need re-creating in whichever Claude environment the clinic uses | after |
| `scripts/healthcheck.mjs:33`, `scripts/site-audit.mjs:7`, `scripts/visual-qa-admin.mjs:15`, `scripts/check-claims.mjs:75` | Default target `https://kclinics.co.uk` | none | — |
| `scripts/migrate-wp/README.md:21-25` | `npx vercel link --yes --scope kaul-joe --project k-clinics`, then `vercel env pull` for `DATABASE_URL`/`HEALTH_ENCRYPTION_KEY` | (a) Change `--scope` to the clinic's team slug; prefer the server-side runner at `:47-60` | after |

#### Deployment docs

| file:line | what it says | action | when |
|---|---|---|---|
| `docs/DEPLOY.md:27`, `:99`, `:131` | "choose `joekaulpulse/k-clinics`"; clone `github.com/joekaulpulse/k-clinics.git`; Settings → Git should show `joekaulpulse/k-clinics` | (a) New owner/name | after |
| `docs/DEPLOY.md:14`, `:112` | Live URL "e.g. `k-clinics.vercel.app`" | (a) Say `kclinics.co.uk`; preview hostnames now carry the clinic's team slug | after |
| `docs/DEPLOY.md:163` | Pages URL `joekaulpulse.github.io/K-Clinics` | (a) `<new-owner>.github.io/K-Clinics` (Pages is manual-only; may be dropped) | after |
| `docs/DEPLOY.md:38-44` | "Storage → Create Database → Postgres (Neon-powered)" | (a-review) Stale: production is a Neon project (Vercel-integration-style env vars); rewrite once the Neon transfer path is chosen | after |
| `docs/GO_LIVE.md:25` | "import **JoeKaulPulse/K-Clinics**" | (a) New owner/name | after |
| `README.md` | No developer identity; deployment section generic (`:100-107`) | none | — |

#### CI / GitHub configuration

| file:line | what it says | action | when |
|---|---|---|---|
| `.github/workflows/deploy.yml:54-69`, `:82-84` | Pages base path from `GITHUB_REPOSITORY`; URL from the deploy step; `github-pages` environment; manual-only (`:3-8`) | none in file; environment secrets/protection do not transfer (none used). Re-enable Pages on the new owner only if wanted | after |
| `.github/workflows/codeql.yml:13-34`; `.github/workflows/security.yml:24-34` | CodeQL code scanning; dependency-review action | (a-review) Both need GitHub Code Security on a private repo — confirm they still run after transfer | after |
| `.github/workflows/security.yml:36-47` | gitleaks-action with only `GITHUB_TOKEN` | (a-review) If the destination is an organisation, check whether a `GITLEAKS_LICENSE` secret is required | after |
| `.github/workflows/fetch-media.yml:10` | "automatically kicks off the Pages deploy" | (a-review) Stale comment (deploy is manual); harmless | after |
| `.github/dependabot.yml` | Weekly npm + actions updates; no owner values | Re-enable Dependabot alerts/security updates on the new owner (repo security settings may be overridden by org defaults) | after |
| `next.config.mjs:4-6`, `:182`, `:204-208` | Pages `basePath` from `PAGES_BASE_PATH` env | none | — |

#### Owner-facing PDF generators (and the built PDFs at the repo root)

| file:line | what it says | action | when |
|---|---|---|---|
| `scripts/build-access-request-guide.mjs:2`, `:185-199`, `:207` | Written as the developer, `webmaster@kclinics.co.uk`, requesting time-boxed grants from the owner | (a) Retire or add a handover addendum; regenerate `KClinics-Access-Request.pdf` | after |
| `scripts/build-access-request-guide.mjs:340-354` | "The Member role on the K-Clinics Vercel project/team, for webmaster@" — presumes the clinic owns the Vercel team | (a) Wrong direction: the team is Joe's KAUL; the plan must transfer the project *to* a clinic team | after |
| `scripts/build-access-request-guide.mjs:360-372` | Resend: "Settings → Team → Invite webmaster@" — presumes the clinic's Resend team | (a-review) Verify who owns the Resend team; if Joe, use Resend Domain Claim | before |
| `scripts/build-access-request-guide.mjs:286-303` | Cloudflare: invite webmaster@ with the DNS role; "remove webmaster@ (or keep me on)" — presumes the clinic's Cloudflare account | (a-review) Verify Cloudflare account owner; if Joe, plan a zone move (export records, new zone, nameserver change, new Turnstile widget) | before |
| `scripts/build-access-request-guide.mjs:260-279` | Google Cloud project Owner for webmaster@; "IAM → remove webmaster@ … I will delete the service-account key" | (c) Transfer project ownership to Inna first, rotate the SA key, then remove webmaster@ | after |
| `scripts/build-access-request-guide.mjs:241-248`, `:439-447`, `:455-459` | Workspace Super Admin on webmaster@ (temporary); revocation checklist and tick-box | (c) Use `:439-447` as the revocation list at handover, after the `GOOGLE_WORKSPACE_ADMIN_EMAIL` repoint | after |
| `scripts/build-access-request-guide.mjs:379-392` | Admin dashboard login for webmaster@ ("set to Inactive when my work is done") | (c) Set Joe's admin users Inactive at handover | after |
| `scripts/build-golive-guide.mjs:232-241` | Table of accounts "you'll create": Vercel, Neon/Vercel Postgres, Stripe, Resend, Turnstile, Xero, TrueLayer | (a) True only after the transfers; note actual current holders | after |
| `scripts/build-golive-guide.mjs:328-329` | "Vercel shows the DNS records to add at Hostinger" | (a) DNS is on Cloudflare | after |
| `scripts/build-golive-guide.mjs:257-260`, `:342` | "your developer" holds/creates keys and the first login | (a-review) Name the post-handover technical contact | after |
| `scripts/build-workspace-guide.mjs:293`; `docs/GOOGLE_WORKSPACE_MIGRATION.md:112`, `:168` | "owner@ / joe@ — Seat (super-admin) — runs the account"; Phase 1 master login "owner@ or joe@kclinics.co.uk" | (a) Replace joe@ with Inna's/clinic admin address; regenerate `KClinics-Workspace-Migration-Guide.pdf` | after |
| `scripts/build-workspace-guide.mjs:534-539` | Impersonate "a designated super-admin (e.g. admin@kclinics.co.uk)" | none (this is the right target for the repoint above) | — |
| `docs/WORKSPACE_ADMIN_SDK_SETUP.md:5-11`, `:39`, `:80` | webmaster@ is Super Admin + Cloud Owner; `GOOGLE_WORKSPACE_ADMIN_EMAIL = webmaster@kclinics.co.uk` | (c) Rewrite for the clinic-owned admin after the repoint | after |
| `KClinics-Access-Request.pdf`, `KClinics-Go-Live-Guide.pdf`, `KClinics-Workspace-Migration-Guide.pdf` | Built outputs embedding the above | (a) Regenerate after edits (`node scripts/build-*.mjs`) | after |

#### Data-protection documents

| file:line | what it says | action | when |
|---|---|---|---|
| `docs/data-protection/README.md:37-39` | Hosting Vercel; DB "Neon / Vercel Postgres / Supabase — [OWNER TO CONFIRM provider + region]" | (a) State Neon, AWS eu-west-2, functions lhr1; name the clinic as account holder post-transfer | after |
| `docs/data-protection/processors.md:21`, `:22`, `:64`, `:85` | Vercel region [OWNER TO CONFIRM]; Neon eu-west-2 verified; Sentry region; Upstash region | (a) After transfer confirm regions unchanged (nightly `DB_APPROVED_REGIONS` check covers the DB) and that DPAs are accepted under the clinic's accounts | after |
| `docs/data-protection/breach-response.md:16-18` | Breach lead / technical responder / communications all [OWNER TO CONFIRM] | (a) Inna to name a technical responder now that the developer is stepping back | after |
| `docs/data-protection/dpia.md:53`, `:130` | Key-management/rotation owner [OWNER TO CONFIRM] | (a) Name a clinic-side owner; link `docs/KEY_ROTATION.md` | after |
| `docs/data-protection/ROPA.md:17-25` | Controller contact / DPO placeholders | (a) Fill in; no developer contact to remove | after |

#### Historical notes (leave)

| file:line | what it says | action | when |
|---|---|---|---|
| `lib/build-backlog.ts:319` | Visual QA routine on repo `joekaulpulse/k-clinics` (BLOCKED task narrative) | (b) Leave; routine recreation handled above | leave |
| `lib/build-backlog.ts:398` | GitHub App setup: "Install App → only JoeKaulPulse/K-Clinics" | (b) Leave; App transfer handled above | leave |
| `lib/build-backlog.ts:520` | "the app token shares the JoeKaulPulse account with the automation" | (b) Leave | leave |
| `lib/build-backlog.ts:1591` | QA seed users on `kaulindustries.com` (shipped) | (b) Leave; seed cleanup handled above | leave |
| `lib/build-backlog.ts:3846` | BLD-1304 owner instructions: "Click the team named KAUL, then the project named k-clinics … Storage → Create → Blob, Private" | (b) Leave the file, but post a corrected board comment on BLD-1304 once the project sits under the clinic's team (create the private Blob store as part of the move) | after |
| `docs/PLATFORM_SAAS_PLAN.md:3`, `:317`; `docs/audit-2026-06/VALUATION.md:3` | "Owner: Joe Kaul"; "(J. Kaul)"; "For: Joe Kaul" | (b) Leave (optional one-line ownership note) | leave |
| `audit/academy-portal-visual-audit.md:218-222` | QA academy account is "the owner's own joe@ account" (XP, progress rows, badge in production) | (c) Deactivate/delete that academy account at handover; the doc itself stays | after |

## Appendix D — Environment variable catalogue

Scope: every `process.env.NAME` under `app/`, `lib/`, `components/`, `middleware.ts`, `next.config.mjs`, `instrumentation*.ts`, `sentry*.ts`, `scripts/`, `prisma/` and `prisma.config.ts` (136 distinct names), plus names that only appear in `.env.example`, in `lib/secrets.ts` `SECRET_DEFS` (read through `getSecret()`, which prefers an encrypted `ManagedSecret` row and falls back to `process.env`), in `lib/marketing-connections.ts`, or in docs.

Column key. **Set today**: V-Prod = Vercel Production (required by code in production; the Vercel API does not return the env listing, so confirm with `vercel env ls production`); V-opt = Vercel, optional feature, presence unconfirmed; Neon/Blob/Upstash = injected by that Vercel integration; CC = Joe's Claude Code environment (tooling only); GHA = GitHub Actions workflow; Local = local scripts only; Sys = Vercel/Next build-time. **DB** = can be stored encrypted in the database via Admin > Settings > Credentials (`lib/secrets.ts` `SECRET_DEFS`, non-`envOnly`). **NP** = `NEXT_PUBLIC_` (inlined into the browser bundle at build time). Note that *every* Vercel env change needs a redeploy to reach the serverless functions; NP additionally needs a rebuild. `ManagedSecret` rows travel with the database and stay readable only if the keyring below is preserved.

#### 1. DATA-BOUND — copy byte-for-byte or data becomes unreadable

| Variable | Set today | Issued by | Read at | NP | Side-effect if changed | DB |
| --- | --- | --- | --- | --- | --- | --- |
| `HEALTH_ENCRYPTION_KEY` | V-Prod | generated (`openssl rand -hex 32`) | `lib/crypto.ts:47-53,73`; `lib/kiosk.ts:86`; `app/api/health/route.ts:70`; `lib/integrations.ts:279`; `app/api/build/migrate-wp/route.ts:94` | no | Everything under the keyring becomes unreadable: `HealthAssessment.cipher`, consent records (`lib/consent.ts:232`), clinical free-text columns (`lib/clinical-crypto.ts`), all OAuth tokens in `ExternalConnection.tokensEnc` (`lib/oauth-connections.ts:28`), `AdminUser.googleRefreshToken`, `AdminUser.totpSecret` (2FA, `lib/security/twofa.ts:30`), `ManagedSecret.valueEnc`, `CallRecord.raw`, chat/AI payloads. Also the kiosk salt is derived from it when `KIOSK_IP_SALT` is unset. Rotation only via `docs/KEY_ROTATION.md` (old value into `_KEYS_OLD`, redeploy, wait for 0 remaining). | no |
| `HEALTH_HMAC_KEY` | V-Prod (optional) | generated | `lib/crypto.ts:78-82`; `app/api/health/route.ts:71`; `lib/integrations.ts:290` | no | Integrity checks fail on existing records. If it is unset today the AES ring doubles as the HMAC ring, so do **not** introduce it fresh at handover; if introduced later, put the AES key value into `HEALTH_HMAC_KEYS_OLD` at the same time. | no |
| `HEALTH_ENCRYPTION_KEYS_OLD` | V-Prod only mid-rotation | previous key | `lib/crypto.ts:55-59,73`; `lib/key-rotation.ts:240` | no | Old ciphertext undecryptable if dropped before the sweep reports 0 remaining. | no |
| `HEALTH_HMAC_KEYS_OLD` | probably unset | previous key | `lib/crypto.ts:81`; `.env.example:29` | no | As above for HMAC. | no |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | V-opt | `npx web-push generate-vapid-keys` | `lib/push.ts:11,20,21` | no | Rotation invalidates every `PushSubscription` row (`prisma/schema.prisma:4312`); staff must re-enable notifications. | no |
| `KIOSK_IP_SALT` | probably unset (derived) | generated | `lib/kiosk.ts:84-87` | no | Resets per-IP kiosk anti-abuse counters and the per-device hash on `KioskSession` rows. Resolution: `KIOSK_IP_SALT` > `ENCRYPTION_KEY` > sha256(`HEALTH_ENCRYPTION_KEY`) > sha256(`ADMIN_JWT_SECRET`) > throw in production. Preserving the health key preserves today's salt. | no |
| `ENCRYPTION_KEY` | almost certainly unset | legacy | `lib/kiosk.ts:84` | no | Legacy alias for the salt; confirm absent, do not add. | no |

#### 2. ACCOUNT-BOUND — re-issued from the clinic's own provider account

| Variable | Set today | Issued by | Read at | NP | Notes / side-effect | DB |
| --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` | Neon (Vercel integration); `DATABASE_URL` also CC (read-only role) | Neon | `lib/db.ts:39-47` (runtime prefers `POSTGRES_PRISMA_URL`), `scripts/db-sync.mjs:73-83` (schema sync prefers `POSTGRES_URL_NON_POOLING`), `lib/crm.ts:12-27`, `prisma.config.ts:20`, `app/api/cron/daily/route.ts:344` (region check), seeds, `scripts/restore.mjs:121` | no | Unchanged if the Neon project transfers normally; all five change if a new project must be created (Vercel-managed Neon orgs cannot be transferred). Revoke Joe's read-only role either way. | no |
| `BLOB_READ_WRITE_TOKEN` | Blob (Vercel Storage) | Vercel | 18 sites: `lib/kiosk.ts:147`, `lib/portfolio-blob.ts:67`, `lib/api-health.ts:102`, `app/api/admin/blob-upload/route.ts:20`, `app/api/admin/media/route.ts:33`, `app/api/kiosk/sessions/[token]/photo(s)/route.ts`, `app/api/cron/daily/route.ts:274`, `app/api/kiosk/test-cleanup/route.ts:33` … | no | A new store means new URLs; `MediaAsset` and other rows holding `*.public.blob.vercel-storage.com` URLs must be copied and rewritten (separate task; opportunity to provision private, BLD-1304). | no |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Upstash (Marketplace) | Upstash | `lib/security/rate-limit.ts:9`; `lib/api-health.ts:115-116` | no | Transfer the Marketplace resource or provision anew; counters are ephemeral, Postgres fallback in between. | no |
| `SENTRY_DSN` | V-opt (recommended) | Sentry | `sentry.server.config.ts:3`; `sentry.edge.config.ts:3`; `instrumentation.ts:4`; `lib/api-health.ts:450` | no | Transfer project (same region) or create new org; releases/session data not transferred. | no |
| `NEXT_PUBLIC_SENTRY_DSN` | V-opt | Sentry | `instrumentation-client.ts:3`; `lib/api-health.ts:451` | **yes** | Same DSN; rebuild. | no |
| `TURNSTILE_SECRET_KEY` | V-Prod | Cloudflare | `lib/security/guard.ts:117,131` | no | Fails closed in production: admin/client login CAPTCHA rejected until set. Widgets are per Cloudflare account. | no |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | V-Prod | Cloudflare | `app/api/admin/login/route.ts:40`; `app/api/account/login/route.ts:19` | **yes** | Rebuild. | no |
| `RESEND_API_KEY` | V-Prod or DB | Resend | `lib/email.ts:91`; `lib/api-health.ts:146` | no | New key after the Domain Claim into the clinic's Resend team. | yes |
| `ANTHROPIC_API_KEY` | V-Prod or DB; also CC | Anthropic | `lib/chat-ai.ts:212`; `lib/kiosk-ai.ts:123,324`; `lib/ai-consultation.ts:85`; `lib/ai-marketing.ts:26`; `app/api/admin/seo/route.ts:78`; `app/api/admin/bookings/transcribe/route.ts:77`; `.claude/hooks/session-start.sh:106` | no | Issue from a clinic-owned console; revoke old. | yes |
| `DEEPGRAM_API_KEY` | DB or V-opt | Deepgram | `app/api/admin/bookings/transcribe/route.ts:23`; `lib/api-health.ts:231` | no | | yes |
| `STRIPE_SECRET_KEY` | V-Prod | Stripe | `lib/stripe.ts:4`; `lib/api-health.ts:127`; `lib/finance-feeds.ts:24` | no | Env-only by design (`lib/secrets.ts:56`). Roll the key even if the account stays the clinic's. | no (envOnly) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | V-Prod | Stripe | `lib/stripe-client.ts:5`; `lib/booking-mode.ts:11` | **yes** | A placeholder value silently flips booking into demo mode. | no (envOnly) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | V-Prod and/or DB | Google Cloud project "KClinics" (clinic-owned; Joe Owner) | env-only path `lib/google-calendar.ts:28,51,70-72,89-90`; getSecret path `lib/google-sso.ts:25,56,75,98`, `lib/google-business.ts:43,62,77`, `lib/ad-spend.ts:70`, `lib/google-auth.ts:10`, `lib/marketing-connections.ts:39` | no | Keep the client ID (stored refresh tokens stay valid), rotate the secret after Joe's Owner role is removed; keep env and DB copies in step. | yes (Calendar path still reads env) |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_TRANSLATE_KEY` | DB or V-opt | Google Cloud (clinic project) | `lib/reviews-aggregate.ts:104`; `lib/translate.ts:21`; `lib/api-health.ts:187,218` | no | Regenerate after access clean-up. | yes |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | DB or V-opt | Google Ads MCC | `lib/ad-spend.ts:63`; `lib/google-ads-conversions.ts:27,38` | no | Confirm the MCC is the clinic's. | yes |
| `GOOGLE_WORKSPACE_SA_KEY` | DB | Google Cloud service account | `lib/google-workspace.ts:19,59` | no | Rotate the SA key; pair with `GOOGLE_WORKSPACE_ADMIN_EMAIL` (currently likely `webmaster@`, Joe's identity — change to Inna's Super Admin). | yes |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | V-opt or DB | Twilio | `instrumentation.ts:10` (boot warning); `lib/sms.ts:10-40`; `lib/api-health.ts:167-168` | no | Transfer Twilio ownership or re-create; rotate token. | yes |
| `XERO_CLIENT_ID` / `_SECRET` | DB or V-opt | Xero developer app | `lib/xero.ts:20-35` | no | If the app is registered under Joe, re-create and re-connect (stored tokens are per client). | yes |
| `TRUELAYER_CLIENT_ID` / `_SECRET` | DB or V-opt | TrueLayer console | `lib/truelayer.ts:13-31` | no | As Xero. | yes |
| `META_CLIENT_ID` / `_SECRET`, `TIKTOK_CLIENT_ID` / `_SECRET` | V-opt (env-only; not in `SECRET_DEFS`) | Meta / TikTok developer apps | `lib/marketing-connections.ts:61,77` | no | Confirm whether set and whose developer account owns the apps. | no |
| `YAY_AUTH_RESELLER` / `YAY_AUTH_PASSWORD` | V-opt | yay.com (clinic) | `lib/yay.ts:223-225`; `lib/api-health.ts:315` | no | Rotate password; egress IP allow-list in yay may need the new deployment's IPs. | no |
| `HOSTINGER_CALDAV_URL` / `_USER` / `_PASS` | V-opt | Hostinger (clinic) | `lib/hostinger-calendar.ts:15-17`; `lib/api-health.ts:294-296` | no | Deprecated after the Workspace move; revoke the app password when removed. | no |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` | V-Prod | GitHub App "kclinics-board" (JoeKaulPulse) | `lib/github-app.ts:22,29,36,50` | no | Transfer the App to the clinic account (ID survives), generate a new private key, re-install on the transferred repo (new installation id). Cached token in `Setting` key `github_app_token`. | no |
| `GITHUB_TOKEN` | V-opt (PAT fallback) | GitHub (Joe) | `lib/build-board.ts:767` | no | Remove; revoke; also clear the encrypted `github` `ExternalConnection` row (`lib/build-board.ts:750-754`). | no |
| `CLAUDE_ROUTINE_FIRE_URL` / `_TOKEN` | V-Prod | Claude Code Routine (Joe's Anthropic account) | `lib/build-board.ts:1112,1139-1140` | no | Remove at handover (board falls back to GitHub-issue wake); Joe deletes the Routine. | no |
| `CRON_ALERT_WEBHOOK_URL` | V-opt | Slack/Discord/Make workspace (probably Joe's) | `app/api/cron/daily/route.ts:521`; `app/api/cron/dispatch/route.ts:58`; `app/api/cron/kiosk-cleanup/route.ts:152`; `app/api/health/route.ts:154`; `app/api/admin/api-health/route.ts:90`; `app/api/stripe/webhook/route.ts:509` | no | Replace with a clinic-owned webhook or unset. | no |
| `TENOR_API_KEY` / `GIPHY_API_KEY` | V-opt | Google / GIPHY | `app/api/admin/team-chat/gifs/route.ts:53-54` | no | Re-issue or drop. | no |
| `NEON_API_KEY` / `NEON_PROJECT_ID` | Local | Neon | `scripts/safe-migrate.mjs:61-62` | no | Tooling only; Joe revokes. | no |

#### 3. ROTATE-AT-HANDOVER — secrets the developer has seen; regenerate freely

| Variable | Set today | Read at | Side-effect of rotation | DB |
| --- | --- | --- | --- | --- |
| `ADMIN_JWT_SECRET` | V-Prod | `lib/auth-edge.ts:48-55`; `lib/webauthn.ts:47`; `lib/kiosk.ts:86`; `instrumentation.ts:18-21` (must be 32+ bytes) | All staff signed out; in-flight passkey ceremonies fail. No data impact while `HEALTH_ENCRYPTION_KEY` is set. | no |
| `CLIENT_JWT_SECRET` | V-Prod | `lib/auth-edge.ts:57-64` | All client-portal users signed out. | no |
| `ACADEMY_JWT_SECRET` | V-Prod | `lib/auth-edge.ts:87-94` | All academy students signed out. | no |
| `CRON_SECRET` | V-Prod (also Joe's local healthcheck env) | `lib/cron-auth.ts:22`; `middleware.ts:141`; `app/api/blocked-ips/route.ts:16`; `scripts/healthcheck.mjs:34` | None; Vercel Cron picks up the env value automatically. | no |
| `MW_BLOCK_SECRET` | V-opt | `middleware.ts:141`; `app/api/blocked-ips/route.ts:16` | None (falls back to `CRON_SECRET`). | no |
| `BOARD_QUEUE_TOKEN` (= `QA_TOKEN` in CC) | V-Prod + CC | `app/api/build/queue/route.ts:15,25,53`; `app/api/kiosk/test-cleanup/route.ts:13,21`; `lib/build-board.ts:1121` | Joe's Claude environment loses queue access (intended). | no |
| `GOOGLE_REVIEW_IMPORT_TOKEN` | V-opt | `app/api/admin/reviews/google/import/route.ts:15` | None. | no |
| `MIGRATE_TOKEN` | V-opt (should be absent) | `app/api/build/migrate-wp/route.ts:48,81` | Leave unset; endpoint is already refused on production (`:66,79`). | no |
| `RESEND_WEBHOOK_SECRET` | V-Prod | `app/api/webhooks/resend/route.ts:32` | Re-create the endpoint in the clinic's Resend team; fails closed (503) while unset. | no |
| `RESEND_INBOUND_SECRET` | V-Prod | `app/api/webhooks/chat-inbound/route.ts:49` | Re-create the inbound webhook; falls back to `RESEND_WEBHOOK_SECRET`. | no |
| `STRIPE_WEBHOOK_SECRET` | V-Prod | `app/api/stripe/webhook/route.ts:27`; `lib/api-health.ts:135` | New endpoint / rolled secret in Stripe; delete the old endpoint. | no |
| `YAY_WEBHOOK_SECRET` | V-Prod | `app/api/integrations/yay/route.ts:9,22`; `lib/api-health.ts:312` | Update the Auth Token in each yay.com hook. | no |
| `INDEXNOW_KEY` | V-opt | `lib/indexnow.ts:12`; `app/indexnow-key.txt/route.ts:7` | None (served publicly). | no |
| `GITHUB_APP_PRIVATE_KEY` | V-Prod | `lib/github-app.ts:29` | Also account-bound; regenerate after transfer. | no |
| `SEED_ADMIN_PASSWORD`, `SEED_QA_PASSWORD`, `DEMO_PASSWORD` | should be absent from Vercel | `prisma/seed.mjs:10,27`; `scripts/seed-demo-users.mjs:32` | Confirm absent; deactivate `qa-*@kaulindustries.com` and demo `AdminUser` rows. | no |
| `QA_ADMIN_EMAIL` / `QA_ADMIN_PASSWORD`, `QA_ACADEMY_LOGIN` / `QA_ACADEMY_PASSWORD` | CC | `scripts/visual-qa-admin.mjs:19-20`; `scripts/chat-audit.mjs:15-16`; CLAUDE.md | Deactivate or reset those accounts. | no |

#### 4. CONFIG — non-secret

| Variable | Set today | Read at | NP | Notes | DB |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | V-Prod | 51 sites incl. `middleware.ts:133`, `lib/webauthn.ts:25` (passkey RP ID), `lib/tenant.ts:25` | **yes** | Must stay `https://kclinics.co.uk`; a host change invalidates every passkey and OAuth redirect. | no |
| `NEXT_PUBLIC_BASE_URL` | V-opt (legacy alias) | `lib/academy-auth.ts:270`; `lib/academy-payments.ts:116`; `lib/forum.ts:144`; `lib/lms.ts:416,474`; `lib/notifications.ts:122` | **yes** | Leave unset unless set today. | no |
| `NEXT_PUBLIC_CRM_ENABLED`, `CRM_ENABLED` | V-Prod (`true`); GHA sets `false` for Pages | `lib/crm.ts:13-14` | yes / no | | no |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | V-Prod or DB | `lib/email.ts:98-99` | no | Defaults derive from the site host. | yes |
| `CLINIC_NOTIFY_EMAIL`, `ACADEMY_NOTIFY_EMAIL`, `CAREERS_NOTIFY_EMAIL` | V-Prod / V-opt | `lib/booking-notify.ts:7`; `app/api/academy/apply/route.ts:97`; `app/api/careers/apply/route.ts:44` | no | Confirm Workspace mailboxes. | no |
| `CHAT_INBOUND_DOMAIN`, `EMAIL_SEND_DOMAIN` | V-opt | `lib/chat-email.ts:32-33` | no | Defaults `reply.mail.<host>` / `mail.<host>`. | no |
| `GOOGLE_REDIRECT_URI`, `GOOGLE_SSO_REDIRECT_URI`, `XERO_REDIRECT_URI`, `TRUELAYER_REDIRECT_URI` | V-Prod / V-opt | `lib/google-calendar.ts:28`; `lib/google-sso.ts:51`; `lib/xero.ts:24`; `lib/truelayer.ts:17` | no | Only `GOOGLE_REDIRECT_URI` is required; others default from the site URL. | no |
| `GOOGLE_INTEGRATION_ENABLED`, `GOOGLE_SSO_ENABLED` | V-Prod | `lib/google-calendar.ts:37`; `lib/google-sso.ts:30` | no | Flags. | no |
| `GOOGLE_SSO_ALLOWED_DOMAINS` | probably unset | `lib/google-sso.ts:37-41` | no | **Code default includes `kaulindustries.com`.** Set explicitly to `kclinics.co.uk` and change the default. | no |
| `GOOGLE_PLACE_ID`, `GOOGLE_BUSINESS_ACCOUNT_ID`, `GOOGLE_BUSINESS_LOCATION_ID` | V-Prod / DB | `lib/google-business.ts:46-47,56` | no | Identifiers. | Place ID yes |
| `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `GOOGLE_ADS_CONVERSION_ACTION_ID`, `GA4_PROPERTY_ID`, `SEARCH_CONSOLE_SITE`, `GOOGLE_WORKSPACE_ADMIN_EMAIL`, `GOOGLE_WORKSPACE_CUSTOMER_ID` | DB | `lib/ad-spend.ts`; `lib/google-ads-conversions.ts`; `lib/ga4-data.ts:17`; `lib/search-console.ts:23`; `lib/google-workspace.ts` | no | Travel with the DB; admin email must move off `webmaster@`. | yes |
| `TWILIO_FROM` | DB / V-opt | `lib/secrets.ts:69` default `+447828877444` | no | | yes |
| `YAY_AUTH_USER`, `YAY_API_BASE` | V-opt | `lib/yay.ts:12,224` | no | | no |
| `GITHUB_REPO` | V-Prod | `lib/build-board.ts:758` | no | Becomes the new `owner/name` after transfer. | no |
| `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | V-opt | `lib/tracking.ts:40-42` (defaults `G-EC16PXFXN0`, `AW-17853644523`, `872329642090480` at `:26,37-38`) | **yes** | Confirm the properties are clinic-owned; defaults live in code. | no |
| `NEXT_PUBLIC_WHATSAPP` | V-opt | `components/layout/WhatsAppButton.tsx:11` | **yes** | | no |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `YANDEX_VERIFICATION` | V-opt | `app/layout.tsx:47-49` | no | Tokens tied to the Search Console / Bing account owner; add Inna as owner before Joe leaves. | no |
| `VAPID_SUBJECT` | V-opt | `lib/push.ts:14` (default `mailto:support@kclinics.co.uk`) | no | | no |
| `SLOT_INTERVAL_MIN`, `AI_MONTHLY_CAP`, `AI_DISABLE_ESCALATION`, `COURSE_FINANCE_URL`, `CONSULT_BACKFILL_EMAILS` | V-opt | `lib/availability.ts:9`; `lib/ai-consultation.ts:18,130`; `app/(marketing)/academy/funding/page.tsx:30`; `lib/consult-notify-backfill.ts:52` | no | | no |
| `DB_APPROVED_REGIONS` | probably unset | `app/api/cron/daily/route.ts:345` (default `eu-west-2`) | no | Nightly cron fails if the Neon host leaves the list. | no |
| `USE_MIGRATIONS`, `DB_SYNC_NONFATAL`, `SEED_ON_BUILD`, `CSP_DISABLED`, `HEALTH_KEY_REENCRYPT`, `ACADEMY_RLS` | V-Prod (`USE_MIGRATIONS=true` expected); others unset | `scripts/db-sync.mjs:86,97`; `scripts/run-seeds.mjs:10`; `next.config.mjs:42`; `lib/key-rotation.ts:240`; `lib/db.ts:68` | no | Build/behaviour flags; copy `USE_MIGRATIONS` before the first production deploy. | no |

#### 5. SYSTEM — provided by Vercel/Next or by the GitHub Actions workflow

| Variable | Provided by | Read at |
| --- | --- | --- |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA` | Vercel | `lib/db.ts:131,160`; `scripts/db-sync.mjs:114`; `app/api/health/route.ts:24-31`; `lib/build-board.ts:171`; `lib/platform-status.ts:174-175` |
| `NODE_ENV`, `NEXT_RUNTIME`, `NEXT_PHASE` | Next.js | 33 / 3 / 2 sites (`lib/crypto.ts:50`, `instrumentation.ts:2,26,55`, `lib/db.ts:130`) |
| `GHPAGES`, `PAGES_BASE_PATH` | `.github/workflows/deploy.yml:66-67` (manual Pages demo) | `next.config.mjs:5-6`; `scripts/db-sync.mjs:38` |
| `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_STATIC_DEMO` (NP) | derived in `next.config.mjs:182` | `components/ui/BeforeAfter.tsx:7`; `lib/treatment-images.ts:18`; `lib/static-demo.ts:7` |
| `GITHUB_TOKEN` (Actions) | `.github/workflows/security.yml:47` | Actions-provided; unrelated to the Vercel PAT of the same name |

#### 6. TOOLING — Claude Code environment or local scripts only

`BASE_URL`, `QA_TOKEN`, `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`, `QA_ACADEMY_LOGIN`, `QA_ACADEMY_PASSWORD`, `QA_IGNORE_HTTPS_ERRORS`, `QA_BROWSER_DIRECT`, `QA_CHROMIUM_PATH`, `QA_DM_TO`, `QA_OUT`, `QA_SELFIE` (`scripts/visual-qa.mjs:28-68`, `scripts/visual-qa-admin.mjs:15-34`, `scripts/chat-audit.mjs:14-19`, `.claude/hooks/session-start.sh:105-127`); `DATABASE_URL` (read-only role) and `ANTHROPIC_API_KEY` in the same environment; `ADMIN_SHOTS_BASE/EMAIL/PASSWORD/OUT` (`scripts/admin-shots.mjs:13-16`); `SHOTS_DIR` (`scripts/brand/build-activation-guide.mjs:13`); `SEED_ADMIN_EMAIL/NAME` (`prisma/seed.mjs:9,11`); `SEED_QA_ROLES` (`prisma/seed.mjs:26`); `NEON_API_KEY`, `NEON_PROJECT_ID`; `HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS`, `PLAYWRIGHT_BROWSERS_PATH`. None belong in Vercel. If the clinic keeps a Claude Code environment of its own it needs `BASE_URL`, a fresh `BOARD_QUEUE_TOKEN`/`QA_TOKEN`, fresh QA logins and a new read-only DB role; Joe's environment must lose all of them.

#### 7. DEPRECATED / UNUSED

| Variable | Where | Action |
| --- | --- | --- |
| `PRISMA_DATABASE_URL`, `ACCELERATE_URL` | `lib/db.ts:30-31`; `lib/platform-status.ts:34` | Prisma Accelerate path, not in production; never set. |
| `ENCRYPTION_KEY` | `lib/kiosk.ts:84` | Legacy salt alias; confirm absent. |
| `DEEPL_API_KEY`, `DEEPL_API_FREE` | `lib/secrets.ts:28` ("No longer used"); `.env.example:151-152` | Drop; clear any `ManagedSecret` row. |
| `BOOKING_TIMEZONE` | `.env.example:81` only | No code reads it. |
| `SENDER_EMAIL` | `docs/DEPLOY.md:80` only | Doc error; should read `EMAIL_REPLY_TO`. |
| `WORDPRESS_API_URL` | `docs/INTEGRATIONS.md` only | Headless WordPress removed. |
| `MIGRATE_TOKEN` | `app/api/build/migrate-wp/route.ts:48` | WP import complete; leave unset. |
| `TYL_API_KEY`, `TYL_MERCHANT_ID` | `lib/terminal.ts:45` | Stub provider; never set. |
| `HOSTINGER_CALDAV_*` | `lib/hostinger-calendar.ts:15-17` | Remove after the Workspace move. |
| `GITHUB_TOKEN` (Vercel PAT) | `lib/build-board.ts:767` | Superseded by the GitHub App; remove and revoke. |
| `CLAUDE_ROUTINE_FIRE_URL/_TOKEN` | `lib/build-board.ts:1112` | Joe's account; remove. |
| `CONSULT_BACKFILL_EMAILS` | `lib/consult-notify-backfill.ts:52` | One-off backfill override. |

#### Code-level identities that are not env vars but must change at handover

- `lib/google-sso.ts:38` default allowed domains include `kaulindustries.com`.
- `lib/tracking.ts:26,37-38` hard-coded GA4 / Google Ads / Meta Pixel IDs.
- `lib/secrets.ts:69` default Twilio sender `+447828877444`; `lib/push.ts:14` default VAPID subject `support@kclinics.co.uk`.
- `prisma/seed.mjs:30-33` QA users at `qa-*@kaulindustries.com` (only when `SEED_QA_ROLES=true`); check `AdminUser` for any `@kaulindustries.com` rows and deactivate.
- `docs/DEPLOY.md:80` (`SENDER_EMAIL`) and `.env.example` (`BOOKING_TIMEZONE`, `DEEPL_*`) are stale.

#### How to export the current values safely

1. Joe, on his own machine, links the project and pulls production values into a local file: `vercel link` then `vercel env pull .env.handover --environment=production` (Preview separately if anything differs). This is the only complete source; the dashboard hides sensitive values once saved.
2. Confirm the set of names against this catalogue with `vercel env ls production` and record any name that is present but not listed here, or listed here but absent.
3. Hand the file over through a password-manager shared vault (1Password/Bitwarden) or a one-time, expiring secret link; never by email, WhatsApp, Google Doc or board comment. Split it: the DATA-BOUND block goes in its own item labelled "never rotate without the runbook".
4. Inna (or whoever sets up the new Vercel project) enters DATA-BOUND and CONFIG values verbatim, ACCOUNT-BOUND values from the clinic's new provider accounts, and generates every ROTATE-AT-HANDOVER value fresh (`openssl rand -base64 32` for JWT/keys, `openssl rand -hex 24` for tokens). `NEXT_PUBLIC_*` and the Stripe pair must be present before the first build.
5. After the new deployment is verified (`/api/health` with the new `CRON_SECRET`, Admin > Integrations all green, `node scripts/healthcheck.mjs`), Joe deletes `.env.handover`, the Vercel CLI link, and every local `.env` / `scripts/migrate-wp/.env`, then revokes his side: Neon read-only role and API key, GitHub PAT, Claude Routine, Anthropic key, Slack webhook, and removes the Claude Code environment variables.
6. Keep an offline copy of the DATA-BOUND block (health keyring, VAPID pair, kiosk salt if set) in the clinic's vault as the backup the runbook requires; env vars are configuration, not a backup.

## Appendix E — External registrations to re-check at cutover

Scope: everything a third party holds about this deployment (inbound webhook URLs, OAuth redirect URIs, DNS records, verification tokens, API credentials, egress-IP allow-lists) and what each depends on. Dependency key: **Domain** = unchanged as long as `kclinics.co.uk` and `NEXT_PUBLIC_SITE_URL` stay; **Vercel** = tied to the Vercel project/team; **Credential** = re-issued if the provider account/team changes; **Account** = tied to a person's account and must be re-homed.

Every registered URL in the codebase is built from `lib/site.ts:14` (`https://kclinics.co.uk`) or `NEXT_PUBLIC_SITE_URL`; nothing reads `VERCEL_URL` or a `*.vercel.app` host. Live checks on 2026-09-06: `/api/health` ok (production), `/api/integrations/yay` reports `configured:true`, `/indexnow-key.txt` 404 (IndexNow key unset), no search-engine verification meta tags in the HTML, `x-vercel-id` shows `lhr1` execution, `server: Vercel` with no Cloudflare proxy headers.

#### Two supplied facts that live DNS contradicts

| Fact as supplied | What DNS shows today | Consequence for the plan |
| --- | --- | --- |
| DNS zone on Cloudflare | NS = `apollo.dns-parking.com`, `athena.dns-parking.com` (Hostinger DNS); site served directly by Vercel (no `cf-ray`) | DNS edits happen in the clinic's Hostinger hPanel. Decision D8 / sections 5.10 and 7.9 of `docs/ACCOUNT_MIGRATION_HANDOVER.md` (lines 189-195, 468-476, 846) and `lib/go-live.ts:124` assume Cloudflare; confirm with Joe whether a nameserver move is planned or the text is wrong. Cloudflare then matters only for Turnstile. |
| Resend Inbound on `reply.mail.kclinics.co.uk` | `mail.kclinics.co.uk` MX 10 `inbound-smtp.eu-west-1.amazonaws.com` (Resend Inbound) + `resend._domainkey.mail` DKIM; `send.mail` SPF `include:amazonses.com` + MX `feedback-smtp.eu-west-1.amazonses.com`; `reply.mail.kclinics.co.uk` is a CNAME to `links1.resend-dns.com` (Resend link tracking) and cannot carry MX | The code default `reply.mail.<host>` (`lib/chat-email.ts:33`) and `EMAIL_REPLY_TO` default `replies@reply.mail.<host>` (`lib/email.ts:99`) are only deliverable if `CHAT_INBOUND_DOMAIN` and `EMAIL_REPLY_TO` are set in Vercel to `mail.kclinics.co.uk` / a real mailbox (`.env.example:58-61` says exactly that). Confirm the values (names only) before cutover. |

Other apex records to preserve verbatim if the zone is ever exported: `google-site-verification` TXT (Search Console domain property), `facebook-domain-verification` TXT (Meta Business), `google-gws-recovery-domain-verification` TXT, MX `smtp.google.com`, `_dmarc` (p=none). Aside: apex SPF still says `include:_spf.mail.hostinger.com` and `google._domainkey` is absent, so Workspace sending auth from `docs/GOOGLE_WORKSPACE_MIGRATION.md` §Phase 4 is not finished. `cms.kclinics.co.uk` does not resolve (`WORDPRESS_API_URL` unused).

#### Checklist table

| # | Registration | Exact URL / host in code | Where it is registered | Depends on | Cutover action | Done when |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Stripe payment webhook | `https://kclinics.co.uk/api/stripe/webhook` (`app/api/stripe/webhook/route.ts:25-36`); Checkout return URLs from `NEXT_PUBLIC_SITE_URL` (`app/api/admin/bookings/session/route.ts:202-203`) | Stripe → Developers → Webhooks; Payment Element wallets need kclinics.co.uk under Stripe → Payment method domains | Domain; Credential (`STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, env-only per `lib/secrets.ts:56-57`) | Owner transfer: nothing. New Stripe account: new endpoint + three keys + redeploy | Test event shows 2xx in Stripe; API health `stripe` green |
| 2 | Resend delivery webhook | `https://kclinics.co.uk/api/webhooks/resend` (`app/api/webhooks/resend/route.ts:14-40`) | Resend → Webhooks (`.env.example:50-53`) | Domain; Credential (`RESEND_WEBHOOK_SECRET`, `RESEND_API_KEY`) — webhooks are per Resend team | If team changes: re-create endpoint, set new signing secret and API key | EmailEvent rows update after a test send |
| 3 | Resend Inbound (chat replies) | `https://kclinics.co.uk/api/webhooks/chat-inbound` (`app/api/webhooks/chat-inbound/route.ts:46-56`); addresses `chat-<token>@<CHAT_INBOUND_DOMAIN>` (`lib/chat-email.ts:32-33,58`) | Resend → Domains/Inbound; MX/DKIM/SPF/CNAME on `mail.`, `send.mail.`, `reply.mail.` in the Hostinger zone | Domain + DNS records; Credential (`RESEND_INBOUND_SECRET` or `RESEND_WEBHOOK_SECRET`) | Preserve subdomain records; confirm `CHAT_INBOUND_DOMAIN`/`EMAIL_REPLY_TO` values; if team changes use Domain Claim then re-create the inbound route | Reply to a chat transcript email threads into `/admin` chat |
| 4 | yay.com Call Ended + Voicemail Notify | `https://kclinics.co.uk/api/integrations/yay` POST; token in `Authorization: Bearer`, `X-Auth-Token` or body (`app/api/integrations/yay/route.ts:21-40`; `?token=` is rejected, lines 27-29) | yay.com → Web Hooks, Auth Token = `YAY_WEBHOOK_SECRET` (`docs/twilio-yay/build-pdf.cjs:63-67,106-107`) | Domain; secret transfers with env | None expected | Test call appears in Admin → Calls; API health `yay` fresh |
| 5 | yay.com click-to-dial egress IP | `${YAY_API_BASE:-https://api.yay.com}/calls/click-to-dial` (`lib/yay.ts:12,228-240`) with `YAY_AUTH_RESELLER/USER/PASSWORD` | yay → Allowed IP ranges (`lib/yay.ts:213-216`; `docs/twilio-yay/build-pdf.cjs:80,109`) | Vercel egress IP pool (dynamic; region `lhr1` per `vercel.json:3`, no static IP without Secure Compute) | Expect breakage; test after cutover; widen or drop the yay allow-list, or accept no click-to-dial | Click-to-dial rings the extension, or decision recorded |
| 6 | Vercel Cron (5 jobs) | `/api/cron/daily`, `/api/cron/dispatch`, `/api/cron/kiosk-cleanup`, `/api/health`, `/api/admin/api-health` (`vercel.json:4-25`); auth `Authorization: Bearer CRON_SECRET` or `x-cron-secret` (`lib/cron-auth.ts:21-29`) | Vercel project config (from repo) | Vercel (Pro needed for sub-daily schedules and 300 s `maxDuration`, `vercel.json:26-33`) | Target team on Pro with payment method; redeploy production after transfer | Vercel → Cron Jobs lists 5; API health `cron` heartbeats fresh |
| 7 | Vercel region | `regions: ["lhr1"]` (`vercel.json:3`); DB residency check `DB_APPROVED_REGIONS` default `eu-west-2` (`app/api/cron/daily/route.ts:345-348`) | Project config | Vercel plan (Pro allows region selection) | None; keep the DB in eu-west-2 | `x-vercel-id` contains `lhr1`; no DATA RESIDENCY log line |
| 8 | Middleware self-fetch | `${NEXT_PUBLIC_SITE_URL}/api/blocked-ips`, `/api/redirects` with `MW_BLOCK_SECRET`/`CRON_SECRET` (`middleware.ts:133,140-141`) | None (internal) | Domain | Keep `NEXT_PUBLIC_SITE_URL` | Blocked-IP feed loads (fails open otherwise) |
| 9 | Build-board queue (Claude Code environment) | `https://kclinics.co.uk/api/build/queue`, Bearer `BOARD_QUEUE_TOKEN` (`app/api/build/queue/route.ts:15-25`; `.claude/hooks/session-start.sh:98-118`) | Joe's Claude Code environment (`BASE_URL`, `QA_TOKEN`, `QA_ADMIN_*`, `QA_ACADEMY_*`, read-only `DATABASE_URL`, `ANTHROPIC_API_KEY`) | Domain; Account (Joe's Anthropic) | Rotate `BOARD_QUEUE_TOKEN`, `GOOGLE_REVIEW_IMPORT_TOKEN` (`app/api/admin/reviews/google/import/route.ts:9-19`), QA accounts and the read-only DB role; re-create the environment under the clinic if wanted | Old token returns 401 |
| 10 | Claude Code Routine | POST `CLAUDE_ROUTINE_FIRE_URL` with `CLAUDE_ROUTINE_FIRE_TOKEN` (`lib/build-board.ts:1111-1112,1138-1150`); GitHub-comment fallback lines 1173-1175 | Joe's Anthropic account (Routine) | Account | Unset both (routine stops) or re-create under a clinic Claude account | Board 'wake' either disabled or reaches the new routine |
| 11 | Google Calendar OAuth | `GOOGLE_REDIRECT_URI` = `https://kclinics.co.uk/api/admin/gcal/callback` (`lib/google-calendar.ts:21,28,52,72`; env only, `.env.example:94`) | Google Cloud → Credentials → OAuth client (clinic project 'KClinics') | Domain; GCP project (clinic's) | None; parked (`GOOGLE_INTEGRATION_ENABLED` off) | n/a until revived |
| 12 | Google SSO OAuth | `https://kclinics.co.uk/api/admin/oauth/google/callback` (`lib/google-sso.ts:50-51`, override `GOOGLE_SSO_REDIRECT_URI`); allowed domains default `kclinics.co.uk, kaulindustries.com` (`lib/google-sso.ts:36-41`) | Same OAuth client | Domain; identity (Joe's Workspace domain allowed by default) | Set `GOOGLE_SSO_ALLOWED_DOMAINS=kclinics.co.uk`; remove Joe's admin users | SSO with a kaulindustries.com account is refused |
| 13 | Google Business Profile OAuth | `https://kclinics.co.uk/api/admin/integrations/google-business/callback` (`lib/google-business.ts:35-39`; scope `business.manage` line 10; `GOOGLE_BUSINESS_ACCOUNT_ID/LOCATION_ID` env lines 27-28) | Same OAuth client + Business Profile API access on the GCP project | Domain; GCP project | Ensure a clinic identity is Owner on the GCP project and on the Business Profile | Connect Google Business succeeds on Reviews page |
| 14 | Marketing OAuth — Google Ads/GA4/GSC | `https://kclinics.co.uk/api/admin/marketing/oauth/callback?provider=google` (`lib/marketing-connections.ts:29,37,44,107`) | Same OAuth client | Domain; GCP project | None | Marketing → Connections shows Google connected |
| 15 | Marketing OAuth — Meta | `…/api/admin/marketing/oauth/callback?provider=meta` (`lib/marketing-connections.ts:52-66`; `META_CLIENT_ID/SECRET`) | developers.facebook.com → Facebook Login → Valid OAuth Redirect URIs; apex `facebook-domain-verification` TXT | Domain; Account (app/Business Manager owner unknown) | Confirm owner; transfer or re-create app, re-add URI, re-issue id/secret | Meta connect succeeds |
| 16 | Marketing OAuth — TikTok | `…/api/admin/marketing/oauth/callback?provider=tiktok` (`lib/marketing-connections.ts:73-81`; `TIKTOK_CLIENT_ID/SECRET`) | business-api.tiktok.com developer portal | Domain; Account (owner unknown) | Confirm owner; re-add URI if re-created | TikTok connect succeeds |
| 17 | Xero OAuth | `https://kclinics.co.uk/api/admin/integrations/xero/callback` (`lib/xero.ts:23-25`, override `XERO_REDIRECT_URI`) | developer.xero.com/app/manage → Redirect URIs | Domain; Account (developer app owner unknown) | Confirm owner; re-create app + URI + `XERO_CLIENT_ID/SECRET` if needed; reconnect | Xero connection light green |
| 18 | TrueLayer OAuth | `https://kclinics.co.uk/api/admin/integrations/truelayer/callback` (`lib/truelayer.ts:16-18`, override `TRUELAYER_REDIRECT_URI`) | console.truelayer.com → Redirect URIs | Domain; Account (owner unknown) | As Xero | Bank feed reconnects |
| 19 | Google Workspace service account | Admin SDK Directory scopes (`lib/google-workspace.ts:26-34`); `GOOGLE_WORKSPACE_SA_KEY`, `GOOGLE_WORKSPACE_ADMIN_EMAIL` (`lib/secrets.ts:50-52`) | admin.google.com → Security → API controls → Domain-wide delegation (client ID) | GCP project; impersonated admin (must not be webmaster@ after handover) | Set admin email to a clinic super-admin; rotate SA key when Joe leaves | `/admin` Workspace users list loads |
| 20 | GitHub App `kclinics-board` + repo slug | `api.github.com/app/installations/{GITHUB_APP_INSTALLATION_ID}/access_tokens` (`lib/github-app.ts:9-11,50`); `api.github.com/repos/{GITHUB_REPO}/issues` (`lib/build-board.ts:757-776,904`); PAT fallback `GITHUB_TOKEN` or saved connection | GitHub Developer settings (App owner); installation on the repo | Account (owner slug changes on transfer; installation id is per account; PAT is Joe's) | Set `GITHUB_REPO=<new-owner>/K-Clinics`; transfer App; reinstall; set new installation id; delete PAT | API health `github` green; mirror push works |
| 21 | Vercel ↔ GitHub link | Project Git link to `JoeKaulPulse/K-Clinics` (Vercel GitHub App on Joe's account); production branch `main` | Vercel → Settings → Git | Vercel + Account | Re-link to the transferred repo with the Vercel GitHub App installed on the clinic account | Push to `main` deploys to production |
| 22 | GitHub Pages demo | `https://<owner>.github.io/K-Clinics/` (manual `deploy.yml:7-8,60-62`; `next.config.mjs:206-208`) | GitHub Pages of the repo owner | Account (URL changes with owner; no redirect) | Re-run if the demo link is used anywhere | New Pages URL renders |
| 23 | Vercel custom domains | `kclinics.co.uk` A 216.150.1.1; `www` CNAME `fe8059f70f428825.vercel-dns-017.com`; no `_vercel` TXT | Vercel → Domains; Hostinger DNS | Vercel (transfer moves domains; a fresh project would need `_vercel` TXT verification) | Use project transfer, not re-create; leave DNS as is | Both hostnames verified; www redirects |
| 24 | `*.vercel.app` aliases | `k-clinics.vercel.app`, `k-clinics-kaul-joe.vercel.app`, `k-clinics-git-main-kaul-joe.vercel.app`; referenced only in `docs/DEPLOY.md:14,112` | Vercel | Vercel (team slug changes; SSO protection already blocks them for third parties) | Update docs; nothing external uses them | n/a |
| 25 | Vercel Blob store | Persisted `https://<store>.public.blob.vercel-storage.com/...` URLs, host-validated (`lib/portfolio-blob.ts:26`, `app/api/academy/pdf/route.ts:50`, `next.config.mjs:35,199-201`); `BLOB_READ_WRITE_TOKEN` | Vercel → Storage | Vercel (store must transfer with the project or every stored URL breaks) | Check `transferredStoreIds`/`resourceTransferErrors`; only then re-provision private for BLD-1304 | API health `blob` green; media loads |
| 26 | Upstash Redis | `UPSTASH_REDIS_REST_URL/TOKEN` (`lib/security/rate-limit.ts:9-11`) | Vercel → Storage (Marketplace) | Vercel (resource per team; falls back to Postgres if absent) | Transfer from resource settings or create anew on the clinic team | API health `redis` PONG |
| 27 | Neon Postgres | `-pooler` host via `POSTGRES_PRISMA_URL`/`DATABASE_URL` (`lib/db.ts:119-122`); `NEON_API_KEY`/`NEON_PROJECT_ID` in `scripts/safe-migrate.mjs:61-62` | Neon console / Vercel Storage | Credential (unchanged on Neon-native transfer; new on copy); region must stay eu-west-2 | Update the four Vercel vars only if the project is re-created; keep encryption keyring identical; re-issue Neon API key | `/api/health` `database:connected`; no residency error |
| 28 | Search Console verification | Apex `google-site-verification` TXT (DNS method); meta-tag env vars unused in prod (`app/layout.tsx:44-49`); API property `https://kclinics.co.uk/` or `SEARCH_CONSOLE_SITE` (`lib/search-console.ts:20-28`) | search.google.com/search-console; Hostinger DNS | Domain; Account (verifying Google account, likely webmaster@) | Add a clinic Google account as Owner before removing webmaster@; keep TXT | Clinic account sees the property |
| 29 | Bing / Yandex verification | `BING_SITE_VERIFICATION`, `YANDEX_VERIFICATION` meta (`app/layout.tsx:47-49`); none live | Bing Webmaster Tools | Domain | Optional | n/a |
| 30 | IndexNow | `https://api.indexnow.org/indexnow` with `keyLocation https://kclinics.co.uk/indexnow-key.txt` (`lib/indexnow.ts:25,31`; `app/indexnow-key.txt/route.ts:7-8`) | None (self-served key); live 404 = unset | Domain | Nothing; optionally set `INDEXNOW_KEY` | Key file returns 200 |
| 31 | GA4 / Google Ads / Meta pixels + CAPI | gtag.js, fbevents.js (`components/marketing/TrackingScripts.tsx:46-60`); `google-analytics.com/mp/collect`, `graph.facebook.com/v23.0/{pixel}/events` (`lib/conversions.ts:72,85,109`); IDs/secrets in DB `tracking_config` (`lib/tracking.ts:14`, `app/api/admin/tracking/route.ts:33-39`) | GA4 property, Google Ads account, Meta Business (owners unknown) | Account | Add clinic admins to each property; no URL change | API health `ga4`, `tracking-ids` |
| 32 | Google API keys (Places, Translate, Tenor) and Ads token | `maps.googleapis.com/maps/api/place/details` (`lib/reviews-aggregate.ts:107`); `translation.googleapis.com`; `tenor.googleapis.com` (`app/api/admin/team-chat/gifs/route.ts:19-20`); `googleads.googleapis.com/v22` (`lib/ad-spend.ts:87`) | Google Cloud → Credentials (must be API-restricted only, `lib/secrets.ts:29`); Google Ads MCC → API Center | Credential; GCP project / MCC owner | Confirm keys live in the clinic project; rotate if created elsewhere | API health `google-places`, `translation`, `ads` |
| 33 | Cloudflare Turnstile | `challenges.cloudflare.com/turnstile/v0/siteverify` (`lib/security/guard.ts:131-134`); `NEXT_PUBLIC_TURNSTILE_SITE_KEY` build-time (`app/api/admin/login/route.ts:40`) | Cloudflare account → Turnstile widget bound to kclinics.co.uk | Domain (widget); Credential (per Cloudflare account) | If account is Joe's: new widget in clinic account, both keys, redeploy | CAPTCHA renders and verifies on repeated failed login |
| 34 | WebAuthn passkeys | rpID `kclinics.co.uk`, origins apex + www (`lib/webauthn.ts:25-42`); rows in `WebAuthnCredential` (`prisma/schema.prisma:1302`) | Browsers/authenticators | Domain + DB rows + `ADMIN_JWT_SECRET` | None | Owner passkey step-up succeeds after cutover |
| 35 | Web-push VAPID | `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` (`lib/push.ts:11-14`); `PushSubscription` rows (`prisma/schema.prisma:4312-4323`); `/sw.js` | Browser push services | Credential (keypair must never change once subscriptions exist); currently unset | Carry the same keypair if set | Test push arrives |
| 36 | Sentry | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` (`sentry.server.config.ts:3-6`, `sentry.edge.config.ts`, `instrumentation-client.ts:3`); no `withSentryConfig`/auth token | sentry.io project (org owner probably Joe) | Credential (DSN may change on project transfer/re-create) | Transfer project or create new; update both vars; redeploy | API health `sentry`; test error received |
| 37 | Anthropic API | `api.anthropic.com/v1/messages` (`lib/chat-ai.ts:131`, `lib/ai-consultation.ts:265`, `lib/kiosk-ai.ts:34`); `ANTHROPIC_API_KEY` ManagedSecret/env | console.anthropic.com (org unknown, probably Joe's) | Credential/Account | New clinic org + key; revoke old | Kiosk analysis and chat AI work |
| 38 | Deepgram, GIPHY | `api.deepgram.com/v1/listen` (`app/api/admin/bookings/transcribe/route.ts:51`); `api.giphy.com` (`gifs/route.ts:37`) | Provider consoles | Credential | Re-issue only if accounts are Joe's | API health `deepgram` |
| 39 | Twilio | `api.twilio.com` outbound only (`lib/sms.ts:24,62`); no inbound/status webhooks | Twilio console | Credential (unchanged on owner transfer) | Update ManagedSecret only if token rotated | API health `twilio` |
| 40 | Hostinger CalDAV | `HOSTINGER_CALDAV_URL/USER/PASS` (`lib/hostinger-calendar.ts:15-17`) | Hostinger mailbox (clinic) — possibly retired after the Workspace move | Credential | Confirm the calendar still exists or unset | API health `caldav` or grey |
| 41 | Ops alert webhook | `CRON_ALERT_WEBHOOK_URL` POSTs (`app/api/health/route.ts:154`, `app/api/cron/daily/route.ts:521`, `app/api/cron/dispatch/route.ts:58`, `app/api/cron/kiosk-cleanup/route.ts:152`, `app/api/admin/api-health/route.ts:90`, `app/api/stripe/webhook/route.ts:509`) | Slack/Discord/Make incoming webhook (owner unknown) | Credential/Account | Point at a clinic channel or unset | Test alert lands in the clinic channel |
| 42 | Keyless hosts | `api.open-meteo.com` (`lib/weather.ts:40`), `api.pwnedpasswords.com` (`lib/security/breached-password.ts:13`), Google JWKS (`lib/google-sso.ts:19`), Google Maps embed (`lib/site.ts:38`) | None | None | None | n/a |
| 43 | Encryption keyring for DB-stored credentials | `HEALTH_ENCRYPTION_KEY(S)`, `HEALTH_HMAC_KEY(S)` (`lib/secrets.ts:13,60`; `docs/KEY_ROTATION.md`) | Vercel env | Credential (must be identical on the new deployment) | Carry over unchanged; rotate later via keyring rotation | Connection Centre shows keys 'Set in app' readable |

#### Cutover verification order

1. Vercel transfer accepted: check domains verified, crons listed, Blob `transferredStoreIds`, Upstash resource present, `NEXT_PUBLIC_SITE_URL` unchanged, production redeployed from the re-linked repo.
2. `GET https://kclinics.co.uk/api/health` and `/admin` API health page: all critical lights green (database, public-api, blob, redis, cron, stripe, resend).
3. Inbound webhooks: Stripe test event, Resend test email + reply, yay test call.
4. OAuth round-trips: Google (Reviews + Marketing), Xero, TrueLayer; SSO from a kclinics.co.uk account and a refused kaulindustries.com attempt.
5. Passkey step-up by an OWNER; Turnstile challenge path.
6. Revoke: Joe's PAT, `BOARD_QUEUE_TOKEN`, `GOOGLE_REVIEW_IMPORT_TOKEN`, QA accounts, read-only DB role, old Anthropic key, Claude Routine pair, webmaster@ Workspace/GCP roles.

## Appendix F — Secrets, encryption and what must never be lost

APPENDIX-F-PLACEHOLDER

## Appendix G — Official references

- Vercel: transferring a project — https://vercel.com/docs/projects/transferring-projects
- Vercel: domains between teams/projects — https://vercel.com/docs/domains/working-with-domains/transfer-your-domain
- Vercel: transferring an integration — https://vercel.com/docs/integrations/install-an-integration/transferring-an-integration
- Vercel: Blob private storage — https://vercel.com/docs/vercel-blob/private-storage
- Neon: transfer projects between organisations — https://neon.com/docs/manage/orgs-project-transfer
- Neon: Vercel-managed integration — https://neon.com/docs/guides/vercel-managed-integration
- Neon: Neon-managed Vercel integration — https://neon.com/docs/guides/neon-managed-vercel-integration
- GitHub: transferring a repository — https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository
- GitHub: transferring a GitHub App — https://docs.github.com/en/apps/maintaining-github-apps/transferring-ownership-of-a-github-app
- Resend: Domain Claim — https://resend.com/changelog/domain-claim · managing domains — https://resend.com/docs/dashboard/domains/manage-domains
- Stripe: change the account owner — https://support.stripe.com/questions/change-the-owner-of-a-stripe-account
- Sentry: transfer projects between organisations — https://sentry.zendesk.com/hc/en-us/articles/23572020203419
- Cloudflare Turnstile: get started (widgets, site/secret keys) — https://developers.cloudflare.com/turnstile/get-started/
- Hostinger: move a domain between accounts — https://www.hostinger.com/support/4068055-how-to-move-a-domain-between-hostinger-accounts/
- Twilio: change account owner — https://help.twilio.com/articles/31381999536027
- Upstash on Vercel — https://upstash.com/docs/redis/howto/vercelintegration
- In this repository: `docs/KEY_ROTATION.md`, `docs/SECURITY.md`, `docs/INTEGRATIONS.md`, `docs/DEPLOY.md`, `docs/GOOGLE_WORKSPACE_MIGRATION.md`, `docs/data-protection/processors.md`, `scripts/restore.mjs`, `scripts/healthcheck.mjs`, `scripts/db-sync.mjs`.

---

Last reviewed: 2026-09-06 (draft, BLD-1650).
