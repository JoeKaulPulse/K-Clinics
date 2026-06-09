# Payments & Finance Audit

## Summary

This audit covers the payments and finance surface of K-Clinics: Stripe integration (webhook, booking charges, retail checkout, gift vouchers/packages, POS), promo/voucher/membership logic, VAT, cashflow, finance lock, day-close, and the Xero/TrueLayer financial feeds.

Overall the payment core is **well-engineered and notably defensive**. The patterns that most often go wrong in commerce code are handled correctly here:

- **Server-authoritative pricing.** Retail carts are re-priced from the DB (`lib/shop.ts:23` `validateCart`), booking prices come from the catalogue server-side (`app/api/booking/create/route.ts:50`), and the promo preview endpoint takes the price from the catalogue, never the client (`app/api/promo/validate/route.ts:19-21`). The client cart is explicitly a display snapshot (`lib/cart.ts:5-7`).
- **Webhook signature verification** is present, correct, and on the raw body (`app/api/stripe/webhook/route.ts:14-20`).
- **Idempotent finalisation** via atomic `updateMany` claims for orders (`lib/shop.ts:62`), booking charges (`lib/booking-actions.ts:175`) and voucher activation (`lib/gift-vouchers.ts:118`), so a webhook + a client confirm can't double-fulfil/double-email.
- **Atomic balance/redemption guards** on gift-voucher redemption (`lib/gift-vouchers.ts:162-166`), voucher claim (`lib/gift-vouchers.ts:187`) and promo redemption inside a `Serializable` transaction (`lib/promo.ts:56-69`).
- **Refunds** are window-bounded, capped to the remaining refundable amount, audit-logged, and permission-gated (`lib/booking-actions.ts:111-160`, `app/admin/bookings/actions.ts:101-117`).
- **Off-session charge guardrails**: must be `COMPLETED`, consent/before-photo gates, and a 4×-price "fat-finger" ceiling (`app/admin/bookings/actions.ts:36-46`).
- **Admin finance mutations** consistently require `finance.manage` / `finance.view` / `pos.use` (`app/api/admin/cashflow/route.ts:14`, `app/api/admin/orders/route.ts:11-13`, `app/api/admin/gift-vouchers/route.ts:10-12`, `app/api/admin/pos/route.ts:13`, `app/api/admin/finance/controls/route.ts:9-11`).

The findings below are the residual gaps. The most material are a **gift-card multi-use window in retail checkout** and a **gift-package webhook backstop gap** (paid-but-undelivered). The rest are defence-in-depth and hardening.

## Severity counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Medium   | 3 |
| Low      | 4 |
| Info     | 3 |

## Findings

### [High] Gift card can be spent on multiple concurrent retail orders (no reservation between checkout and finalisation)

**Location** `app/api/shop/checkout/route.ts:41-46` (reserve) and `lib/shop.ts:74-79` (redeem at finalise)

**Issue** At retail checkout the gift card is only *read* and the discount reserved against the new order; the actual balance decrement (`redeemVoucher`) happens later in `finalizeOrder`, after Stripe payment succeeds:

```ts
// app/api/shop/checkout/route.ts:41
if (body.giftCardCode) {
  const v = await db.giftVoucher.findUnique({ where: { code: ... } });
  if (v && (v.status === 'ACTIVE') && v.balancePence > 0) { giftCardPence = Math.min(v.balancePence, grossPence); giftCardCode = v.code; }
  ...
}
const totalPence = Math.max(0, grossPence - giftCardPence);   // Stripe charges this reduced amount
```

The card's `balancePence` is not decremented or reserved here. A buyer who knows a valid code can open several checkouts against it (sequentially or concurrently). Each order independently sees the full balance, applies the full discount, and therefore creates a Stripe PaymentIntent for a *reduced* total. `redeemVoucher` at finalise is atomically guarded (`lib/gift-vouchers.ts:162-166`), so the **card itself won't go negative** — but the discount on the second-and-later orders was already granted at checkout time, so the clinic under-collects. Example: a £50 card applied to two separate £50 orders results in £0 + £0 charged at Stripe but only one £50 redemption sticking; the clinic ships two orders for one card.

The same shape exists for a fully gift-card-covered order (`totalPence <= 0` → `finalizeOrder` immediately, `app/api/shop/checkout/route.ts:60-64`): two simultaneous "free" orders can both finalise before either redemption lands.

**Impact** Revenue loss / gift-card value duplication. A motivated buyer (or anyone who obtains a code) can extract more goods than the card is worth. No authentication is required to reach the public checkout.

