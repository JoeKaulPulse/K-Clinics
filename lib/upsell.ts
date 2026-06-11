import 'server-only';
import { db } from './db';
import { personalisedOffers } from './personalised-offers';
import { recommendedNext, formatInterval } from './treatment-intervals';

// PRJ-63 — post-appointment upsell prompts for the reception desk. After a client's
// appointment finishes, reception sees a short list of recommended next sales WITH
// the reason each is recommended — a rebook at the right interval, plus any course /
// add-on offers derived from the client's own treatment history. Reuses the existing
// personalised-offers + treatment-interval engines so suggestions stay consistent
// with the rest of the app.

export type Upsell = { title: string; reason: string; href?: string; pricePence?: number };
export type ClientUpsell = { bookingId: string; clientId: string; clientName: string; treatment: string; suggestions: Upsell[] };

type FinishedBooking = {
  id: string;
  clientId: string;
  clientName: string;
  treatmentSlug: string;
  treatmentTitle: string;
  startAt: Date;
};

/** Build upsell suggestions for clients whose appointment just finished. */
export async function postAppointmentUpsells(finished: FinishedBooking[], maxClients = 4): Promise<ClientUpsell[]> {
  const out: ClientUpsell[] = [];
  for (const b of finished.slice(0, maxClients)) {
    const suggestions: Upsell[] = [];

    // Rebook at the recommended interval for this treatment family.
    const completed = await db.booking
      .count({ where: { clientId: b.clientId, treatmentSlug: b.treatmentSlug, status: 'COMPLETED' } })
      .catch(() => 0);
    const rec = recommendedNext(b.treatmentSlug, completed, b.startAt);
    if (rec) {
      suggestions.push({
        title: `Rebook ${b.treatmentTitle} in ${formatInterval(rec.weeks)}`,
        reason: rec.maintenance
          ? 'Due for a maintenance session to keep results looking their best.'
          : `Best results come from keeping to the recommended spacing (session ${completed + 1}).`,
        href: `/book?treatment=${b.treatmentSlug}`,
      });
    }

    // Course / add-on offers from the client's history (detail carries the reason).
    const offers = await personalisedOffers(b.clientId, 2).catch(() => []);
    for (const o of offers) suggestions.push({ title: o.title, reason: o.detail, href: o.href, pricePence: o.pricePence });

    if (suggestions.length) {
      out.push({ bookingId: b.id, clientId: b.clientId, clientName: b.clientName, treatment: b.treatmentTitle, suggestions: suggestions.slice(0, 3) });
    }
  }
  return out;
}
