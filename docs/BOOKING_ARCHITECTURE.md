# K Clinics — Custom Booking & Payments

Replaces Treatwell/Fresha with a first-party booking system on Stripe.

## Core principle: no charge until the service is delivered
- At booking, the client's card is **saved** via a Stripe **SetupIntent**
  (`usage: off_session`). **No payment is taken.**
- The card is charged **only** when:
  1. Staff mark the service delivered and press **Charge** (manual, adjustable), or
  2. The client cancels **within 24h** of the start (100% late-cancellation fee),
     unless a staff/admin user **overrides/waives** it.
- Cancelling **>24h before** the appointment is **free**; the saved card is released.
- BLD-1920: the 24h fee logic above is about *money*, not *access* — the client can
  only reach `cancelBooking`/`rescheduleBooking` themselves with **>=48h** notice at
  all (`lib/cancellation-policy.ts`). Inside 48h, self-service cancel/reschedule is
  blocked outright (`code: 'SELF_SERVICE_WINDOW_CLOSED'`); staff (`opts.admin: true`)
  are exempt and still hit the 24h fee rule at any notice.

## Scheduling: slot-based (single resource)
- Opening hours come from `site.hours`; bookable slots are generated per treatment
  duration at a configurable interval (`SLOT_INTERVAL_MIN`, default 15) and exclude
  any time overlapping an existing active booking. (One treatment room model — a
  slot is taken if *any* active booking overlaps it.)
- `lib/availability.ts` computes free slots for a date + duration.

## Pricing
- Each treatment carries `pricePence` and `durationMin` (`lib/treatments.ts`).
- `pricePence === null` ⇒ "On consultation": booked as a £0 card-on-file hold,
  amount assessed in clinic (staff set the amount at Charge time).

## Stripe objects
- **Customer** — one per client (`Client.stripeCustomerId`), reused across bookings.
- **SetupIntent** — saves the card at booking (off_session). No charge.
- **PaymentIntent** — created off_session at Charge / late-cancel, confirmed with
  the saved payment method. Handles SCA: if `authentication_required`, the booking
  is flagged and the client is emailed a secure payment link.

## Data model (Prisma — additions)
- `Booking`
  - client, treatmentSlug/Title, startAt, endAt, durationMin, pricePence
  - status: `PENDING` → `CONFIRMED` → `COMPLETED` | `CANCELLED` | `NO_SHOW`
  - stripeCustomerId, stripePaymentMethodId, stripeSetupIntentId
  - chargePaymentIntentId, chargedPence, chargedAt
  - cancelledAt, cancelReason, lateCancel (bool), feeWaived (bool)
  - manageToken (for the client's self-service cancel link)
- `Client.stripeCustomerId` (added)

## API
- `POST /api/booking/availability` — { slug, date } → free slots
- `POST /api/booking/create` — { slug, startISO, client fields } →
  upserts client + Stripe customer, creates SetupIntent, returns client_secret + bookingId
- `POST /api/booking/confirm` — { bookingId } after Elements confirms the SetupIntent →
  attaches PM, sets CONFIRMED, sends confirmation email
- `GET  /api/booking/manage?t=token` — client self-service view (cancel)
- `POST /api/booking/cancel` — { token | bookingId } → applies the 24h rule
- `POST /api/stripe/webhook` — setup/payment intent status sync

## Admin (`/admin/bookings`)
- List + calendar of bookings; detail with **Charge** (adjustable), **Mark complete**,
  **Cancel** (with within-24h fee + **waive** override), **No-show**.

## Emails (Resend, branded)
- Booking confirmation · cancellation (free) · late-cancellation charge receipt ·
  service charge receipt · payment-action-required (SCA fallback).

## Env (add to .env.example / Vercel)
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
SLOT_INTERVAL_MIN (optional), BOOKING_TIMEZONE=Europe/London
