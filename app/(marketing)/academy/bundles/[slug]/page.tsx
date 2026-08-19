import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';
import { formatFee } from '@/lib/academy';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { getBundle } = await import('@/lib/academy');
  const b = await getBundle(slug).catch(() => null);
  if (!b) return pageMeta({ title: 'Learning pathway — K Academy', description: 'A guided sequence of accredited aesthetics courses at K Academy.', path: `/academy/bundles/${slug}` });
  return pageMeta({
    title: `${b.title} — K Academy pathway`,
    description: b.summary || `A guided pathway of ${b.courses.length} accredited courses at K Academy, Islington.`,
    path: `/academy/bundles/${slug}`,
  });
}

// BLD-532: public bundle / pathway page — a curated route through several courses.
export default async function BundlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { getBundle } = await import('@/lib/academy');
  const bundle = await getBundle(slug);
  if (!bundle || bundle.courses.length === 0) notFound();

  const individualTotal = bundle.courses.reduce((sum, c) => sum + (c.pricePence || 0), 0);
  // BLD-1376: a live time-boxed promo overrides the standard bundle price for
  // display; savings compare the EFFECTIVE price against booking separately.
  const { getActivePromo } = await import('@/lib/academy-utils');
  const promo = getActivePromo(bundle);
  const effectivePence = promo ?? bundle.pricePence;
  const saving = effectivePence != null && individualTotal > effectivePence ? individualTotal - effectivePence : null;

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Academy', path: '/academy' }, { name: bundle.title, path: `/academy/bundles/${slug}` }])} />
      <PageHero
        eyebrow="K Academy · Learning pathway"
        title={bundle.title}
        lede={bundle.summary || 'A guided sequence of accredited courses — train in the right order, from foundation through to advanced.'}
        gradient={['#2a2420', '#7b6a5d']}
      />

      <section className="container-lux section grid gap-12 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
        <Reveal>
          <div className="space-y-8">
            {bundle.description && <div className="prose-lux whitespace-pre-line text-[var(--color-ink-soft)]">{bundle.description}</div>}

            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">What’s included</h2>
              <p className="mt-1 text-sm text-[var(--color-stone)]">{bundle.courses.length} course{bundle.courses.length === 1 ? '' : 's'}, in order.</p>
              <ol className="mt-4 space-y-3">
                {bundle.courses.map((c, i) => (
                  <li key={c.slug}>
                    <Link href={`/academy/${c.slug}`} className="group flex items-start gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5 transition-colors hover:border-[var(--color-gold)]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] font-[family-name:var(--font-display)] text-sm text-[var(--color-gold-soft)]">{i + 1}</span>
                      <span className="flex-1">
                        {c.level && <span className="block text-xs uppercase tracking-[0.16em] text-[var(--color-gold-deep)]">{c.level}</span>}
                        <span className="block font-[family-name:var(--font-display)] text-lg leading-tight text-[var(--color-ink)]">{c.title}</span>
                        {c.summary && <span className="mt-1 block text-sm text-[var(--color-ink-soft)]">{c.summary}</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-medium text-[var(--color-ink)]">{formatFee(c.pricePence)}</span>
                        <span className="text-xs text-[var(--color-gold-deep)] group-hover:underline">View →</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="space-y-6 lg:sticky lg:top-28">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Pathway</p>
              {effectivePence != null ? (
                <>
                  <div className="mt-1 flex flex-wrap items-baseline gap-3">
                    <span className={`font-[family-name:var(--font-display)] text-3xl ${promo != null ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-ink)]'}`}>{formatFee(effectivePence)}</span>
                    {/* Promo: strike the standard bundle price; otherwise strike the per-course total. */}
                    {promo != null && bundle.pricePence != null && bundle.pricePence > promo ? (
                      <span className="text-lg text-[var(--color-stone)] line-through">{formatFee(bundle.pricePence)}</span>
                    ) : saving != null ? (
                      <span className="text-lg text-[var(--color-stone)] line-through">{formatFee(individualTotal)}</span>
                    ) : null}
                    {promo != null && <span className="rounded-full bg-[var(--color-gold)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--color-gold-deep)]">Special offer</span>}
                  </div>
                  {saving != null && <p className="mt-2 text-sm font-medium text-[var(--color-gold-deep)]">Save {formatFee(saving)} versus booking separately.</p>}
                </>
              ) : (
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">On enquiry</p>
              )}
              {/* BLD-1393: be explicit about HOW the bundle price is honoured —
                  applications are per-course, and without this (plus the
                  ?bundle= tag below) a visitor shown "Save £X" would apply to
                  course 1 with nothing connecting their enrolment to the
                  bundle price. */}
              <p className="mt-2 text-sm text-[var(--color-stone)]">
                Apply to the first course to get started — your application is tagged with this pathway, and our team applies the {bundle.pricePence != null ? 'bundle price' : 'pathway pricing'} when they confirm your place.
              </p>
              <div className="mt-4"><Button href={`/academy/${bundle.courses[0].slug}?bundle=${encodeURIComponent(bundle.slug)}#apply`} variant="gold">Start with course 1 <ArrowIcon /></Button></div>
            </div>
            <p className="text-center text-sm text-[var(--color-stone)]">Questions about this pathway? <Link href="/academy/portal" className="link-underline font-medium text-[var(--color-ink)]">Talk to our team</Link></p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
