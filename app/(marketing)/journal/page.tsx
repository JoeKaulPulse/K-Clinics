import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { MediaArt } from '@/components/ui/MediaArt';
import { sortedArticles } from '@/lib/articles';
import { articleImage } from '@/lib/treatment-images';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'The Journal — Expert Skin, Laser & Dentistry Guides | K Clinics London',
  description:
    'Expert guidance from K Clinics, Islington — honest, practical articles on laser, skin, injectables and aesthetic dentistry to help you make confident, informed choices.',
  path: '/journal',
  keywords: ['aesthetics blog London', 'skincare advice', 'laser hair removal guide', 'aesthetic dentistry tips'],
});

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function JournalPage() {
  const [lead, ...rest] = sortedArticles;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Journal', path: '/journal' }])} />
      <PageHero
        eyebrow="The Journal"
        title="Considered guidance, beautifully clear."
        lede="Honest, expert advice on skin, laser, injectables and aesthetic dentistry — to help you make confident, informed decisions about your care."
        gradient={['#7b6a5d', '#2a2420']}
      />

      <section className="container-lux section">
        {/* Lead article */}
        {lead && (
          <Reveal>
            <Link href={`/journal/${lead.slug}`} className="group grid overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] md:grid-cols-[1.1fr_1fr]">
              <div className="relative min-h-[16rem] overflow-hidden">
                <MediaArt src={articleImage(lead.slug)} from="#a98a6d" to="#3d352f" alt={lead.title} className="h-full w-full transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-[1.05]" />
              </div>
              <div className="flex flex-col justify-center p-8 md:p-12">
                <p className="eyebrow mb-3">{lead.category} · {lead.readMinutes} min read</p>
                <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-[2.5rem] md:leading-[1.05]">{lead.title}</h2>
                <p className="mt-4 max-w-xl leading-relaxed text-[var(--color-stone)]">{lead.excerpt}</p>
                <span className="mt-6 text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">{fmtDate(lead.published)}</span>
              </div>
            </Link>
          </Reveal>
        )}

        {/* Grid */}
        <Stagger className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((a) => (
            <StaggerItem key={a.slug}>
              <Link href={`/journal/${a.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]">
                <div className="relative aspect-[3/2] overflow-hidden">
                  <MediaArt src={articleImage(a.slug)} from="#a98a6d" to="#7b6a5d" alt={a.title} className="h-full w-full transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-[1.06]" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="eyebrow mb-2 text-xs">{a.category} · {a.readMinutes} min</p>
                  <h3 className="font-[family-name:var(--font-display)] text-xl leading-tight">{a.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-stone)]">{a.excerpt}</p>
                  <span className="mt-auto pt-4 text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">{fmtDate(a.published)}</span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </>
  );
}
