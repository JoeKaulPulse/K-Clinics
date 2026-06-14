# Migrating kclinics.co.uk email to Google Workspace

A step-by-step runbook to move every `@kclinics.co.uk` mailbox from Hostinger to
Google Workspace **with no lost mail**, at the **lowest sustainable cost**, and
to end up able to **manage all Workspace accounts from `/admin`**.

Read it in order. Sections 1–4 are decisions and prep; sections 5–8 are the
migration itself (written click-by-click for a non-technical owner); section 10
is the developer spec for the in-dashboard management (tracked as **BLD-312**).

> The golden rule for "no data loss": **the old Hostinger mailboxes stay switched
> on and untouched until the very end.** Every step below copies mail into
> Google; nothing is moved or deleted at the source until you have verified the
> copy. If anything looks wrong, you roll back by pointing one DNS record back at
> Hostinger.

---

## 1. Where you are today

| Thing | Today | Evidence in this repo |
|---|---|---|
| Staff mailboxes (the inboxes people log into) | **Hostinger** webmail | `.env.example` "the clinic's email/calendar is on Hostinger"; `HOSTINGER_CALDAV_*` |
| Shared clinic calendar | Hostinger CalDAV | `lib/hostinger-calendar.ts` |
| App / transactional email (booking confirmations, reminders, campaigns, chat) | **Resend**, sending from the **`mail.kclinics.co.uk`** subdomain | `lib/email.ts`, `docs/INTEGRATIONS.md §3` |
| Chat reply / inbound routing | **Resend Inbound** on **`reply.mail.kclinics.co.uk`** | `lib/chat-email.ts`, `.env.example` `CHAT_INBOUND_DOMAIN` |
| Website hosting | Vercel (apex `A`/`CNAME`) | `docs/DEPLOY.md` |
| DNS records | **Cloudflare** (where the Resend / Turnstile records live) | `lib/go-live.ts` (`EXT.cloudflareDns`), `.env.example` |
| Domain registrar | **Hostinger** | go-live guide |

Two facts decide the whole migration:

1. **Resend sends and receives on *subdomains* (`mail.` and `reply.mail.`), not on
   the bare `kclinics.co.uk`.** Subdomains carry their own mail (MX) records,
   independent of the apex. So pointing the **apex** at Google does **not** touch
   Resend. The platform keeps sending and receiving exactly as before.
2. The platform already **replies-to apex addresses** — `EMAIL_REPLY_TO` defaults
   to `hello@kclinics.co.uk` and `CLINIC_NOTIFY_EMAIL` to `frontdesk@kclinics.co.uk`.
   The moment those apex addresses live in Workspace, customer replies and
   booking alerts land in Gmail **with no code or env change**.

