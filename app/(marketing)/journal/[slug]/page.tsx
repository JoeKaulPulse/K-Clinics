import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
import { MaskReveal } from '@/components/motion/MaskReveal';
import { MediaArt } from '@/components/ui/MediaArt';
import { ReadingProgress } from '@/components/journal/ReadingProgress';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { getBlogPost, moreBlogCards } from '@/lib/blog';
import { getTreatment } from '@/lib/treatments';
import { pageMeta, JsonLd, articleLd, breadcrumbLd } from '@/lib/seo';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getBlogPost(slug);
  if (!a) return {};
  return pageMeta({ title: `${a.title} | KClinics Journal`, description: a.metaDescription, path: `/journal/${a.slug}`, keywords: a.keywords, ownOgImage: true });
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getBlogPost(slug);
  // BLD-895: an unmatched slug must render as a genuine per-request 404, not an
  // ISR-cached page — Next's Full Route Cache doesn't persist the notFound()
  // status on a revalidate hit, which soft-404s (200) on repeat visits.
  // connection() opts just this branch out of the cache so it's always live.
  if (!a) { await connection(); notFound(); }

  const related = (a.related ?? []).map(getTreatment).filter(Boolean);
  const more = await moreBlogCards(a.slug, 2);

  return (
    <>
      <ReadingProgress />
      <JsonLd
        data={[
          articleLd({ title: a.title, description: a.metaDescription, path: `/journal/${a.slug}`, published: a.published, updated: a.updated, image: a.image ?? undefined, keywords: a.keywords }),
          breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Journal', path: '/journal' }, { name: a.title, path: `/journal/${a.slug}` }]),
        ]}
      />

      {/* Header */}
      <section className="container-narrow pt-[calc(var(--header-h,5.25rem)+2.5rem)]">
        <Reveal>
          <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--color-stone)]" aria-label="Breadcrumb">
            <Link href="/journal" className="hover:text-[var(--color-gold)]">Journal</Link>
            <span>/</span>
            <span>{a.category}</span>
          </nav>
          <p className="eyebrow mb-4">{a.category} · {a.readMinutes} min read · {fmtDate(a.published)}</p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.4rem+2.6vw,3.5rem)] leading-[1.05]">{a.title}</h1>
          {a.excerpt && <p className="mt-5 text-lede leading-relaxed text-[var(--color-stone)]">{a.excerpt}</p>}
          <div className="mt-7 flex items-center gap-3 border-t border-[var(--color-line)] pt-6">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-ink)] font-[family-name:var(--font-display)] text-sm text-[var(--color-gold-soft)]">K</span>
            <div className="text-sm">
              <p className="font-medium text-[var(--color-ink)]">The KClinics team</p>
              <p className="text-[var(--color-stone)]">Clinically reviewed{a.updated ? ` · Updated ${fmtDate(a.updated)}` : ''}</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Hero image */}
      <section className="container-lux mt-10">
        <MaskReveal className="aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-2xl)] shadow-[var(--shadow-lift)]">
          <MediaArt src={a.image} from="#a98a6d" to="#3d352f" alt={a.title} priority className="h-full w-full" />
        </MaskReveal>
      </section>

      {/* Body (HTML) */}
      <section className="container-narrow section-sm">
        <style dangerouslySetInnerHTML={{ __html: JOURNAL_PROSE_CSS }} />
        <article className="journal-prose" dangerouslySetInnerHTML={{ __html: a.html }} />

        {/* Related treatments CTA */}
        {related.length > 0 && (
          <div className="mt-12 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8">
            <p className="eyebrow mb-4">Treatments mentioned</p>
            <div className="flex flex-wrap gap-3">
              {related.map((t) => t && (
                <Link key={t.slug} href={`/${t.slug}`} className="rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
                  {t.title}
                </Link>
              ))}
            </div>
            <div className="mt-6"><BookingButtons /></div>
          </div>
        )}
      </section>

      {/* More reading */}
      {more.length > 0 && (
        <section className="bg-[var(--color-bone)] section">
          <div className="container-lux">
            <h2 className="text-title mb-8">More from the Journal</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {more.map((m) => (
                <Link key={m.slug} href={`/journal/${m.slug}`} className="group flex gap-5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
                  <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-[var(--radius-md)]">
                    <MediaArt src={m.image} from="#a98a6d" to="#7b6a5d" alt={m.title} className="h-full w-full" />
                  </div>
                  <div>
                    <p className="eyebrow mb-1 text-xs">{m.category}</p>
                    <h3 className="font-[family-name:var(--font-display)] text-lg leading-tight">{m.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

// Typographic styling for the HTML body (imported WordPress + admin-authored).
const JOURNAL_PROSE_CSS = `
.journal-prose{color:var(--color-ink-soft);font-size:1.075rem;line-height:1.75;}
.journal-prose > :first-child{margin-top:0;}
.journal-prose h2{font-family:var(--font-display),serif;font-size:clamp(1.5rem,1.2rem+1vw,2rem);line-height:1.15;margin:2.5rem 0 0.75rem;color:var(--color-ink);}
.journal-prose h3{font-family:var(--font-display),serif;font-size:1.3rem;margin:2rem 0 0.5rem;color:var(--color-ink);}
.journal-prose p{margin:1.1rem 0;}
.journal-prose ul,.journal-prose ol{margin:1.1rem 0;padding-left:1.4rem;}
.journal-prose li{margin:0.4rem 0;}
.journal-prose ul li{list-style:disc;}
.journal-prose ol li{list-style:decimal;}
.journal-prose a{color:var(--color-gold);text-decoration:underline;text-underline-offset:3px;}
.journal-prose strong{color:var(--color-ink);font-weight:600;}
.journal-prose img{max-width:100%;height:auto;border-radius:var(--radius-lg);margin:1.5rem 0;}
.journal-prose blockquote{border-left:3px solid var(--color-gold);padding-left:1rem;margin:1.5rem 0;color:var(--color-stone);font-style:italic;}
.journal-prose figure{margin:1.5rem 0;}
.journal-prose figcaption{margin-top:0.5rem;font-size:0.85rem;color:var(--color-stone);text-align:center;}
.journal-prose blockquote cite{display:block;margin-top:0.5rem;font-style:normal;font-size:0.85rem;color:var(--color-stone);}
.journal-prose hr{border:0;height:1px;background:linear-gradient(90deg,transparent,var(--color-line),transparent);margin:2.5rem 0;}
.journal-prose .journal-callout{display:block;background:var(--color-bone);border:1px solid var(--color-line);border-left:3px solid var(--color-gold);border-radius:var(--radius-md);padding:1.1rem 1.3rem;margin:1.6rem 0;color:var(--color-ink-soft);}
.journal-prose .journal-cta{margin:1.8rem 0;}
.journal-prose .journal-cta a{display:inline-block;background:var(--color-ink);color:var(--color-porcelain);border-radius:999px;padding:0.7rem 1.6rem;text-decoration:none;font-weight:500;transition:background .2s;}
.journal-prose .journal-cta a:hover{background:var(--color-gold);}
.journal-prose code{background:var(--color-bone);border-radius:4px;padding:0.1rem 0.35rem;font-size:0.9em;}
.journal-prose h2:first-child,.journal-prose h3:first-child{margin-top:0;}
`;
