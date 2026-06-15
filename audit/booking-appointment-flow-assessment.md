# Booking & Appointment Flow — End-to-End Assessment

Date: 2026-06-15. Triggered by a reported production incident: selecting/confirming a
booking slot showed "Network error. Please try again." while the appointment was in
fact created, and no confirmation email or SMS was sent.

Scope: the full client-facing booking lifecycle and the in-clinic appointment lifecycle —
slot availability, booking creation (account + non-account), card setup, confirmation
comms, reminders, cancel/reschedule, completion, off-session charge, the Stripe webhook,
the manage-booking page, and the in-appointment `/live` phone companion. Security-domain
detail for payments and email lives in `02-payments-finance.md` and
`09-email-notifications.md`; this report is the functional/reliability lens and does not
duplicate them.

Method: read the routes and libs directly (`app/api/booking/**`, `lib/booking-notify.ts`,
`lib/booking-actions.ts`, `lib/automations.ts`, `lib/availability.ts`, `lib/email.ts`,
`lib/sms.ts`, `app/api/stripe/webhook/route.ts`, the live-session stack). The live site and
database were not reachable from the audit sandbox (network policy), so this is
code-level, not runtime, analysis.

## Verdict

The booking and appointment core is well built where it matters most for a clinic:
double-booking is prevented by Serializable slot holds, double-charge by atomic
compare-and-swap claims plus Stripe idempotency keys, and slot/time maths is correct
across BST/GMT. The reported incident was real and is a single, recurring defect class
rather than a flaw in the booking logic: **work done after a row was already committed
(notifications, Stripe side-effects) could throw and 500 the user-facing response**, so the
client saw an error for an action that had succeeded, and the comms never sent. The same
pattern existed in three places (booking confirm, charge receipt, cancellation). All three
are fixed in this change set, along with a reminder timezone boundary bug.

The residual risk is **delivery configuration**: email and SMS only send if the owner-managed
provider keys are set, and a failure there is now recorded but cannot be fixed in code.

## Severity counts

| Severity | Count | Status |
|----------|-------|--------|
| High     | 1 | Fixed |
| Medium   | 3 | Fixed |
| Low      | 4 | Open (hardening / by-design) |
| Info     | 2 | — |
| **Total** | **10** | |

## The reported incident — root cause and fix

All three reported symptoms (network error, no email, no SMS) had one cause: post-commit
work could throw and 500 the booking response after the booking row was committed.

- `app/api/booking/start/route.ts` — returning client with a saved card: the booking is set
  `CONFIRMED`, then `notifyBookingConfirmed()` was awaited unguarded. Any throw inside it →
  500 → the client's `submitBooking` catch → "Network error", on an already-confirmed booking.
- `app/api/booking/start/route.ts` — new client: `stripe().setupIntents.create(...)` ran
  unguarded after the `PENDING` booking was committed. A Stripe blip → 500 → "Network error",
  plus a dangling held slot.
- `app/api/booking/confirm/route.ts` — same pattern: `CONFIRMED`, then unguarded
  `notifyBookingConfirmed()`; and `CardStep.submit` in `components/booking/BookingFlow.tsx`
  had no try/catch around `res.json()`, so a 500 froze the button on "Confirming…".

Notifications only fire from `notifyBookingConfirmed`, so any throw on that path means nothing
is delivered — explaining "no email, no SMS" alongside the error.

Fix (this change set):
- `lib/booking-notify.ts`: `notifyBookingConfirmed` can no longer throw; the booking is already
  CONFIRMED before it runs, so comms are best-effort. Failures are logged and the client email
  is recorded as a FAILED `EmailEvent`. Protects both call sites and any future caller.
- `app/api/booking/start/route.ts`: SetupIntent creation is guarded. On failure the held slot
  is released (`CANCELLED`, with an audit entry) and a clean, actionable error is returned
  instead of a 500.
- `components/booking/BookingFlow.tsx`: `CardStep.submit` no longer hangs on a 500 (confirm is
  idempotent, so retry is safe and never double-books); `submitBooking`'s catch no longer
  mislabels a server error as a plain network error or implies an unsafe blind retry.

## Findings across the lifecycle

