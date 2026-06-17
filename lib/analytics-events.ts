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

/** Purchase — a completed booking. GA4 `purchase`; on the Meta side a booking is
 *  pre-charge, so we fire `Schedule` (not `Purchase`): the actual Meta `Purchase`
 *  is sent server-side from `lib/conversions.ts` when the card is charged, deduped
 *  by booking id. Set `metaPurchase: true` for a true point-of-sale Purchase.
 *  `valuePence` is in pence and converted to pounds for both platforms; pass
 *  `eventId` (booking id) to de-duplicate against the server-side CAPI copy. */
export function trackPurchase({
  valuePence,
  currency = 'GBP',
  eventId,
  detail = {},
  metaPurchase = false,
}: { valuePence: number; currency?: string; eventId?: string; detail?: Record<string, unknown>; metaPurchase?: boolean }) {
  const value = Math.max(0, valuePence) / 100;
  ga4('purchase', { currency, value, ...detail });
  meta(metaPurchase ? 'Purchase' : 'Schedule', { currency, value }, eventId);
}
