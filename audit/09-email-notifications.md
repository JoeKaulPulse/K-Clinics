# Email & Notifications Audit

_Area: Email, campaigns, notifications & SMS. Codebase: K-Clinics (Next.js 15 + Prisma + TypeScript), `resend` for email, Twilio for SMS._
_Auditor: application-security review. Date: 2026-06-09. Read-only review; no source modified, nothing sent._

## Summary

The email subsystem is, on the whole, soundly built: a single `sendEmail()` chokepoint (`lib/email.ts`), HTML escaping in nearly every transactional template, a hard `unsubscribed` suppression flag honoured across marketing **and** care mail, RFC 8058 one-click unsubscribe headers on bulk sends, double-send guards on campaigns (status → `SENDING` claim), per-send idempotency in the daily automations (every send writes an `EmailEvent` and dedup queries gate re-sends), and both cron entrypoints protected by `CRON_SECRET`. The Resend webhook fails closed in production and verifies the Svix signature. Public enquiry/newsletter/careers/signup endpoints are rate-limited and honeypotted, and recipient addresses for those flows are taken from server-side records, not the request — so there is **no classic open relay** (no endpoint lets an attacker pick both recipient and body).

The notable gaps are (1) an **HTML-injection sink in the marketing/automation path**: client `firstName`/`lastName`/`email` are interpolated into already-rendered email HTML *without escaping* — both via the `{{merge_tag}}` mechanism and via raw `${c.firstName}` template literals in `lib/automations.ts`; (2) the campaign **send endpoint has no rate limit / send cap**, so a single account with `campaigns.send` (or a stolen session/CSRF) can blast up to 5,000 recipients per call repeatedly through the verified domain; (3) `replyTo`/`fromName` and email `href`s are passed through without value validation (header-injection and `javascript:`/arbitrary-redirect surface, largely mitigated by Resend's API but not defended in-app); and (4) the **unsubscribe token is the long-lived `unsubToken` itself**, used as the sole credential for an unauthenticated state change with no audit trail.

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Medium   | 4 |
| Low      | 4 |
| Info     | 3 |

## Findings

### [HIGH] Marketing & automation emails inject client name/email into HTML without escaping (stored HTML/CSS/link injection)

**Location:**
- `lib/email-builder.ts:34-45` (`applyMergeTags` — returns raw, never escapes)
- `lib/email-campaigns.ts:50-52` (merge tags applied to the *already-rendered* body HTML)
- `lib/automations.ts:47`, `lib/automations.ts:87`, `lib/automations.ts:116` (raw `${c.firstName}` in email body)
- Source of tainted data: `lib/validation.ts:4-5,25-26` (`firstName`/`lastName` `max(80)`, no character restriction); written from public `app/api/consult/route.ts:58-59` and `app/api/account/signup/route.ts`.

**Issue:** `emailBlocksToHtml()` correctly HTML-escapes block text (`lib/email-builder.ts:15`, `esc()`), but `deliverToRecipients` then runs `applyMergeTags(bodyHtml, ctx)` **after** the HTML is built (`lib/email-campaigns.ts:52`). `applyMergeTags` performs a raw `String.replace` with no escaping (`lib/email-builder.ts:44`), so the per-recipient `first_name`/`last_name`/`email` values are spliced **raw** into the final HTML. The same pattern appears directly in the daily automations, e.g. `lib/automations.ts:47`:
```js
<p ...>Hi ${c.firstName || 'there'}, you're closer than you think to <strong>${next.name}</strong> ...</p>
```
`c.firstName` is attacker-controllable (a visitor sets it at consultation/signup; up to 80 chars, including `<`, `>`, `"`, `'`). A name such as `</p><a href="https://evil.example/login">Verify your account</a>` or `<img src=x style="…">` is injected verbatim into a mail that is sent from, and DKIM/SPF-aligned to, the clinic's verified domain — enabling content spoofing, CSS/layout hijack, and convincing in-domain phishing links in marketing, birthday, win-back, tier-nudge, anniversary and renewal emails.

**Impact:** HTML/CSS/anchor injection into authenticated, domain-aligned email delivered to other clients (campaigns) and to the client themselves (automations). Email clients don't execute JS, so this is not remote JS execution, but it is a phishing/brand-abuse and content-integrity issue carried by the clinic's own trusted sender reputation. (Confirmed *not* escalated to admin-panel DOM XSS: the dashboard email previews use static sample data — `lib/email-previews.ts` — and no admin view renders client names via `dangerouslySetInnerHTML`.)

**Recommendation:** Escape merge values at substitution time. In `applyMergeTags`, HTML-escape each replacement (or expose a separate `applyMergeTagsText` for the subject/preheader, which are plaintext, and an escaping variant for HTML bodies). In `lib/automations.ts`, wrap every interpolated `c.firstName`/name through the existing `escape()` helper from `lib/email.ts` (or a shared util) rather than raw template literals. Additionally, sanitise name fields at the input boundary (strip `<>` and control chars in `validation.ts`).

```js
// lib/email-builder.ts — applyMergeTags currently:
return String(text ?? '').replace(/\{\{\s*(first_name|last_name|name|email)\s*\}\}/g, (_, k) => map[k] ?? '');
//                                                                                              ^ raw, unescaped
```

---

### [MEDIUM] Campaign send endpoint has no rate limit or send cap (mass-send / cost & reputation abuse)

**Location:** `app/api/admin/marketing/email/send/route.ts:10-134` (no `enforceRateLimit`); `lib/email-campaigns.ts:73,112,155` (`take: 5000`).

**Issue:** Every other write/auth endpoint in the app calls `enforceRateLimit` (22 routes do — `app/api/consult`, `newsletter`, `signup`, etc.). The marketing send route does **not**. Authorization is a single permission check, `requirePermission('campaigns.send')` (line 13). There is no per-actor throttle, no daily send budget, and no confirmation step; `op: 'sendNow'`, the immediate send (line 124-129), `abTest`, and `test` can all be invoked repeatedly. Each `deliverCampaign`/`startAbTest`/`decideAbTest` pulls up to **5,000** recipients (`lib/email-campaigns.ts:73,112,155`). The `test` op (line 57-72) sends to an **arbitrary attacker-supplied address** (`body.test`) with attacker-supplied subject/blocks and **records nothing** — a quiet way to emit content through the verified domain to any address, one message per request, with no audit log and no rate limit.

**Impact:** A compromised/abused staff session, an over-broad role, or a CSRF against an authenticated admin (no CSRF token is evident on these JSON POSTs) can exhaust the Resend quota, harm domain sending reputation, and spray phishing/spam from the clinic domain. The unlogged `test` op is the cleanest abuse primitive.

**Recommendation:** Add `enforceRateLimit` to this route (tight budget for `test` and `sendNow`; a daily campaign cap). Log the `test` op to `EmailEvent`/audit. Restrict `campaigns.send` to trusted roles and confirm CSRF protection (same-site cookies + origin check or a CSRF token) covers admin JSON mutations. Consider a soft cap / explicit confirmation when an audience exceeds a threshold.

---

### [MEDIUM] Unsubscribe uses the long-lived `unsubToken` as the only credential; GET mutates state, no audit, token never rotates

**Location:** `app/api/unsubscribe/route.ts:9-48`; token minted on the Client/NewsletterSubscriber record and embedded in every email (`lib/email-campaigns.ts:51`, `lib/automations.ts:7`).

**Issue:** `suppress(token)` looks up a client or newsletter subscriber by `unsubToken` and flips `unsubscribed/marketingOptIn` (or `active`). The same token is reused in the footer link of *every* email forever (it is a stable column on the record, not a per-send signed/expiring token). Anyone who obtains a token (forwarded email, shared screenshot, referer leakage, server/proxy logs) can unsubscribe that specific person indefinitely. The browser `GET` (line 26-39) performs the state change with no confirmation — a prefetcher, mail-scanner, or `<img>`/link-preview bot that fetches the URL will silently unsubscribe the recipient (the very reason RFC 8058 separates one-click POST from GET). No audit record is written for unsubscribes. (Positive: tokens are per-record so one token cannot unsubscribe *others* — there is no IDOR enumerating other users.)

**Impact:** Targeted denial of marketing/care-reminder delivery to a known recipient; accidental opt-outs from link-scanning bots on the GET path; no forensic trail. Severity is limited by tokens being unguessable and scoped to one record.

**Recommendation:** Move the destructive action behind the POST (one-click) and make the GET render a confirm page that POSTs, or require a signed, single-purpose token (HMAC of `clientId|purpose|expiry`) distinct from a reusable column. Log each suppression (actor=token, ip, time). Consider rotating `unsubToken` after use for the account case.

---

### [MEDIUM] `replyTo` / `fromName` and email `href`s are passed through without value validation (header-injection & arbitrary-link surface)

**Location:** `app/api/admin/marketing/email/send/route.ts:52-53` (`fromName`/`replyTo` only `.trim().slice()`); `lib/email.ts:39,46` (placed into From/Reply-To); `lib/email-builder.ts:63,66` (button/image `href` HTML-escaped but not scheme-validated).

**Issue:** `replyTo` is accepted as free text up to 120 chars and `fromName` up to 80, then used to construct the From header (`` `${fromName} <${FROM_ADDRESS}>` ``) and the Reply-To. Neither is validated as a well-formed address nor stripped of CR/LF. The email builder escapes `href` for HTML context but does not restrict the URL scheme, so `javascript:`/`data:`/arbitrary `https://attacker` links pass into buttons and image links composed by an author. The `to:` recipient in campaigns is the stored client email and is not re-validated before send.

**Impact:** If the Resend SDK/API did not normalise headers, embedded `\r\n` in `replyTo`/`fromName` would be MIME header injection (extra headers/BCC). In practice Resend's JSON API mitigates raw CRLF injection, so this is defence-in-depth rather than a confirmed live header-injection — but the in-app code provides no protection of its own. The unrestricted `href` lets a campaign author embed off-brand/phishing/`javascript:` links (mostly inert in mail clients, but a redirect/brand-abuse vector and a risk if any of this HTML is ever rendered in-app).

**Recommendation:** Validate `replyTo` against an email regex and reject any value containing `\r`/`\n`; strip control chars from `fromName`. Whitelist URL schemes (`http`/`https`/`mailto`/`tel`) for `href` in `emailBlockToHtml`. Re-validate recipient addresses before send.

---

### [MEDIUM] SMS has no rate limit or cost cap; reminder loop can re-fire on per-booking errors

**Location:** `lib/sms.ts:11-35`; senders in `lib/booking-notify.ts:77-83`, `lib/automations.ts:285-302`, `app/api/admin/bookings/request-card/route.ts:49-53`.

**Issue:** `sendSms` posts straight to Twilio with no throttle, no daily spend ceiling, and no length cap on `body` (the dummy path truncates only the log line, `lib/sms.ts:15`; the real send sends the full body, line 26). SMS bodies interpolate `treatmentTitle` and manage URLs; `treatmentTitle` is staff-controlled but unbounded here. The staff `request-card` route can send SMS on demand behind `bookings.charge` but with no rate limit (consistent with the email finding above). In the daily reminder loop (`lib/automations.ts:287-304`), `db.booking.update({ remindersSent: true })` runs *after* the per-booking work inside the loop body; an exception earlier in the iteration would skip the flag — though `Promise`-less sequential `await`s and the `.catch(() => {})` on the SMS call largely contain this, there is no outer try/catch per booking, so a throw (e.g. in `sendEmail`) before the flag-set could leave `remindersSent:false` and re-send next run.

**Impact:** Cost-explosion / SMS pumping if an attacker can drive SMS sends (e.g. via repeated card-request triggers) or if a data condition causes the reminder loop to reprocess; potential duplicate reminders. No OTP-over-SMS was found in scope (2FA/passkey paths are separate), so OTP-reuse is not applicable here.

**Recommendation:** Add a per-recipient and global daily SMS cap + rate limit, cap `body` length, and wrap each booking iteration in try/catch so one failure neither aborts the batch nor blocks the `remindersSent` write. Apply `enforceRateLimit` to `request-card`.

---

### [LOW] `test` campaign send is unlogged and unthrottled

**Location:** `app/api/admin/marketing/email/send/route.ts:57-72`.

**Issue:** The test branch sends a fully attacker-composed email to any address with no `EmailEvent`/audit record and no rate limit (it returns before the persisted/audited paths). Distinct from the mass-send finding: this is the *stealth* aspect — sends leave no trace.

**Impact:** Authenticated users can send arbitrary content from the verified domain to arbitrary addresses with no audit trail; aids abuse and hampers incident response.

**Recommendation:** Log every test send (actor, to, subject) and rate-limit it tightly.

---

### [LOW] Appointment-reminder template hard-codes a clinic address that ignores the booking's location

**Location:** `lib/email.ts:694` (`tmplAppointmentReminder` — literal `4 Charterhouse Buildings, Goswell Road, London EC1M 7AN`).

**Issue:** Unlike `tmplBookingConfirmation` (which uses the booking's `location` fields), the reminder hard-codes one address. For a multi-location clinic this sends clients to the wrong place. Not a security issue per se, but a correctness/data-integrity defect in a customer-facing comms path within scope.

**Impact:** Misdirected clients; erodes trust in transactional mail.

**Recommendation:** Thread the booking's `location` into `tmplAppointmentReminder` as the confirmation does.

---

### [LOW] PII (names, emails, phones, treatment) written to logs in plaintext

**Location:** `lib/sms.ts:15` (`[sms:dummy] → ${to}: ${body}…`), `lib/notifications.ts:26`, automation `console.error` lines, `app/api/consult/route.ts:110`.

**Issue:** Dummy-mode SMS logs the recipient number and message; various error paths log messages that can contain identifiers. Booking/consult flows put client names and treatments into log lines. In dummy mode the whole SMS (incl. manage-token URL) is logged.

**Impact:** PII/secret-bearing URLs (manage tokens) in log aggregation; GDPR data-minimisation concern.

**Recommendation:** Redact recipient identifiers and tokens from logs; log IDs, not contents.

---

### [LOW] Newsletter / waitlist confirmation does not re-suppress a previously-unsubscribed address on re-subscribe edge cases

**Location:** `app/api/newsletter/route.ts:25-29`, `app/api/dentistry-interest/route.ts:25-29`, `app/api/unsubscribe/route.ts:17-21`.

**Issue:** `unsubscribe` for a newsletter-only subscriber sets `active:false` but the upsert on re-subscribe sets `active:true` again (expected for explicit re-opt-in). However, the unsubscribe path only toggles `active` and does not record a suppression/consent-withdrawal timestamp, and a re-subscribe immediately re-enables sending; there's no cool-off or audit of the consent transition. For the Client path, `unsubscribed:true` correctly hard-blocks all sends (`audienceWhere` + `canEmail`/`canEmailCare`), which is good.

**Impact:** Weak consent audit trail for newsletter subscribers (PECR/GDPR record-keeping); minor.

**Recommendation:** Stamp `unsubscribedAt`/`consentWithdrawnAt` and keep a consent history for subscribers as is done for clients.

---

### [INFO] Strong unsubscribe-suppression and consent gating across the marketing path

**Location:** `lib/email-campaigns.ts:13-21` (`audienceWhere` forces `marketingOptIn:true, unsubscribed:false`), `lib/automations.ts:169-176` (`canEmail`/`canEmailCare`), `lib/followup.ts:21`, webhook list-hygiene `app/api/webhooks/resend/route.ts:64-71`.

**Issue/Note:** Every marketing audience query is restricted to opted-in, non-unsubscribed clients; care/transactional mail still honours the hard `unsubscribed` flag; bounces/complaints auto-suppress. RFC 8058 `List-Unsubscribe`/`List-Unsubscribe-Post` headers are set on campaign and newsletter sends. This is good compliance hygiene — recorded as a positive.

---

### [INFO] Cron entrypoints and Resend webhook are properly authenticated / fail-closed

**Location:** `app/api/cron/daily/route.ts:14-18`, `app/api/cron/dispatch/route.ts:12-16` (both require `Bearer ${CRON_SECRET}`, refuse if unset); `app/api/webhooks/resend/route.ts:10-30` (Svix HMAC verify; fails closed in production when no secret).

**Issue/Note:** Mass-send triggers (daily automations, campaign dispatcher) cannot be invoked anonymously, and the delivery webhook — which can flip clients to `unsubscribed` — verifies signatures and refuses unsigned calls in production. Recorded as a positive.

---

### [INFO] Resend / Twilio secrets are read from env and not echoed to clients

**Location:** `lib/email.ts:8-9`, `lib/sms.ts:8,19-26`, `app/api/webhooks/resend/route.ts:23`.

**Issue/Note:** API keys come solely from `process.env` (`RESEND_API_KEY`, `TWILIO_*`, `RESEND_WEBHOOK_SECRET`); `sendEmail`/`sendSms` return generic `{ ok, error }` and never include the key. `lib/email.ts` and `lib/sms.ts` are `server-only`. No hardcoded credential found. Off-production, `account/signup` surfaces an error `detail` to the client (`app/api/account/signup/route.ts:34-36`) — ensure `VERCEL_ENV==='production'` is always set in prod so internal messages aren't leaked.

---

## Send-path inventory

| Trigger (file:line) | Recipients source | Authz | Rate limit | Dynamic-value escaping |
|---|---|---|---|---|
| Campaign immediate send — `app/api/admin/marketing/email/send/route.ts:124-129` → `lib/email-campaigns.ts:72-75` | Opted-in clients via `audienceWhere` (≤5000) | `campaigns.send` | **None** | Block text escaped; **merge tags (name/email) unescaped** (`email-campaigns.ts:52`) |
| Campaign `sendNow` (persisted) — `:27-35` → `email-campaigns.ts:79-94` | Same | `campaigns.send` | **None** | Same merge-tag gap |
| Campaign A/B test — `:106-121` → `email-campaigns.ts:101-129` | Sampled opted-in clients | `campaigns.send` | **None** | Same merge-tag gap |
| Campaign **test send** — `:57-72` | **Arbitrary `body.test` address** | `campaigns.send` | **None / unlogged** | Same merge-tag gap |
| Scheduled campaign dispatch — `app/api/cron/dispatch/route.ts` → `email-campaigns.ts:169-184` | Opted-in clients | `CRON_SECRET` | Cron cadence | Same merge-tag gap |
| Daily automations (birthday/winback/review/followup/reminder/forms/tier/anniversary/renewal/abandoned) — `app/api/cron/daily/route.ts` → `lib/automations.ts:19-339` | Clients filtered by `canEmail`/`canEmailCare` | `CRON_SECRET` | Per-kind dedup via `EmailEvent` | Templates escape; **raw `${c.firstName}` in tier/renewal/anniversary bodies** (`:47,87,116`) |
| 1-week follow-up questionnaire — `lib/followup.ts:9-29` | COMPLETED-booking clients, `!unsubscribed` | `CRON_SECRET` (via daily) | `followUp:null` gate | Template escapes (`tmplFollowUpQuestionnaire`) |
| Booking confirmation + clinic notify + SMS — `lib/booking-notify.ts:60-86` | Booking client email; clinic env address; client phone | Internal (post-confirm) | Once per confirm | Templates escape; SMS body raw `treatmentTitle` |
| Card-on-file request (email/SMS) — `app/api/admin/bookings/request-card/route.ts:40-53` | Booking client email/phone | `bookings.charge` | **None** | `tmplCardRequest` escapes; SMS raw |
| Public enquiry → reply + clinic notify — `app/api/consult/route.ts:92-99` | Submitter email; clinic env address | Public + honeypot | `consult` 5/600s | `tmplConsultReply`/`tmplClinicNotify` escape |
| Newsletter welcome — `app/api/newsletter/route.ts:36-41` | Submitter email | Public + honeypot | `newsletter` 5/600s | Static body |
| Careers application + applicant ack — `app/api/careers/apply/route.ts:37-40` | Clinic env address; applicant email | Public + honeypot | `careers-apply` 5/600s | Local `esc()` applied |
| Password reset / changed — `app/api/account/forgot-password/route.ts` → `lib/client-auth` (`tmplPasswordReset`) | Account email (server-side) | Public + honeypot (no enumeration) | `forgot` 5/900s | Template escapes |
| Live-chat reply / transcript — `lib/chat-email.ts:77-138` | `conversation.visitorEmail` (server-side) | Internal / unguessable token | `emailedAt` once-only | `tmplChatReply`/`tmplChatTranscript` escape; per-convo Reply-To |
| SMS reminders — `lib/automations.ts:299-302` | Client phone, `smsReminders` opt-in | `CRON_SECRET` | `remindersSent` flag | Raw `treatmentTitle` in body |
| Staff digest / nudge — `lib/staff-emails.ts:39-87` | Active admin users (server-side) | `CRON_SECRET` + setting gate | dedup `sentTo` | `tmplStaffDigest`/`tmplStaffNudge` escape |
| In-app staff notification — `lib/notifications.ts:11-28` | Known active admin user only | Internal | n/a | Stored as data, truncated |
| Unsubscribe (GET/POST) — `app/api/unsubscribe/route.ts:26-48` | Token → single record | **Token only** | **None** | n/a (state change) |
| Resend delivery webhook — `app/api/webhooks/resend/route.ts:20-72` | n/a (updates `EmailEvent`, can suppress client) | Svix HMAC, fail-closed | n/a | n/a |

## Files reviewed

- `lib/email.ts` — `sendEmail`, `emailShell`, all transactional/marketing templates, `escape()`
- `lib/email-builder.ts` — block→HTML, `applyMergeTags` (escaping gap)
- `lib/email-templates.ts` — starter templates
- `lib/email-campaigns.ts` — audience, deliver, send/A-B/dispatch
- `lib/email-heroes.ts`, `lib/brand-email-assets.ts` — inline media (bundled base64; not separately read in full)
- `lib/email-previews.ts` — dashboard previews (static sample data)
- `lib/staff-emails.ts`, `lib/notifications.ts`, `lib/sms.ts`, `lib/followup.ts`, `lib/automations.ts`, `lib/booking-notify.ts`, `lib/chat-email.ts`
- `app/api/admin/marketing/email/send/route.ts`, `.../email/templates/route.ts`, `.../campaigns/route.ts`, `.../replay/route.ts`
- `app/api/unsubscribe/route.ts`, `app/api/webhooks/resend/route.ts`
- `app/api/cron/dispatch/route.ts`, `app/api/cron/daily/route.ts`
- `app/api/consult/route.ts`, `app/api/newsletter/route.ts`, `app/api/dentistry-interest/route.ts`, `app/api/careers/apply/route.ts`, `app/api/account/signup/route.ts`, `app/api/account/forgot-password/route.ts`, `app/api/follow-up/route.ts`, `app/api/admin/bookings/request-card/route.ts`
- `lib/validation.ts` (name/field constraints), supporting grep of `app/api/**` for send/notify/unsubscribe/webhook routes and `dangerouslySetInnerHTML` in `app/**`
