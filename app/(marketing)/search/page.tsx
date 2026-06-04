import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { searchSite } from '@/lib/search';
import { pageMeta } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Search — KClinics',
  description: 'Search treatments, articles and pages across KClinics.',
  path: '/search',
  noindex: true, // thin, query-driven results — keep out of the index
});

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const results = await searchSite(q);

  return (
    <>
      <PageHero eyebrow="Search" title={q ? `Results for “${q}”` : 'Search'} lede={q ? `${results.total} result${results.total === 1 ? '' : 's'}` : 'Find treatments, articles and pages.'}>
        <form action="/search" method="get" className="mx-auto mt-6 flex max-w-xl gap-2">
          <input
            name="q" defaultValue={q} autoFocus placeholder="Search treatments, articles…" aria-label="Search"
            className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-[var(--color-porcelain)] placeholder:text-[var(--color-porcelain)]/50 outline-none focus:border-[var(--color-gold)]"
          />
          <button className="shrink-0 rounded-full bg-[var(--color-gold)] px-6 py-3 text-sm font-medium text-white">Search</button>
        </form>
      </PageHero>

      <section className="container-lux section">
        {q && results.hits.length === 0 ? (
          <p className="text-center text-[var(--color-stone)]">No results for “{q}”. Try a different term, or <Link href="/treatments" className="underline">browse treatments</Link>.</p>
        ) : (
          <ul className="mx-auto max-w-2xl divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            {results.hits.map((h) => (
              <li key={`${h.type}-${h.href}`}>
                <Reveal>
                  <Link href={h.href} className="flex items-center justify-between gap-4 bg-[var(--color-porcelain)] px-6 py-5 transition-colors hover:bg-[var(--color-bone)]">
                    <span className="min-w-0">
                      <span className="font-[family-name:var(--font-display)] text-lg leading-tight">{h.title}</span>
                      {h.excerpt && <span className="mt-0.5 block truncate text-sm text-[var(--color-stone)]">{h.excerpt}</span>}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--color-bone)] px-3 py-1 text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">{h.type}</span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
