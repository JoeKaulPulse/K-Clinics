import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';

// "Just for you" — offers based on the client's treatment history. Defensive:
// renders nothing without data or DB.
export async function PersonalisedOffers({ clientId }: { clientId: string }) {
  if (!crmEnabled) return null;
  let offers: { id: string; kind: string; title: string; detail: string; href: string }[] = [];
  try {
    const { personalisedOffers } = await import('@/lib/personalised-offers');
    offers = await personalisedOffers(clientId);
  } catch { return null; }
  if (offers.length === 0) return null;

  return (
    <section className="mt-8 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 shadow-[var(--shadow-soft)]">
      <p className="eyebrow mb-3 text-[var(--color-gold-deep)]">Just for you</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((o) => (
          <Link key={o.id} href={o.href} className="group flex h-full flex-col rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 transition-colors hover:border-[var(--color-gold)]">
            <span className="text-sm font-medium text-[var(--color-ink)]">{o.title}</span>
            <span className="mt-1 flex-1 text-xs text-[var(--color-stone)]">{o.detail}</span>
            <span className="mt-3 text-xs font-medium text-[var(--color-gold-deep)] group-hover:underline">Book now →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