**Recommendation** Reserve the gift-card amount atomically at checkout — decrement `balancePence` when creating the order (conditional `updateMany` with `balancePence >= giftCardPence`) and re-credit on order failure/cancellation, instead of redeeming only at finalise. Alternatively, hold a row-level reservation record and validate the cumulative reserved+redeemed total never exceeds the original balance. At minimum, in `finalizeOrder` re-validate the live balance and recompute/cap the discount before treating the order as paid.

---

### [Medium] Gift *packages* are never finalised by the webhook backstop (paid-but-undelivered if the tab closes)

**Location** `app/api/stripe/webhook/route.ts:41-43` vs `lib/gift-vouchers.ts:93`

**Issue** Gift-package purchases set the PaymentIntent metadata to `kind: 'gift_package'` (`lib/gift-vouchers.ts:93`), but the webhook only finalises `kind === 'gift_voucher'`:

```ts
// app/api/stripe/webhook/route.ts:41
if (pi.metadata?.kind === 'gift_voucher' && pi.metadata?.voucherId) {
  ... confirmVoucher(pi.metadata.voucherId) ...
}
// no branch for kind === 'gift_package'
```

Activation otherwise relies entirely on the client calling `/api/gift-vouchers/confirm` after `stripe.confirmPayment({ redirect: 'if_required' })` (`components/gift/GiftVoucherFlow.tsx:165-169`). If the card requires a redirect-style 3DS step, or the customer closes the tab between successful payment and the confirm fetch, a **gift package is charged but the voucher stays `PENDING`** and no recipient/purchaser email is sent. Retail orders and plain gift vouchers have a webhook backstop for exactly this case (`app/api/stripe/webhook/route.ts:38-43`); packages do not.

**Impact** Customer is charged and receives nothing; voucher never activates; no staff-visible failure. Money taken without fulfilment. (`confirmVoucher` itself handles packages fine — only the backstop trigger is missing.)

**Recommendation** Treat both kinds in the webhook, e.g. `if ((pi.metadata?.kind === 'gift_voucher' || pi.metadata?.kind === 'gift_package') && pi.metadata?.voucherId)`. Since `confirmVoucher` is idempotent (`lib/gift-vouchers.ts:107,118-119`), this is a safe one-line fix.

---

### [Medium] Retail/voucher confirmation does not assert the amount paid equals the order/voucher total

**Location** `app/api/shop/confirm/route.ts:18-26`, `lib/shop.ts:53-96`, `lib/gift-vouchers.ts:104-123`

**Issue** Confirmation verifies the PaymentIntent reached `status === 'succeeded'` but never compares `pi.amount_received` against the persisted `order.totalPence` / voucher charge:

```ts
// app/api/shop/confirm/route.ts:21
const pi = await stripe().paymentIntents.retrieve(order.stripePaymentIntentId);
if (pi.status !== 'succeeded') return ... 402;
// → finalizeOrder(order.id)  — never checks pi.amount_received === order.totalPence
```

The booking SCA path *does* propagate `pi.amount_received` into the charged amount (`app/api/booking/pay-confirm/route.ts:30`), but retail/voucher finalisation trusts the order's stored total. Because the amount is set server-side at checkout from `validateCart`, this is not directly exploitable today — it is a missing invariant / defence-in-depth gap. It would become exploitable if any future change let the order total or the PaymentIntent amount diverge (e.g. partial captures, multi-capture, or a writable order amount).

**Impact** No confirmed exploit on the current code path, but the system records an order as fully paid without proving the captured amount matches the price. A divergence (future bug, manual PI manipulation, partial capture) would mark an under-paid order as `PAID`/`FULFILLED`.

**Recommendation** In `finalizeOrder` (and `confirmVoucher`), assert `pi.amount_received >= order.totalPence` (and currency `gbp`) before flipping to PAID/ACTIVE; reject or flag a mismatch for staff review.

---

### [Medium] Cash reserve balances can be set to arbitrary values with no audit log

**Location** `app/api/admin/cashflow/route.ts:65-98`

**Issue** `createReserve` / `updateReserve` write `balancePence` directly from the request body (`balancePounds → toPence`) with `finance.manage` but **no audit log entry** (unlike the order/voucher/finance-controls handlers, which all call `logAudit`). Reserve balances feed the cashflow forecast's "ring-fenced" cash and the safety-floor logic (`lib/cashflow.ts:173-209`). There is also no `deleteEntry`/`deleteReserve` audit trail.

**Impact** A `finance.manage` holder can silently rewrite the recorded reserve/operating cash position used for financial planning, with no immutable record of who changed it or when. Weakens financial integrity / non-repudiation for the figures the owner relies on.

**Recommendation** Add `logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, ... })` to every mutating branch of the cashflow handler (config, drivers, create/update/delete entry and reserve), mirroring `app/api/admin/finance/controls/route.ts:21,28,39`.

