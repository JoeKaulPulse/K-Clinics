import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublicItems } from '@/lib/build-board';
import { comingSoonContent, shippedContent, type RoadmapEntry } from '@/lib/roadmap-content';
import { pageMeta } from '@/lib/seo';

export const revalidate = 300; // ISR — public board snapshot, no per-request state

// PRJ-1032.36: route through pageMeta so the page carries a self-canonical URL
// and a per-page OG/Twitter card (the bare metadata export had neither), and
// use the canonical brand spelling (site.name === 'KClinics').
export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Roadmap — KClinics',
  description: 'See what\'s new and what\'s coming next from KClinics.',
  path: '/roadmap',
  keywords: ['KClinics roadmap', 'what\'s new', 'coming soon'],
});

const STATUS_ORDER = ['IN_PROGRESS', 'IN_REVIEW', 'TRIAGE', 'SHIPPED', 'CLOSED'];

const STATUS_LABEL: Record<string, { label: string; badge: string }> = {
  IN_PROGRESS: { label: 'In progress', badge: 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]' },
  IN_REVIEW:   { label: 'In review',   badge: 'bg-sky-100 text-sky-800' },
  TRIAGE:      { label: 'Coming soon', badge: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
  SHIPPED:     { label: 'Shipped',     badge: 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]' },
  CLOSED:      { label: 'Shipped',     badge: 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]' },
};

// A single normalised card the page renders, whether it came from the curated
// marketing set (lib/roadmap-content.ts) or a live admin-flagged board item.
type Card = {
  key: string;
  title: string;
  detail?: string;
  badge: { label: string; cls: string };
  meta?: string;
  href?: string;
  cta?: string;
};

const COMING_BADGE = { label: 'Coming soon', cls: 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]' };
const NEW_BADGE = { label: 'New', cls: 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]' };

const fromCurated = (e: RoadmapEntry): Card => ({
  key: `c-${e.key}`,
  title: e.title,
  detail: e.detail,
  badge: e.stage === 'coming-soon' ? COMING_BADGE : NEW_BADGE,
  href: e.href,
  cta: e.cta,
});

function RoadmapCard({ card }: { card: Card }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${card.badge.cls}`}>{card.badge.label}</span>
        {card.meta && <span className="text-xs text-[var(--color-stone)]">{card.meta}</span>}
      </div>
      <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg">{card.title}</h3>
      {card.detail && <p className="mt-1.5 text-sm text-[var(--color-stone)]">{card.detail}</p>}
      {card.href && (
        <a href={card.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-gold-deep)] underline-offset-2 hover:underline">
          {card.cta ?? 'Learn more'} <span aria-hidden>→</span>
        </a>
      )}
    </div>
  );
}

export default async function RoadmapPage() {
  let items: Awaited<ReturnType<typeof listPublicItems>> = [];
  try { items = await listPublicItems(); } catch { /* best-effort — curated content still renders */ }

  const liveShipped = items.filter((i) => ['SHIPPED', 'CLOSED'].includes(i.status));
  const liveUpcoming = items
    .filter((i) => !['SHIPPED', 'CLOSED'].includes(i.status))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  // Curated marketing set first, then any live admin-flagged board items.
  const comingSoon: Card[] = [
    ...comingSoonContent.map(fromCurated),
    ...liveUpcoming.map((item) => {
      const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.TRIAGE;
      return {
        key: item.id,
        title: item.title,
        detail: item.detail ?? undefined,
        badge: { label: st.label, cls: st.badge },
        meta: item.estCompleteAt
          ? `ETA ${new Date(item.estCompleteAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
          : undefined,
      } satisfies Card;
    }),
  ];

  const whatsNew: Card[] = [
    ...shippedContent.map(fromCurated),
    ...liveShipped.map((item) => ({
      key: item.id,
      title: item.title,
      detail: item.detail ?? undefined,
      badge: NEW_BADGE,
      meta: item.shippedAt
        ? new Date(item.shippedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : undefined,
    } satisfies Card)),
  ];

  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <div className="mb-12 text-center">
        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.18em] text-[var(--color-stone)]">KClinics</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl">What we&rsquo;re building</h1>
        <p className="mt-4 text-[var(--color-stone)]">
          The experience keeps getting better — for clients, for trainees, and for the team. Here&rsquo;s what&rsquo;s new and what&rsquo;s next.
        </p>
      </div>

      {comingSoon.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 text-[0.7rem] uppercase tracking-[0.16em] text-[var(--color-stone)]">Coming soon</h2>
          <div className="space-y-4">
            {comingSoon.map((card) => <RoadmapCard key={card.key} card={card} />)}
          </div>
        </section>
      )}

      {whatsNew.length > 0 && (
        <section>
          <h2 className="mb-5 text-[0.7rem] uppercase tracking-[0.16em] text-[var(--color-stone)]">What&rsquo;s new</h2>
          <div className="space-y-4">
            {whatsNew.map((card) => <RoadmapCard key={card.key} card={card} />)}
          </div>
        </section>
      )}

      <div className="mt-16 border-t border-[var(--color-line)] pt-8 text-center">
        <p className="text-sm text-[var(--color-stone)]">
          Have a suggestion? <Link href="/contact" className="text-[var(--color-gold-deep)] underline">Get in touch</Link>
        </p>
      </div>
    </main>
  );
}
