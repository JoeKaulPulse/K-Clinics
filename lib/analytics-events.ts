import { getConsent } from '@/components/legal/CookieConsent';

// Browser-side conversion events for GA4 (gtag) and Meta Pixel (fbq).
//
// These complement the server-side CAPI/Measurement-Protocol events in
// `lib/conversions.ts` (deduped by a shared eventId). Every call here is
// best-effort and MUST stay safe to fire from any success handler:
//
//   • no-op if `window.gtag` / `window.fbq` is undefined (scripts not loaded), and
//   • consent-gated EXACTLY like `components/marketing/TrackingScripts.tsx`:
//     GA4 needs **analytics** consent; Meta Pixel needs **marketing** consent.
//     Nothing fires before the visitor opts in via the cookie banner — a UK
//     GDPR/PECR requirement.
//
// Monetary values are in major units (pounds): callers pass pence, we convert.

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

function consent(): { analytics: boolean; marketing: boolean } {
  const c = getConsent();
  return { analytics: !!c?.analytics, marketing: !!c?.marketing };
}

/** GA4 event — fires only with analytics consent and a loaded gtag. */
function ga4(name: string, params: Record<string, unknown>) {
  if (!consent().analytics) return;
  try {
    (window as Window & { gtag?: Gtag }).gtag?.('event', name, params);
  } catch { /* analytics best-effort */ }
}

/** Meta Pixel event — fires only with marketing consent and a loaded fbq. */
function meta(name: string, params: Record<string, unknown>, eventId?: string) {
  if (!consent().marketing) return;
  try {
    (window as Window & { fbq?: Fbq }).fbq?.('track', name, params, eventId ? { eventID: eventId } : undefined);
  } catch { /* analytics best-effort */ }
}

/** Lead — an enquiry/consultation request (top of funnel; no monetary value).
 *  GA4 `generate_lead` + Meta `Lead`. Pass `eventId` to de-duplicate against the
 *  server-side CAPI Lead (sent from /api/consult). */
export function trackLead({ eventId, detail = {} }: { eventId?: string; detail?: Record<string, unknown> } = {}) {
  ga4('generate_lead', { currency: 'GBP', value: 0, ...detail });
  meta('Lead', detail, eventId);
}

/** View item — a treatment/package/product detail view (top of funnel). GA4
 *  `view_item` builds remarketing audiences; Meta `ViewContent` feeds ad
 *  optimisation. Same consent gating as everything else here (BLD-842). */
export function trackViewItem({ id, name, category, valuePence = 0 }: { id: string; name: string; category?: string; valuePence?: number }) {
  const value = Math.max(0, valuePence) / 100;
  ga4('view_item', { currency: 'GBP', value, items: [{ item_id: id, item_name: name, ...(category ? { item_category: category } : {}) }] });
  meta('ViewContent', { content_ids: [id], content_name: name, content_type: 'product', ...(category ? { content_category: category } : {}), currency: 'GBP', value });
}

/** Add to cart — a shop item added to the bag (top-of-funnel retargeting).
 *  GA4 `add_to_cart` + Meta `AddToCart`, same params shape as `trackViewItem`
 *  (product id, name, price, currency) plus quantity; fired from
 *  components/shop/AddToCart.tsx alongside the existing view_item/ViewContent
 *  and begin_checkout/InitiateCheckout events so the funnel joins up in
 *  GA4/Meta (BLD-1631). */
export function trackAddToCart({ id, name, category, valuePence = 0, quantity = 1 }: { id: string; name: string; category?: string; valuePence?: number; quantity?: number }) {
  const qty = Math.max(1, quantity);
  const value = (Math.max(0, valuePence) / 100) * qty;
  ga4('add_to_cart', { currency: 'GBP', value, items: [{ item_id: id, item_name: name, quantity: qty, ...(category ? { item_category: category } : {}) }] });
  meta('AddToCart', { content_ids: [id], content_name: name, content_type: 'product', ...(category ? { content_category: category } : {}), currency: 'GBP', value });
}

/** Purchase — a completed booking, or a true point-of-sale purchase (shop/gift
 *  voucher/academy — `metaPurchase: true`), on the Meta side. GA4's `purchase`
 *  has no such pre-charge/point-of-sale split: it is sent once, server-side,
 *  from `lib/conversions.ts`'s `sendPurchase`/`ga4Purchase` at actual
 *  card-charge time. So `ga4Purchase: false` (PRJ-1191.5 — see BookingFlow.tsx's
 *  pre-charge booking-request callers) skips the GA4 side here entirely rather
 *  than double-firing it with no `transaction_id` to dedupe against the
 *  server-side copy. Meta still gets `Schedule` (not `Purchase`) pre-charge —
 *  it dedupes correctly via `eventId` against the server-side CAPI copy, so
 *  that side is unaffected. `valuePence` is in pence, converted to pounds for
 *  both platforms. */
export function trackPurchase({
  valuePence,
  currency = 'GBP',
  eventId,
  detail = {},
  metaPurchase = false,
  ga4Purchase = true,
}: { valuePence: number; currency?: string; eventId?: string; detail?: Record<string, unknown>; metaPurchase?: boolean; ga4Purchase?: boolean }) {
  const value = Math.max(0, valuePence) / 100;
  if (ga4Purchase) ga4('purchase', { currency, value, ...detail });
  meta(metaPurchase ? 'Purchase' : 'Schedule', { currency, value }, eventId);
}