---

### [Low] Booking `/confirm` is authorised only by the (non-secret) booking id

**Location** `app/api/booking/confirm/route.ts:8,20-37`

**Issue** Unlike `/api/booking/card-saved` and `/api/booking/cancel`, which require the unguessable `manageToken` (`app/api/booking/card-saved/route.ts:20`, `app/api/booking/cancel/route.ts:17`), `/confirm` accepts a bare `bookingId`. With a valid booking id an unauthenticated caller can drive the booking to `CONFIRMED`, set the saved card as the customer's Stripe default PM (`app/api/booking/confirm/route.ts:32`), and trigger confirmation comms (`:40-41`). It is gated by the SetupIntent actually having succeeded, and **no charge is taken**, so impact is limited; booking ids are cuids (high entropy), so this is not trivially enumerable.

**Impact** If a booking id leaks, a third party can prematurely confirm the booking and fire customer emails/SMS. No financial loss directly.

**Recommendation** Authorise `/confirm` with the `manageToken` (or the client session) like the sibling endpoints, rather than the booking id alone.

---

### [Low] Stripe webhook has no explicit replay/event-id de-duplication

**Location** `app/api/stripe/webhook/route.ts:14-71`

**Issue** Signature verification (`constructEvent`) prevents forged events and, with Stripe's default tolerance, stale-timestamp replays — good. However the handler does not record processed `event.id`s, so a replay of a *recently* signed event (within tolerance) would re-run the branch. In practice every downstream action is idempotent (`finalizeBookingCharge` / `finalizeOrder` / `confirmVoucher` all use atomic claims), so this currently causes no double-charge or double-fulfilment. It is defence-in-depth rather than an active bug.

**Impact** Low — mitigated by downstream idempotency. Would matter if a future, non-idempotent webhook branch is added.

**Recommendation** Persist handled `event.id`s (e.g. a `WebhookEvent` table with a unique constraint) and short-circuit duplicates at the top of the handler.

---

### [Low] Finance PIN unlock and promo validation rate-limits fail open

**Location** `lib/security/rate-limit.ts:25-45`, `app/api/admin/finance/unlock/route.ts:29-32`, `app/api/promo/validate/route.ts:14-15`

**Issue** `rateLimit` "fails open" on any store error and when neither Redis nor the Postgres fallback can be reached (`lib/security/rate-limit.ts:33,42-44`). The finance-PIN unlock (6 digits, ~1M space) relies on this limiter (8 / 300s) to blunt guessing (`finance/unlock/route.ts:30`); the promo validator relies on it (20 / 600s) to stop discount-code brute force (`promo/validate/route.ts:15`). The fixed-window Postgres fallback also allows up to ~2× the nominal rate at window boundaries. If the limiter store is degraded, both protections silently disappear.

**Impact** Under store outage, brute-forcing the finance PIN or harvesting valid promo codes becomes feasible. The finance PIN is a *second* factor behind an authenticated `finance.view` session, which contains the blast radius.

**Recommendation** For the finance PIN specifically, add a durable per-user failed-attempt counter / lockout (DB-backed, independent of the rate limiter) so protection survives a limiter outage. Consider failing closed for the most sensitive scopes.

---

### [Low] Off-session SCA recovery link (PaymentIntent client_secret) emailed in plaintext URL

**Location** `lib/booking-actions.ts:78-86`

**Issue** When an off-session charge needs authentication, the client is emailed a link containing the PaymentIntent `client_secret` as a query param (`/booking/pay?pi=<client_secret>`, `lib/booking-actions.ts:79`). The `/pay-confirm` endpoint correctly re-verifies the secret server-side and only finalises a genuinely-succeeded intent (`app/api/booking/pay-confirm/route.ts:16-31`), so this is the intended Stripe pattern. The residual risk is the usual one of secrets-in-URLs: email logs, link previews, and referrer leakage could expose a `client_secret` that authorises completing that specific payment.

**Impact** Low and bounded to a single, already-initiated charge for that booking; cannot create new charges or read card data.

**Recommendation** Acceptable as-is for Stripe SCA recovery. If tightening is desired, mint a short-lived opaque token mapping to the PaymentIntent server-side instead of embedding the `client_secret`.

---

### [Info] Money is consistently integer pence; rounding is centralised and sane

**Location** `lib/vat.ts:51-61`, `lib/promo.ts:44-49`, `lib/shop.ts:38`, `lib/gift-vouchers.ts:158`

