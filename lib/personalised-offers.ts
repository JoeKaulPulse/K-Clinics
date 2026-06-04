import 'server-only';
import { db } from '@/lib/db';
import { listServices } from '@/lib/services';

// Personalised offers derived from a client's treatment history. Examples:
//  • "You've completed 4 Laser Hair Removal sessions — add Underarms for £14."
//  • "You've had BodySphere 6 times — save with a course of 6."

export type PersonalOffer = { id: string; kind: 'course' | 'addon'; title: string; detail: string; href: string; pricePence?: number };

const UPSELL_PCT = 20;
const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export async function personalisedOffers(clientId: string, max = 3): Promise<PersonalOffer[]> {
  const bookings = await db.booking.findMany({
    where: { clientId, status: { in: ['COMPLETED'] } },
    select: { treatmentSlug: true, items: { select: { variantId: true } } },
  });
  if (bookings.length === 0) return [];

  // Tally completed bookings per treatment and per variant.
  const perTreatment = new Map<string, number>();
  const perVariant = new Map<string, number>();
  const doneVariants = new Set<string>();
  for (const b of bookings) {
    perTreatment.set(b.treatmentSlug, (perTreatment.get(b.treatmentSlug) ?? 0) + 1);
    for (const it of b.items) if (it.variantId) { perVariant.set(it.variantId, (perVariant.get(it.variantId) ?? 0) + 1); doneVariants.add(it.variantId); }
  }

  const services = await listServices(false);
  const out: PersonalOffer[] = [];

  // Highest-engagement treatments first.
  const ranked = [...perTreatment.entries()].sort((a, b) => b[1] - a[1]);
  for (const [slug, count] of ranked) {
    if (out.length >= max || count < 2) break;
    const service = services.find((s) => s.treatmentSlug === slug);
    if (!service || service.variants.length === 0) continue;
    const href = `/book?treatment=${slug}`;

    // (a) Course upsell — a variant they've repeatedly had as singles that offers a course.
    const repeatVariant = service.variants.find((v) => (perVariant.get(v.id) ?? 0) >= 3 && v.courses.length > 0);
    if (repeatVariant) {
      const best = repeatVariant.courses[repeatVariant.courses.length - 1];
      const perSession = Math.round(best.totalPence / best.sessions);
      out.push({
        id: `course-${repeatVariant.id}`,
        kind: 'course',
        title: `Save with a course of ${best.sessions}`,
        detail: `You’ve had ${service.name} — ${repeatVariant.name} ${perVariant.get(repeatVariant.id)} times. Book a course of ${best.sessions} for ${money(best.totalPence)} (just ${money(perSession)} a session).`,
        href, pricePence: best.totalPence,
      });
      continue;
    }

    // (b) Add-on — cheapest variant of a service they use that they haven't booked yet.
    const candidate = service.variants
      .filter((v) => !doneVariants.has(v.id) && v.pricePence > 0)
      .sort((a, b) => a.pricePence - b.pricePence)[0];
    if (candidate) {
      const disc = Math.round((candidate.pricePence * (100 - UPSELL_PCT)) / 100);
      out.push({
        id: `addon-${candidate.id}`,
        kind: 'addon',
        title: `Add ${candidate.name} for ${money(disc)}`,
        detail: `You’ve completed ${count} ${service.name} session${count === 1 ? '' : 's'}. Add ${candidate.name} to your next appointment and save ${UPSELL_PCT}%.`,
        href, pricePence: disc,
      });
    }
  }

  return out.slice(0, max);
}