> **Check first: who actually controls DNS?** The records are managed in
> Cloudflare, but the domain is *registered* at Hostinger. Run
> `dig NS kclinics.co.uk +short` (or use [whatsmydns.net](https://whatsmydns.net)).
> If the nameservers say `*.ns.cloudflare.com`, make every DNS change **in
> Cloudflare**. If they point at Hostinger, make them at Hostinger. Everywhere
> below that says "in your DNS provider", this is what it means.

---

## 2. The cost model — how to pay the least

Google Workspace bills **per user mailbox (a "seat")**. Almost everything else is
free. The entire cost strategy is: **buy a seat only for a real person who needs
to log in and send as themselves; turn every other address into a free alias or
group.**

### 2.1 The three ways to hold an address (only one costs money)

| Mechanism | Cost | Use it for | Limit |
|---|---|---|---|
| **User (seat)** | Paid, per month | A real human who logs in, sends, and stores mail | — |
| **Alias** on an existing user | **Free** | A second name for one person's inbox (e.g. `inna@` → `inna.k@`) — mail just lands in their Gmail | Up to **30 aliases** per user |
| **Group** (Collaborative Inbox) | **Free** | A *shared* role address several people answer (`hello@`, `info@`, `bookings@`) — everyone sees and replies; no seat needed | Effectively unlimited |

A role address answered by **one** person → make it an **alias** on that person.
A role address answered by **several** people → make it a **Group**. Neither
costs a seat. This single decision is where the savings are.

### 2.2 Pick the cheapest edition that still fits

| Edition (approx. UK, early 2026 — **confirm live price**) | Storage / user | Why you'd pick it |
|---|---|---|
| **Business Starter** ≈ £5–6 /user/mo | 30 GB pooled | Default. Plenty for a clinic inbox. **Choose this unless a need below forces up.** |
| Business Standard ≈ £10–12 /user/mo | 2 TB | Only if you need **Google Vault** (enforced email retention / eDiscovery), bookable Meet recordings, or **data-region (UK/EU) controls** |
| Business Plus ≈ £18 /user/mo | 5 TB | Only for heavier compliance / larger storage |

Notes that affect the bill:
- Prices and the included Gemini AI changed in 2025; **always confirm at
  [workspace.google.com/pricing](https://workspace.google.com/pricing)** before
  committing.
- **Flexible plan** = pay monthly, add/remove seats anytime (no lock-in, slightly
  higher per-seat). **Annual/Fixed plan** = ~20% cheaper but you commit to a seat
  count for a year. **Start on Flexible** through the migration; switch the stable
  core seats to Annual once headcount settles.
- You can **mix editions**: e.g. Starter for most staff, Standard for one owner
  mailbox that needs Vault retention. Buy the expensive tier only where required.
- A **suspended** user keeps all their mail but **may still consume a paid licence**
  depending on plan. To actually stop paying for a seat you must remove its
  licence or delete the account — and only after its mail is exported/transferred
  (§13).
- There is a **14-day free trial** — do the whole test migration inside it before
  any card is charged.

### 2.3 Inventory — fill this in before you buy anything

List **every** address that currently exists or forwards at Hostinger, then mark
each one. Seats are the only column you pay for.

| Address | Who answers it | Decision | Why |
|---|---|---|---|
| `hello@kclinics.co.uk` | front desk team | **Group** | shared, customer-facing; app replies-to here |
| `frontdesk@kclinics.co.uk` | front desk team | **Group** | shared; app booking alerts land here |
| `info@kclinics.co.uk` | front desk team | **Group** or alias of `hello@` | shared / duplicate of hello |
| `support@kclinics.co.uk` | front desk team | **Group** or alias | shared |
| `inna.k@kclinics.co.uk` | Inna (real person) | **Seat** | a human who sends as herself |
| `owner@ / joe@` | owner | **Seat** (super-admin) | runs the account |
| _…each clinician…_ | that clinician | **Seat** | sends as themselves |
| _…departed staff…_ | nobody | **Alias/forward → manager**, then archive (§13) | don't pay for a leaver |
| `chat@mail.kclinics.co.uk` | — (the app, via Resend) | **Leave alone** | not a Workspace mailbox |
| `replies@reply.mail.kclinics.co.uk` | — (the app, via Resend) | **Leave alone** | not a Workspace mailbox |

> **Illustrative maths.** Say 6 real staff need to send as themselves and there
> are 6 role addresses. Lowest-cost = **6 seats**, with all 6 role addresses as
> free Groups/aliases. The naive way — a seat per address — is **12 seats**, double
> the bill, forever. Replace the numbers above with your real headcount.

---

## 3. The plan at a glance

```
Phase 1  Sign up + verify the domain (TXT only)        → no effect on live mail
Phase 2  Create seats, groups and aliases               → no effect on live mail
Phase 3  Pre-copy ALL old mail in (Data Migration Svc)  → reads Hostinger, copies to Google
Phase 4  Turn on Google's sending auth (SPF/DKIM/DMARC)  → does NOT touch Resend
Phase 5  Cutover: point the APEX mailbox (MX) at Google  → new mail now lands in Gmail
Phase 6  Delta re-copy + verify                          → catch mail that arrived mid-switch
Phase 7  Grace period, then decommission Hostinger       → only after everything verified
```

Realistic timeline: **a quiet evening for Phases 1–4**, the cutover on a
**low-traffic morning**, then a **1–2 week** grace period before decommissioning.

---

## 4. Pre-flight checklist

- [ ] A password manager ready (you'll create several strong passwords).
- [ ] Admin access to the **DNS provider** (§1 — Cloudflare or Hostinger) and to
      the **Hostinger email** control panel.
- [ ] The §2.3 inventory completed and agreed.
- [ ] For each existing mailbox you're migrating: its **IMAP login** — server
      host, username (the full email), and password (or an **app password** if the
      mailbox has 2FA). Hostinger IMAP is typically `imap.hostinger.com`, port
      `993`, SSL.
- [ ] A maintenance window chosen for the cutover (early morning is calmest).
- [ ] Tell staff: "On _date_, your email moves to Gmail. Keep using the old
      webmail until then; we'll send your new login."

---

## 5. The migration, step by step

### Phase 1 — Sign up and prove you own the domain (safe; no mail moves)

1. Go to **[workspace.google.com](https://workspace.google.com)** and click **Get
   started**.
2. Enter the business name, number of staff and country (United Kingdom).
3. When asked **"Does your business have a domain?"** choose **Yes, I have one**
   and type **`kclinics.co.uk`**.
4. Create the first admin account — this is your master login and **super-admin**
   (e.g. `owner@kclinics.co.uk` or `joe@kclinics.co.uk`). Use a strong password
   and **turn on 2-Step Verification immediately**.
5. Choose **Business Starter** and the **Flexible** plan (§2.2). Don't add extra
   seats yet. The 14-day trial means no charge during setup.
6. Google asks you to **verify the domain**. It gives you a **TXT record**. Add it
   in your DNS provider (§1):
   - Cloudflare → **DNS** → **Add record** → Type **TXT**, Name **`@`**, Content =
     the `google-site-verification=…` value Google shows → **Save**.
7. Back in Google, click **Verify**. This **only proves ownership — it does not
   change where email goes.** Live mail is still flowing to Hostinger.

Official: [verify your domain](https://support.google.com/a/answer/60216).

### Phase 2 — Create seats, groups and aliases (still no mail moved)

Do this in the **Google Admin console** at **[admin.google.com](https://admin.google.com)**.

**Seats (real people)** — for each person in the "Seat" rows of your inventory:
1. **Directory → Users → Add new user**.
2. Enter their name and primary email (e.g. `inna.k@kclinics.co.uk` — *match the
   existing address exactly* so their mail history lines up).
3. Save. Give them the auto-generated password to change on first login.
   ([Add users](https://support.google.com/a/answer/33310).)

**Aliases (free second names for one person):**
1. **Directory → Users**, click the person.
2. **User information → Email aliases → Add an alias** (e.g. add `inna@` as an
   alias of `inna.k@`).
   ([Add aliases](https://support.google.com/a/answer/33327).)

**Groups (free shared inboxes):** for `hello@`, `frontdesk@`, `info@`, `support@`,
`bookings@` etc.:
1. **Directory → Groups → Create group**. Name it (e.g. "Front Desk"), set the
   group email to the role address (`hello@kclinics.co.uk`).
2. Add the staff who should answer it as **members**.
3. Open the group → **Settings** → set **"Who can post"** to **Anyone on the web**
   (so customers can email it) and enable **Collaborative Inbox** so staff can
   assign and resolve messages.
   ([Create a group](https://support.google.com/a/answer/33343),
   [Collaborative Inbox](https://support.google.com/a/answer/167430).)

> Don't recreate `chat@mail.…` or `replies@reply.mail.…`. Those belong to Resend
> and must stay exactly where they are (§7).

### Phase 3 — Pre-copy all existing mail in (no data loss; source untouched)

Use Google's free, built-in **Data Migration Service (DMS)**. It **copies** mail
over IMAP — it reads from Hostinger and writes to Gmail, and **never deletes or
changes anything on Hostinger**. You run it now, *before* cutover, while old mail
is still arriving at Hostinger, so the bulk is already in Gmail when you flip the
switch.

1. Admin console → **Account → Data migration** (or **Apps → Data migration**).
2. **Migration source:** choose **Other IMAP server** (Hostinger is generic IMAP).
3. **Connection protocol:** IMAP; **server** `imap.hostinger.com` (confirm in the
   Hostinger panel), with the role/admin mailbox credentials.
4. **Migration start date:** choose "migrate everything" (no start date) for a
   full history copy.
5. **Select users:** map each **source** Hostinger mailbox → its **destination**
   Workspace user you created in Phase 2. Use the per-mailbox IMAP password (or
   app password) from your pre-flight list.
6. Start the migration and let it run. Large mailboxes take hours; that's fine —
   nothing is offline.
   ([Migrate email with DMS](https://support.google.com/a/answer/6167866),
   [IMAP migration](https://support.google.com/a/answer/7044263).)

What DMS over IMAP does **not** carry: **calendars and contacts** (IMAP is mail
only). Handle those separately:
- **Contacts:** in Hostinger webmail export contacts to **CSV**, then **Google
  Contacts → Import**.
- **Calendar:** the shared clinic calendar is already created in Workspace by the
  go-live guide; export any Hostinger calendar to **.ics** and import it in Google
  Calendar (**Settings → Import & export**). Recreate the clinic calendar's
  sharing (§9).

> For up to ~100 mailboxes DMS is the right tool. (Google Workspace Migrate, the
> heavyweight alternative, needs a Windows server and is overkill for a clinic.)

### Phase 4 — Turn on Google's sending authentication (does **not** touch Resend)

This makes mail *sent from Gmail as `@kclinics.co.uk`* pass spam checks. Resend's
own SPF/DKIM live on the `mail.` subdomain and are **left exactly as they are**.

1. **SPF (apex).** In your DNS provider, find any existing apex `TXT` that starts
   `v=spf1` (Hostinger may have added one). **Replace its value** with:
   ```
   v=spf1 include:_spf.google.com ~all
   ```
   There must be **only one** SPF record on the apex. (Resend's SPF is a *separate*
   record on `mail.kclinics.co.uk` — do not merge or remove it.)
2. **DKIM (apex).** Admin console → **Apps → Google Workspace → Gmail →
   Authenticate email**. **Generate new record** (2048-bit). Google gives you a
   `TXT` for host **`google._domainkey`** — add it in your DNS provider, then come
   back and click **Start authentication**.
   ([Set up DKIM](https://support.google.com/a/answer/174124).)
3. **DMARC (apex).** Add a `TXT` at host **`_dmarc`** (skip if one already exists —
   tighten it instead). Start gentle so nothing is rejected mid-migration:
   ```
   v=DMARC1; p=none; rua=mailto:postmaster@kclinics.co.uk; fo=1
   ```
   After a week of clean reports, raise to `p=quarantine`, then `p=reject`.
   Relaxed alignment (the default) means Resend's subdomain mail keeps passing, so
   tightening DMARC does not break the platform's email.
   ([Add DMARC](https://support.google.com/a/answer/2466580).)

### Phase 5 — Cutover: point the apex mailbox at Google

This is the only step that changes where **new** mail for `@kclinics.co.uk` lands.

1. **The day before**, in your DNS provider lower the **TTL** on the apex **MX**
   record(s) to **300 seconds** (5 min). This makes rollback fast.
2. On the morning of cutover, in your DNS provider **remove the old Hostinger apex
   MX records** and add Google's. Modern Workspace uses a **single** MX:

   | Type | Name/Host | Value / Mail server | Priority | TTL |
   |---|---|---|---|---|
   | MX | `@` (apex) | `smtp.google.com` | `1` | 3600 |

   (If your panel insists on the legacy set, use Google's five `ASPMX` records
   instead — Admin console shows them. Either works; don't mix.)
   ([Set up MX records](https://support.google.com/a/answer/140034).)
3. **Do not change** the `mail.` or `reply.mail.` records (§7). They are different
   hostnames with their own MX and are unaffected.
4. Wait for propagation (usually minutes with the lowered TTL; allow up to an
   hour). Send a test from an outside account (e.g. a personal Gmail) to
   `hello@kclinics.co.uk` and confirm it arrives in the Workspace Group/inbox.

> **Belt-and-braces (optional):** in the Hostinger panel set each old mailbox to
> **also forward a copy** to its new address during the switch. Combined with the
> Phase 6 delta copy, this guarantees zero gap.

### Phase 6 — Delta re-copy and verify

1. Re-run the **Data Migration Service** for each mailbox (same setup as Phase 3).
   DMS only pulls **what's new**, sweeping up anything that hit Hostinger between
   the Phase 3 copy and the MX cutover. Nothing is duplicated.
2. Verify against the test matrix in **Appendix B** before declaring done.

### Phase 7 — Grace period, then stop

Keep the Hostinger mailboxes **live and paid** for **1–2 weeks** after cutover as a
safety net (and so any straggler mail or forward still resolves). Only once
Appendix B passes and staff confirm nothing is missing do you move to decommission
(§13).

---

## 6. Aliases & groups playbook (the money-saver, in detail)

For each role/shared address, decide and apply:

**Becomes an ALIAS** when *one* person owns it.
*Admin console → Directory → Users → [person] → Email aliases → Add an alias.*
Their Gmail now also receives anything sent to the alias; they can **Send as** the
alias (Gmail → Settings → Accounts → "Send mail as"). Cost: **£0**.

**Becomes a GROUP** when *several* people share it.
*Admin console → Directory → Groups → Create group* with the role address, add the
team as members, enable **Collaborative Inbox**. Everyone sees it, can claim,
reply, and mark resolved. Cost: **£0**.

**Becomes a forward, then nothing** when it's a leaver or a dead address.
Make it an alias/forward to the relevant manager so nothing bounces, archive the
old mailbox's contents to that manager (§13), then drop the source seat. Cost:
**£0** ongoing.

Keep the per-person alias count under **30**. If a single inbox needs more than 30
names, that's a sign it should be a Group instead.

---

## 7. Keep Resend and the website working (the coexistence rules)

The platform's email and the website must keep working throughout. The rule is
simple: **only the apex's mail (MX), SPF, DKIM and DMARC change. Everything on the
`mail.` and `reply.mail.` subdomains is left alone.**

**DO NOT TOUCH — these belong to Resend / Vercel:**

| Record | Host | Belongs to | If you break it |
|---|---|---|---|
| SPF (`v=spf1 … resend …`) | `mail.kclinics.co.uk` | Resend sending | App emails go to spam |
| DKIM `CNAME`/`TXT` | `*._domainkey.mail.kclinics.co.uk` | Resend sending | App emails fail signing |
| MX + `CNAME` + `CAA` | `reply.mail.kclinics.co.uk` | Resend Inbound | Chat replies stop threading |
| `A` / `CNAME` | `@` and `www` | Vercel (website) | Website goes down |

**CHANGE / ADD — these are the migration (apex only):**

| Record | Host | Action |
|---|---|---|
| MX | `@` | Remove Hostinger's; add `smtp.google.com` (pri 1) |
| SPF `TXT` | `@` | Replace apex value with `v=spf1 include:_spf.google.com ~all` |
| DKIM `TXT` | `google._domainkey` | Add (from Admin console) |
| DMARC `TXT` | `_dmarc` | Add `p=none` → tighten later |
| Verification `TXT` | `@` | Temporary; remove after verifying |

Because `mail.` and `reply.mail.` are **separate hostnames**, their MX records are
read independently of the apex MX. Google receiving on `kclinics.co.uk` and Resend
receiving on `reply.mail.kclinics.co.uk` coexist with zero conflict.

---

## 8. DNS reference — before → after

```
# ── Website (unchanged) ────────────────────────────────────────────────
@        A/CNAME   → Vercel
www      CNAME     → Vercel

# ── App email via Resend (UNCHANGED — do not edit) ─────────────────────
mail              TXT   v=spf1 include:resend ... ~all
*._domainkey.mail CNAME/TXT  (Resend DKIM)
reply.mail        MX/CNAME/CAA  (Resend Inbound)

# ── Company mailboxes via Google Workspace (THIS migration) ────────────
@                 MX    smtp.google.com (priority 1)       ← was Hostinger
@                 TXT   v=spf1 include:_spf.google.com ~all ← replace apex SPF
google._domainkey TXT   (Google DKIM, from Admin console)
_dmarc            TXT   v=DMARC1; p=none; rua=mailto:postmaster@kclinics.co.uk; fo=1
```

---

## 9. What changes in the platform / codebase

Almost nothing — by design.

| Area | Change needed? | Detail |
|---|---|---|
| Resend sending (`EMAIL_FROM`) | **No** | Keep sending from the `mail.kclinics.co.uk` subdomain. Don't switch `EMAIL_FROM` to an apex address, or you re-open DMARC alignment questions for no benefit. |
| `EMAIL_REPLY_TO=hello@kclinics.co.uk` | **No** | Already an apex address; once `hello@` is a Workspace Group, customer replies land in Gmail automatically. |
| `CLINIC_NOTIFY_EMAIL=frontdesk@kclinics.co.uk` | **No** | Same — booking alerts land in the Workspace Group. |
| Chat inbound (`reply.mail.…`) | **No** | Stays on Resend Inbound. |
| Shared calendar | **Optional** | Revive the parked Google Calendar sync: set `GOOGLE_INTEGRATION_ENABLED=true`, connect the clinic calendar, then retire the Hostinger CalDAV vars (`HOSTINGER_CALDAV_URL/USER/PASS`). See `docs/INTEGRATIONS.md §6`. |

Net result: the mailbox migration needs **no env changes** to keep the live site
sending and receiving. The only optional follow-up is moving the calendar sync
from Hostinger CalDAV to Google.

---

## 10. Manage all Workspace accounts from `/admin` (BLD-312)

Goal: create/suspend users, manage aliases and groups, and see seat usage from the
admin dashboard, without logging into the Google Admin console. This is a build
task; what follows is the implementation spec, designed to match the patterns
already in this codebase.

### 10.1 Authentication — service account + domain-wide delegation

Directory operations need a **super-admin** context. For a single internal tool
the cleanest approach is a **Google Cloud service account** with **domain-wide
delegation (DWD)** that **impersonates** a designated super-admin (e.g.
`admin@kclinics.co.uk`). No per-request user OAuth, no interactive re-consent.

Setup (one-off):
1. In the **same Google Cloud project** as the existing `GOOGLE_CLIENT_ID`, enable
   the **Admin SDK API**.
2. Create a **service account**; create a **JSON key**.
3. Admin console → **Security → API controls → Domain-wide delegation** →
   authorise the service account's **client ID** for these scopes:
   - Phase A (read-only): `…/auth/admin.directory.user.readonly`,
     `…/auth/admin.directory.group.readonly`
   - Phase B (write): `…/auth/admin.directory.user`,
     `…/auth/admin.directory.group`, `…/auth/admin.directory.user.alias`,
     `…/auth/admin.directory.group.member`
4. Store the credentials **encrypted**, using the existing managed-secrets pattern
   (`setSecret` → `encryptJson`, same as `GOOGLE_CLIENT_ID/SECRET` in
   `lib/secrets.ts`):
   - `GOOGLE_WORKSPACE_SA_KEY` — the service-account JSON
   - `GOOGLE_WORKSPACE_ADMIN_EMAIL` — the super-admin to impersonate
   - `GOOGLE_WORKSPACE_CUSTOMER_ID` — optional, defaults to `my_customer`

### 10.2 New library: `lib/google-workspace.ts`

Follow the hand-rolled token style already in `lib/google-auth.ts` (the codebase
calls Google token endpoints directly with `fetch` rather than pulling in the
`googleapis` SDK — `jose` is already a dependency for signing):

```ts
// Inert-until-credentialed, like every other integration (INTEGRATIONS.md).
export async function workspaceConfigured(): Promise<boolean>;     // SA key + admin email present

// Internal: build a service-account JWT (jose SignJWT, RS256), set `sub` to the
// impersonated admin, exchange at https://oauth2.googleapis.com/token for an
// access token scoped to Directory; cache with a short TTL (mirror googleAccessToken()).
async function directoryToken(scopes: string[]): Promise<string | null>;

export async function listWorkspaceUsers(): Promise<WorkspaceUser[]>;          // status, lastLogin, storage
export async function getWorkspaceUser(email: string): Promise<WorkspaceUser | null>;
export async function createWorkspaceUser(input: NewUser): Promise<WorkspaceUser>;
export async function suspendWorkspaceUser(email: string): Promise<void>;      // reversible; keeps data
export async function restoreWorkspaceUser(email: string): Promise<void>;
export async function deleteWorkspaceUser(email: string): Promise<void>;       // guard hard; only post-archive

export async function addUserAlias(email: string, alias: string): Promise<void>;
export async function removeUserAlias(email: string, alias: string): Promise<void>;

export async function listGroups(): Promise<WorkspaceGroup[]>;
export async function createGroup(email: string, name: string): Promise<WorkspaceGroup>;
export async function addGroupMember(group: string, member: string): Promise<void>;
export async function removeGroupMember(group: string, member: string): Promise<void>;
```

Every function returns a safe no-op / empty result when `workspaceConfigured()` is
false, so the feature stays dormant until the key is supplied.

### 10.3 Routes — `app/api/admin/integrations/google-workspace/*`

Reuse the integrations route convention. Because auth is a service account (not an
interactive OAuth dance), there is **no `connect/callback`** pair; instead a
"paste the service-account key + Test" form saves the secret via `setSecret`.

| Route | Method | Purpose |
|---|---|---|
| `…/google-workspace/test` | GET | `workspaceConfigured()` + a `listWorkspaceUsers()` count to prove the connection |
| `…/google-workspace/users` | GET / POST | list / create users |
| `…/google-workspace/users/[email]` | PATCH / DELETE | suspend·restore / delete |
| `…/google-workspace/users/[email]/aliases` | POST / DELETE | add / remove alias |
| `…/google-workspace/groups` | GET / POST | list / create groups |
| `…/google-workspace/groups/[email]/members` | POST / DELETE | add / remove member |

Gate every handler with `sessionCan(session, 'settings.manage')` (or a new
`workspace.manage` permission), and call `logAudit({ action: 'SETTINGS_UPDATED', … })`
on every write — exactly as the `google-business` callback does.

### 10.4 UI and registration

- New page `app/admin/workspace/page.tsx`: a Users table (status, last login,
  storage, suspend/alias actions) and a Groups & shared-inboxes tab. Gate on the
  same permission, mirroring `app/admin/staff/page.tsx`.
- Register a nav entry in `lib/admin-nav.ts`:
  `{ href: '/admin/workspace', key: 'nav.workspace', perm: 'settings.manage',
  keywords: 'email mailbox google workspace alias group seat' }`.
- Add an entry to `getIntegrations()` in `lib/integrations.ts` so it shows on the
  Integrations page with a `connected | not_configured` status and a `manageHref`.

### 10.5 Tie into the Staff area (the payoff)

The `AdminUser` model already has `email` (unique), `name`, `role`, `active`. Wire
Workspace provisioning into the staff lifecycle (`app/admin/staff`):
- **On create** of an active `AdminUser` with an `@kclinics.co.uk` email → offer
  **"Create Workspace mailbox"** (`createWorkspaceUser`).
- **On deactivate** (`active=false`) → offer **"Suspend Workspace mailbox"**
  (`suspendWorkspaceUser`) — preserves their mail, frees nothing until you remove
  the licence (cost note in §2.2).

No schema change is needed for Phases A/B — resolve the Workspace user by
`AdminUser.email` at call time. If you later want to cache the link or a
provisioned flag, add **nullable, additive** fields only (e.g.
`workspaceProvisioned Boolean @default(false)`) to satisfy the non-destructive
`prisma db push` gate (CLAUDE.md → "Database schema changes").

### 10.6 Build it in phases

- **Phase A — read-only.** Service account with `.readonly` scopes; dashboard
  lists users, groups, aliases, last-login and storage. Low risk, proves the auth,
  immediately useful for the seat audit in §2.3.
- **Phase B — provisioning.** Add write scopes; create/suspend users, manage
  aliases and group membership; wire into staff create/deactivate.
- **Phase C — automation.** Auto-provision on staff create, auto-suspend on
  deactivate, and surface **seat usage vs licences** so the owner can see spend and
  prune unused seats.

### 10.7 Security

The service-account key can administer every account — treat it like the most
sensitive secret in the system:
- Store only via `setSecret` (encrypted at rest with `encryptJson`); never in
  plaintext env or the repo.
- Grant **least-privilege scopes** (start read-only); restrict DWD to exactly the
  scopes listed.
- Gate the UI/routes behind an **owner-level permission** and `logAudit` every
  write.
- Keep the impersonated admin a **dedicated** super-admin with 2-Step Verification.

---

## 11. Rollback

If anything is wrong after the MX cutover (Phase 5), you recover in minutes
because nothing at the source was deleted:

1. In your DNS provider, **revert the apex MX** back to Hostinger's values
   (you lowered TTL to 300s in Phase 5.1, so this propagates fast).
2. New mail flows to Hostinger again; the Workspace copies you already migrated
   stay intact.
3. Diagnose, fix, and re-attempt the cutover. No mail is lost either way because
   both sides retain their copies.

Keep Hostinger paid until you have **decided not to roll back** (§7 grace period).

---

## 12. Security & compliance (clinic-specific)

- **Enforce 2-Step Verification** for all staff (Admin → Security →
  Authentication). Non-negotiable for a clinic.
- **Retention / eDiscovery:** if you must retain or legally-hold email for record
  keeping, that's **Google Vault**, which needs **Business Standard or above** —
  put the owner / records mailbox on Standard and leave the rest on Starter, or use
  a third-party backup. Decide before, not after.
- **Data region:** UK/EU data-region controls also require Standard+. Note it if
  your DPO requires data residency.
- **Leavers:** suspend (don't delete) on day one to preserve evidence; transfer/
  export, then delete after your retention window (§13). Update the §2.3 inventory
  so you stop paying for the seat.
- Record the change in `docs/COMPLIANCE_ROADMAP.md` if email handling is referenced
  there.

---

## 13. Decommission Hostinger (only after §7 grace period passes)

1. Confirm **Appendix B** passes and staff report nothing missing.
2. For any mailbox you're closing, do a **final delta DMS run** (Phase 6) so the
   last few days of mail are in Google.
3. Export a **local archive** of each old mailbox you're not keeping (Hostinger
   webmail → export, or one last IMAP pull) and store it with your records.
4. Turn off Hostinger **email forwarding** you set up in Phase 5.
5. Cancel the **Hostinger email/mailbox** plan. **Keep the domain registration**
   and **keep DNS** as-is — you're only stopping the mailbox service.
6. Remove the now-unused `HOSTINGER_CALDAV_*` env vars if you moved the calendar to
   Google (§9).

---

## 14. Ongoing cost control

- Review **seats vs licences** monthly (Phase C surfaces this in `/admin`).
- Every new shared address starts as a **Group or alias**, never a seat — make it
  the default question when anyone asks for "a new email address".
- Suspend leavers immediately; delete (after archiving) at the end of the retention
  window so you stop paying.
- Move stable core seats to the **Annual** plan once headcount is steady; keep new
  or seasonal staff on **Flexible**.
- Re-confirm pricing at renewal — editions and bundled features change.

---

## Appendix A — per-mailbox runbook

For each mailbox in the §2.3 inventory:

```
[ ] Decision recorded (Seat / Alias / Group / Archive-and-drop)
[ ] IMAP login captured (host, user, app password)
[ ] Destination created in Workspace (user / alias / group)
[ ] Phase 3 full copy done
[ ] Contacts CSV + calendar .ics imported (if a real person)
[ ] Phase 6 delta copy done (post-cutover)
[ ] Owner spot-checked: oldest mail, newest mail, a folder, an attachment
[ ] (leaver only) archived locally, source seat dropped
```

## Appendix B — post-cutover test matrix

```
[ ] External → hello@      lands in the Workspace Group inbox
[ ] External → frontdesk@  lands in the Group; app booking alert visible
[ ] External → a person's seat (e.g. inna.k@) lands in their Gmail
[ ] Reply from Gmail "as" hello@ shows the right From address
[ ] Book a test appointment → confirmation email still sends (Resend)
[ ] Reply to a booking email → lands at hello@ in Workspace
[ ] Live-chat email reply → still threads (reply.mail. on Resend, untouched)
[ ] Old mail present: oldest message, newest message, a folder, an attachment
[ ] DKIM/SPF/DMARC pass (send to a checker e.g. mail-tester.com — aim 10/10)
[ ] mxtoolbox.com shows apex MX = smtp.google.com; mail. records unchanged
```

## Appendix C — official references

- [Workspace setup overview](https://support.google.com/a/answer/53926) ·
  [Verify domain](https://support.google.com/a/answer/60216) ·
  [Set up Gmail MX](https://support.google.com/a/answer/140034)
- [Add users](https://support.google.com/a/answer/33310) ·
  [Aliases](https://support.google.com/a/answer/33327) ·
  [Groups](https://support.google.com/a/answer/33343) ·
  [Collaborative Inbox](https://support.google.com/a/answer/167430)
- [Data Migration Service](https://support.google.com/a/answer/6167866) ·
  [IMAP migration](https://support.google.com/a/answer/7044263)
- [DKIM](https://support.google.com/a/answer/174124) ·
  [DMARC](https://support.google.com/a/answer/2466580)
- [Admin SDK Directory API](https://developers.google.com/admin-sdk/directory) ·
  [Domain-wide delegation](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Pricing](https://workspace.google.com/pricing)
</content>