**Issue / Note** All monetary values are integer pence end-to-end; no floating-point accumulation of currency was found. VAT splits round once with `Math.round` and handle inclusive/exclusive and exempt/zero correctly (`lib/vat.ts:51-61`); promo discounts cap to the price and clamp percent to 0–100 (`lib/promo.ts:44-49`); voucher redemption clamps to `[0, balance]` (`lib/gift-vouchers.ts:158`). External feeds (Stripe/Xero/TrueLayer) convert major-unit floats to pence with a single `Math.round(x * 100)` (`lib/finance-feeds.ts:36`, `lib/xero.ts:144`, `lib/truelayer.ts:67`) — fine for display/forecast use. No action required; recorded as a positive finding.

---

### [Info] Code-generation entropy for vouchers and promo codes is adequate

**Location** `lib/gift-vouchers.ts:13-16`, `lib/promo.ts:8-11`

**Issue / Note** Gift-voucher codes use `crypto.randomBytes` for two 16-bit segments (`KC-GV-XXXX-XXXX`, ~32 bits, `lib/gift-vouchers.ts:14`); promo codes use `crypto.randomBytes(4)` (~32 bits, `lib/promo.ts:9`). Both use a CSPRNG (not `Math.random`), enforce uniqueness, and personal promo codes additionally bind to an email + single use + once-per-client (`lib/promo.ts:84-86`). 32 bits is not large for an *online-guessable* secret, but the promo validator and (for retail) the checkout are the only guess surfaces, and the promo path is rate-limited. Voucher *redemption* requires staff (`finance.manage`) so codes aren't directly guess-redeemable online. Consider widening voucher codes to ~48+ bits if they ever become self-service redeemable. Recorded as informational.

---

### [Info] OAuth secrets (Xero/TrueLayer/Stripe) are handled correctly server-side

**Location** `lib/xero.ts:12-37`, `lib/truelayer.ts:10-37`, `lib/stripe.ts:1-17`, `lib/finance-feeds.ts:22-41`

**Issue / Note** All three integrations are `server-only`, read credentials from env, and never expose secrets to the client. Xero/TrueLayer connect endpoints require `settings.manage` (`app/api/admin/integrations/xero/connect/route.ts:9-11`) and use CSRF `state` (`oauth-state`). Tokens are stored via `saveConnection` and refreshed server-side. Data flowing *out* is read-only (balances, supplier contacts, bills) — no financial data is pushed to Xero/TrueLayer. Stripe balance is fetched with `cache: 'no-store'` and a 4s timeout (`lib/finance-feeds.ts:31-32`). Recorded as a positive finding; confirm the OAuth `state` validation and token-at-rest encryption in `lib/oauth-connections.ts` / `lib/oauth-state.ts` (out of this audit's file scope) as a follow-up.

## Files reviewed

- `lib/stripe.ts`
- `lib/cart.ts`
- `lib/shop.ts`
- `lib/products.ts`
- `lib/finance-lock.ts`
- `lib/cashflow.ts`
- `lib/finance-feeds.ts`
- `lib/vat.ts`
- `lib/gift-vouchers.ts`
- `lib/gift-packages.ts`
- `lib/membership.ts`
- `lib/promo.ts`
- `lib/price-import.ts`
- `lib/truelayer.ts`
- `lib/xero.ts`
- `lib/day-close.ts`
- `lib/booking-actions.ts`
- `lib/auth.ts`
- `lib/security/guard.ts`
- `lib/security/rate-limit.ts`
- `middleware.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/shop/checkout/route.ts`
- `app/api/shop/confirm/route.ts`
- `app/api/booking/create/route.ts`
- `app/api/booking/confirm/route.ts`
- `app/api/booking/card-saved/route.ts`
- `app/api/booking/pay-confirm/route.ts`
- `app/api/booking/cancel/route.ts`
- `app/api/gift-vouchers/create/route.ts`
- `app/api/gift-vouchers/confirm/route.ts`
- `app/api/promo/validate/route.ts`
- `app/api/admin/orders/route.ts`
- `app/api/admin/gift-vouchers/route.ts`
- `app/api/admin/cashflow/route.ts`
- `app/api/admin/finance/controls/route.ts`
- `app/api/admin/finance/unlock/route.ts`
- `app/api/admin/day-close/route.ts`
- `app/api/admin/pos/route.ts`
- `app/api/admin/products/route.ts`
- `app/api/admin/integrations/xero/connect/route.ts`
- `app/admin/bookings/actions.ts`
- `components/gift/GiftVoucherFlow.tsx`

*Note on unverified items:* Finding [Medium] "amount-paid assertion" and [Low] "webhook replay" are defence-in-depth gaps with no confirmed live exploit on current code paths and are marked accordingly. `lib/oauth-connections.ts` and `lib/oauth-state.ts` (token-at-rest, state validation) were referenced but are outside this audit's assigned file scope and were not fully reviewed.
