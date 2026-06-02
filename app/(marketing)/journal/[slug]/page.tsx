import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
import { MaskReveal } from '@/components/motion/MaskReveal';
import { MediaArt } from '@/components/ui/MediaArt';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { articleImage, treatmentImage } from '@/lib/treatment-images';
import { getArticle, articleSlugs, sortedArticles } from '@/lib/articles';
import { getTreatment } from '@/lib/treatments';
import { pageMeta, JsonLd, articleLd, breadcrumbLd } from '@/lib/seo';

export const dynamicParams = false;
export function generateStaticParams() {
  return articleSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  return pageMeta({ title: `${a.title} | KClinics Journal`, description: a.metaDescription, path: `/journal/${a.slug}`, keywords: a.keywords, ownOgImage: true });
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();

  const img = articleImage(a.slug);
  const related = (a.related ?? []).map(getTreatment).filter(Boolean);
  const more = sortedArticles.filter((x) => x.slug !== a.slug).slice(0, 2);

  return (
    <>
      <JsonLd
        data={[
          articleLd({ title: a.title, description: a.metaDescription, path: `/journal/${a.slug}`, published: a.published, updated: a.updated, image: img ?? undefined, keywords: a.keywords }),
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
          <p className="mt-5 text-lede leading-relaxed text-[var(--color-stone)]">{a.excerpt}</p>
        </Reveal>
      </section>

      {/* Hero image */}
      <section className="container-lux mt-10">
        <MaskReveal className="aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-2xl)] shadow-[var(--shadow-lift)]">
          <MediaArt src={img} from="#a98a6d" to="#3d352f" alt={a.title} priority className="h-full w-full" />
        </MaskReveal>
      </section>

      {/* Body */}
      <section className="container-narrow section-sm">
        <article>
          {a.blocks.map((b, i) => {
            if (b.type === 'h2') return <h2 key={i} className="mt-10 font-[family-name:var(--font-display)] text-2xl md:text-3xl">{b.text}</h2>;
            if (b.type === 'ul') return (
              <ul key={i} className="mt-4 space-y-2.5">
                {b.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-3 leading-relaxed text-[var(--color-ink-soft)]">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-gold)]" />
                    {it}
                  </li>
                ))}
              </ul>
            );
            return <p key={i} className="mt-5 text-lg leading-relaxed text-[var(--color-ink-soft)]">{b.text}</p>;
          })}
        </article>

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
                    <MediaArt src={articleImage(m.slug)} from="#a98a6d" to="#7b6a5d" alt={m.title} className="h-full w-full" />
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