| # | Severity | Status | Area | Finding | Location |
|---|----------|--------|------|---------|----------|
| 1 | High | Fixed | Confirm | Unguarded notify/Stripe after commit → 500 on a booked appointment, surfaced as "Network error"; no comms sent | `app/api/booking/start/route.ts`, `app/api/booking/confirm/route.ts`, `components/booking/BookingFlow.tsx` |
| 2 | Medium | Fixed | Charge | Receipt email logged `SENT` before the send was attempted, masking real failures; detail lookup + send unguarded after the card was charged | `lib/booking-actions.ts:106,119-124` |
| 3 | Medium | Fixed | Cancel | Cancellation email result ignored and unrecorded — a silent provider/config failure left the client unnotified with no trace | `lib/booking-actions.ts:350-355` |
| 4 | Medium | Fixed | Reminders | 24h/48h/72h window bounds computed in server TZ (UTC on Vercel), not Europe/London, so near-midnight appointments could be reminded a day early/late | `lib/automations.ts:297-299` |
| 5 | Low | Open | Availability | `popularDays()` and the slot list show availability that the atomic hold may have taken since; the hold catches it (409) but the UI can offer a stale slot | `lib/availability.ts:282-300` |
| 6 | Low | Open | Booking-create | The non-account `create` route always creates a SetupIntent and never reuses a card on file (unlike `start`); minor UX cost, not a correctness issue | `app/api/booking/create/route.ts:196` |
| 7 | Low | Open | Webhook | A transient DB error on a non-critical event (`payment_intent.payment_failed`) returns 200 and is not retried; staff still notice via the unchanged booking record | `app/api/stripe/webhook/route.ts:126-127` |
| 8 | Low | Open | Manage | Reschedule UI state is client-local and clears on refresh mid-flow | `app/(marketing)/booking/manage/ManageClient.tsx` |
| 9 | Info | — | Availability | Slot maths converts clinic-local wall time to UTC correctly via `lib/clinic-time.ts` (BST/GMT proven); double-booking held in a Serializable transaction | `lib/availability.ts`, `app/api/booking/start/route.ts:161-194` |
| 10 | Info | — | Charge | Off-session charge is gated (COMPLETED, consent/before-photo), capped (4× price fat-finger guard), and idempotent (atomic `chargedAt:null` claim + Stripe key); webhook is the backstop incl. SCA recovery | `app/admin/bookings/actions.ts:36-62`, `lib/booking-actions.ts:78-98`, `app/api/stripe/webhook/route.ts` |

## Notification delivery — the remaining dependency (owner action)

Code can guarantee the confirmation/receipt/cancellation comms are *attempted* and *recorded*;
it cannot send them if the providers are not configured. Both helpers return a result rather
than throwing, so an unconfigured provider fails quietly:

- Email (`lib/email.ts:32-33`): no `RESEND_API_KEY` → `sendEmail` returns `{ok:false}` and the
  attempt is recorded as a FAILED `EmailEvent`. Resend also requires a verified sending domain;
  an unverified domain fails the same way.
- SMS (`lib/sms.ts:18-22`): without `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM`,
  sending is inert (dummy success in dev; the booking-notify path gates on real config so no
  client SMS goes out in production until Twilio is set).

To confirm delivery is live: check the admin email log for recent `Booking confirmation` /
`Payment receipt` rows. After this change set, a `FAILED` row carries the provider error
(e.g. "RESEND_API_KEY not configured" or a domain error), which tells you exactly what to set
in Settings → Credentials. Verify keys are present and the Resend domain is verified; add the
Twilio credentials to enable SMS.

## `/live` phone companion enhancements (this change set)

The in-appointment QR opens `/live/[token]` (token = the booking's unguessable `manageToken`),
a read-only SSE mirror of the session. Added so far, and planned:

- Done: itemised price + add-ons on the client's phone — each booked line at the price the
  card will be charged (net of discount), the held total, and the amount once taken at checkout.
  Sanitised through `ClientLiveView`; no clinical or PII detail.
  (`lib/appointment-session-server.ts`, `components/live/LiveCompanion.tsx`).
- Done: consent forms surfaced inline. When the clinician generates a consent request during the
  visit, it appears live (over SSE) on the client's phone as a "Your forms" card; tapping it opens
  a focused, light-themed sheet that reuses the shared `ConsentSigner` (read → tick → sign with the
  canvas pad) and the existing token-authed `/api/consent/sign`, so the immutable `SignedConsent`
  record, certificate and integrity hash are identical to the standalone `/sign/[token]` flow.
  A new token-scoped `GET /api/consent/[token]` serves the content; the sheet falls back to the
  dedicated page if it can't load. Signed forms then show as completed on the companion.
  (`lib/appointment-session-server.ts`, `components/live/LiveCompanion.tsx`,
  `app/api/consent/[token]/route.ts`).
- Follow-up: token-authed health-intake (medical history) on `/live`. Health questionnaires are
  account-gated today (`/account/assessments`) and capture answers, not signatures; surfacing a
  fill-in flow on the token-authed live page (special-category data, client identity) is a separate
  piece. Until then the consent forms above are the read/tick/sign surface on the phone.

## Recommended follow-ups (prioritised)

1. Owner: verify `RESEND_API_KEY` + a verified Resend domain are set; add Twilio for SMS. Then
   send a test booking and confirm the email log shows `SENT`. (Highest impact — without this,
   the code fixes still produce no delivered mail.)
2. Consider holding a short soft-lock on a slot when it is offered (or surface a friendlier
   "just taken" recovery) to reduce stale-slot 409s from finding #5.
3. Reuse a card on file in the non-account `create` route (finding #6) to match `start`.
4. Optional: a small admin health indicator that turns red when recent confirmation emails are
   FAILED, so a provider/domain problem is noticed without reading the log.
