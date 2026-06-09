import type { Metadata } from 'next';
import { listPublicItems } from '@/lib/build-board';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Roadmap — K Clinics',
  description: 'See what\'s new and what\'s coming next from K Clinics.',
  robots: { index: true, follow: true },
};

const STATUS_ORDER = ['IN_PROGRESS', 'IN_REVIEW', 'TRIAGE', 'SHIPPED', 'CLOSED'];

const STATUS_LABEL: Record<string, { label: string; badge: string; dot: string }> = {
  IN_PROGRESS: { label: 'In progress', badge: 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]', dot: 'bg-[var(--color-gold)]' },
  IN_REVIEW:   { label: 'In review',   badge: 'bg-sky-100 text-sky-800', dot: 'bg-sky-400' },
  TRIAGE:      { label: 'Coming soon', badge: 'bg-[var(--color-bone)] text-[var(--color-stone)]', dot: 'bg-[var(--color-stone-soft)]' },
  SHIPPED:     { label: 'Shipped',     badge: 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]', dot: 'bg-[var(--color-jade)]' },
  CLOSED:      { label: 'Shipped',     badge: 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]', dot: 'bg-[var(--color-jade)]' },
};

export default async function RoadmapPage() {
  let items: Awaited<ReturnType<typeof listPublicItems>> = [];
  try { items = await listPublicItems(); } catch { /* best-effort */ }

  const shipped = items.filter((i) => ['SHIPPED', 'CLOSED'].includes(i.status));
  const upcoming = items.filter((i) => !['SHIPPED', 'CLOSED'].includes(i.status))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <div className="mb-12 text-center">
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.18em] text-[var(--color-stone)]">K Clinics</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl">What we're building</h1>
        <p className="mt-4 text-[var(--color-stone)]">Improvements shipping to the K Clinics platform — for clients, clinicians, and the team.</p>
      </div>

      {upcoming.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 text-[0.7rem] uppercase tracking-[0.16em] text-[var(--color-stone)]">Coming soon</h2>
          <div className="space-y-4">
            {upcoming.map((item) => {
              const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.TRIAGE;
              return (
                <div key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${st.badge}`}>{st.label}</span>
                    {item.estCompleteAt && (
                      <span className="text-xs text-[var(--color-stone-soft)]">
                        ETA {new Date(item.estCompleteAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg">{item.title}</h3>
                  {item.detail && (
                    <p className="mt-1.5 text-sm text-[var(--color-stone)] line-clamp-2">{item.detail}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {shipped.length > 0 && (
        <section>
          <h2 className="mb-5 text-[0.7rem] uppercase tracking-[0.16em] text-[var(--color-stone)]">What's new</h2>
          <div className="relative space-y-6 border-l border-[var(--color-line)] pl-6">
            {shipped.map((item) => (
              <div key={item.id} className="relative">
                <span className="absolute -left-[1.6rem] top-2 h-2.5 w-2.5 rounded-full bg-[var(--color-jade)]" />
                <p className="text-xs text-[var(--color-stone-soft)]">
                  {item.shippedAt
                    ? new Date(item.shippedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Shipped'}
                </p>
                <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg">{item.title}</h3>
                {item.detail && (
                  <p className="mt-1 text-sm text-[var(--color-stone)] line-clamp-3">{item.detail}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <div className="py-16 text-center text-[var(--color-stone)]">
          <p className="text-lg">Nothing public yet — check back soon.</p>
        </div>
      )}

      <div className="mt-16 border-t border-[var(--color-line)] pt-8 text-center">
        <p className="text-sm text-[var(--color-stone)]">
          Have a suggestion? <a href="/contact" className="text-[var(--color-gold)] underline">Get in touch</a>
        </p>
      </div>
    </main>
  );
}
