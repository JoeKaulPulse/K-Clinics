import { crmEnabled } from '@/lib/crm';

// Promoted special offers, surfaced on the marketing site and in client portals.
// Fully defensive: renders nothing when the CRM/DB isn't available (e.g. the
// static export), so it never breaks a build.
export async function OffersStrip({ heading = 'Offers on now' }: { heading?: string }) {
  if (!crmEnabled) return null;
  let offers: { id: string; name: string; percentOff: number | null; amountOffPence: number | null; endAt: Date | null }[] = [];
  try {
    const { liveOffers } = await import('@/lib/services');
    offers = await liveOffers(true);
  } catch {
    return null;
  }
  if (!offers.length) return null;

  // Offer names may already include a discount phrase; strip it so the badge
  // isn't printed twice ("… — 10% off — 10% off").
  const cleanName = (name: string) => name.replace(/\s*[—–-]+\s*£?\d+%?\s*off\s*$/i, '').trim() || name;

  return (
    <section className="container-lux">
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/8 p-6 md:p-8">
        <p className="eyebrow mb-3 text-[var(--color-gold)]">{heading}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.slice(0, 6).map((o) => (
            <li key={o.id} className="flex items-baseline justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-porcelain)]/70 px-4 py-3">
              <span className="text-sm font-medium text-[var(--color-ink)]">{cleanName(o.name)}</span>
              <span className="shrink-0 text-sm font-semibold text-[var(--color-gold)]">
                {o.percentOff ? `${o.percentOff}% off` : o.amountOffPence ? `£${(o.amountOffPence / 100).toLocaleString('en-GB')} off` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--color-stone)]">Discounts apply automatically at booking. <a href="/book" className="link-underline font-medium text-[var(--color-ink)]">Book now →</a></p>
      </div>
    </section>
  );
}
