import Link from 'next/link';
import type { Section } from '@/lib/sections';
import { blocksToHtml, type Block } from '@/lib/blocks';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { MaskReveal } from '@/components/motion/MaskReveal';
import { MediaArt } from '@/components/ui/MediaArt';
import { Marquee } from '@/components/ui/Marquee';
import { CountUp } from '@/components/motion/CountUp';
import { BookingButtons } from '@/components/booking/BookingButtons';

// Renders an array of CMS sections as native, on-brand markup. Server component.
export function SectionRenderer({ sections }: { sections: Section[] }) {
  return <>{sections.map((s) => <SectionView key={s.id} section={s} />)}</>;
}

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const paras = (s: string) => s.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

function CmsButton({ label, href, variant = 'ink' }: { label: string; href: string; variant?: 'ink' | 'gold' | 'outline' }) {
  if (!label || !href) return null;
  const cls = variant === 'gold'
    ? 'bg-[var(--color-gold)] text-[var(--color-ink)]'
    : variant === 'outline'
    ? 'border border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-gold)]'
    : 'bg-[var(--color-ink)] text-[var(--color-porcelain)]';
  return <Link href={href} className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors ${cls}`}>{label}</Link>;
}

function SectionView({ section: { type, data } }: { section: Section }) {
  switch (type) {
    case 'hero':
      return (
        <PageHero eyebrow={str(data.eyebrow, ' ')} title={str(data.title, '')} lede={str(data.lede) || undefined} gradient={['#7b6a5d', '#2a2420']}>
          {(data.ctaPrimaryLabel || data.ctaSecondaryLabel) ? (
            <div className="flex flex-wrap gap-3">
              {str(data.ctaPrimaryLabel) && <CmsButton label={str(data.ctaPrimaryLabel)} href={str(data.ctaPrimaryHref)} variant="gold" />}
              {str(data.ctaSecondaryLabel) && <Link href={str(data.ctaSecondaryHref)} className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-[var(--color-porcelain)] hover:border-[var(--color-gold)]">{str(data.ctaSecondaryLabel)}</Link>}
            </div>
          ) : null}
        </PageHero>
      );

    case 'richText': {
      const html = blocksToHtml(arr<Block>(data.blocks));
      const width = str(data.width, 'narrow') === 'wide' ? 'container-lux' : 'container-narrow';
      return (
        <section className={`${width} section-sm`}>
          <style dangerouslySetInnerHTML={{ __html: PROSE_CSS }} />
          <Reveal><article className="journal-prose" dangerouslySetInnerHTML={{ __html: html }} /></Reveal>
        </section>
      );
    }

    case 'imageText': {
      const right = str(data.side, 'left') === 'right';
      return (
        <section className="container-lux grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <MaskReveal className={`aspect-[4/5] rounded-[var(--radius-2xl)] shadow-[var(--shadow-lift)] ${right ? 'md:order-2' : ''}`}>
            <MediaArt src={str(data.image)} from="#a98a6d" to="#7b6a5d" alt={str(data.heading)} className="h-full w-full" />
          </MaskReveal>
          <Reveal delay={0.1}>
            {str(data.eyebrow) && <p className="eyebrow mb-4">{str(data.eyebrow)}</p>}
            <h2 className="text-title">{str(data.heading)}</h2>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-[var(--color-stone)]">
              {paras(str(data.body)).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="mt-6"><CmsButton label={str(data.ctaLabel)} href={str(data.ctaHref)} /></div>
          </Reveal>
        </section>
      );
    }

    case 'featureGrid': {
      const cols = str(data.columns, '2');
      const grid = cols === '4' ? 'lg:grid-cols-4 sm:grid-cols-2' : cols === '3' ? 'lg:grid-cols-3 sm:grid-cols-2' : 'sm:grid-cols-2';
      return (
        <section className="container-lux section">
          {(str(data.eyebrow) || str(data.heading) || str(data.intro)) && (
            <div className="mx-auto mb-12 max-w-2xl text-center">
              {str(data.eyebrow) && <p className="eyebrow mb-3">{str(data.eyebrow)}</p>}
              {str(data.heading) && <h2 className="text-title">{str(data.heading)}</h2>}
              {str(data.intro) && <p className="mt-4 text-lg leading-relaxed text-[var(--color-stone)]">{str(data.intro)}</p>}
            </div>
          )}
          <div className={`grid gap-6 ${grid}`}>
            {arr<{ title: string; text: string }>(data.items).map((it, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div className="h-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-7">
                  <h3 className="font-[family-name:var(--font-display)] text-xl">{it.title}</h3>
                  <p className="mt-3 text-[var(--color-stone)]">{it.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      );
    }

    case 'stats':
      return (
        <section className="surface-ink">
          <div className="container-lux grid gap-8 py-16 text-center text-[var(--color-porcelain)] sm:grid-cols-2 md:grid-cols-4">
            {arr<{ value: string; label: string }>(data.items).map((it, i) => (
              <div key={i}>
                <p className="font-[family-name:var(--font-display)] text-4xl text-[var(--color-gold-soft)]"><CountUp value={it.value} /></p>
                <p className="mt-2 text-sm uppercase tracking-[0.14em] text-[color-mix(in_oklab,var(--color-porcelain)_70%,transparent)]">{it.label}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case 'cta': {
      const dark = str(data.tone, 'ink') === 'ink';
      return (
        <section className={dark ? 'surface-ink' : 'bg-[var(--color-bone)]'}>
          <div className="container-lux py-20 text-center md:py-24">
            {str(data.eyebrow) && <p className="eyebrow mb-4">{str(data.eyebrow)}</p>}
            <h2 className={`text-display mx-auto max-w-3xl text-balance ${dark ? 'text-[var(--color-porcelain)]' : ''}`}>{str(data.heading)}</h2>
            {str(data.text) && <p className={`mx-auto mt-5 max-w-xl ${dark ? 'text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]' : 'text-[var(--color-stone)]'}`}>{str(data.text)}</p>}
            <div className="mt-8 flex justify-center">
              {str(data.ctaHref) === '/book' ? <BookingButtons align="center" /> : <CmsButton label={str(data.ctaLabel)} href={str(data.ctaHref)} variant={dark ? 'gold' : 'ink'} />}
            </div>
          </div>
        </section>
      );
    }

    case 'faq':
      return (
        <section className="container-narrow section">
          {str(data.heading) && <h2 className="text-title mb-8 text-center">{str(data.heading)}</h2>}
          <div className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            {arr<{ q: string; a: string }>(data.items).map((it, i) => (
              <details key={i} className="group px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between py-5 font-[family-name:var(--font-display)] text-lg">
                  {it.q}
                  <span className="ml-4 text-[var(--color-gold)] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-5 text-[var(--color-stone)]">{it.a}</p>
              </details>
            ))}
          </div>
        </section>
      );

    case 'gallery': {
      const cols = str(data.columns, '3');
      const grid = cols === '4' ? 'grid-cols-2 md:grid-cols-4' : cols === '2' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 md:grid-cols-3';
      return (
        <section className="container-lux section">
          {str(data.heading) && <h2 className="text-title mb-8 text-center">{str(data.heading)}</h2>}
          <div className={`grid gap-4 ${grid}`}>
            {arr<{ url: string; caption: string }>(data.items).map((it, i) => (
              <figure key={i} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
                <div className="aspect-square"><MediaArt src={it.url} from="#a98a6d" to="#7b6a5d" alt={it.caption || ''} className="h-full w-full" /></div>
                {it.caption && <figcaption className="px-3 py-2 text-sm text-[var(--color-stone)]">{it.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      );
    }

    case 'quote':
      return (
        <section className="container-narrow section text-center">
          <Reveal>
            <p className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,1.2rem+1.6vw,2.4rem)] leading-snug text-[var(--color-ink)]">“{str(data.quote)}”</p>
            {(str(data.author) || str(data.role)) && <p className="mt-6 text-sm uppercase tracking-[0.14em] text-[var(--color-stone)]">{str(data.author)}{data.role ? ` · ${str(data.role)}` : ''}</p>}
          </Reveal>
        </section>
      );

    case 'marquee': {
      const items = arr<{ value?: string } | string>(data.items).map((x) => (typeof x === 'string' ? x : str(x?.value))).filter(Boolean);
      return <div className="border-y border-[var(--color-line)] py-6"><Marquee items={items} /></div>;
    }

    default:
      return null;
  }
}

const PROSE_CSS = `
.journal-prose{color:var(--color-ink-soft);font-size:1.075rem;line-height:1.75;}
.journal-prose h2{font-family:var(--font-display),serif;font-size:clamp(1.5rem,1.2rem+1vw,2rem);margin:2.2rem 0 0.75rem;color:var(--color-ink);}
.journal-prose h3{font-family:var(--font-display),serif;font-size:1.3rem;margin:1.8rem 0 0.5rem;color:var(--color-ink);}
.journal-prose p{margin:1.1rem 0;}
.journal-prose ul,.journal-prose ol{margin:1.1rem 0;padding-left:1.4rem;}
.journal-prose ul li{list-style:disc;margin:0.4rem 0;}
.journal-prose ol li{list-style:decimal;margin:0.4rem 0;}
.journal-prose a{color:var(--color-gold);text-decoration:underline;text-underline-offset:3px;}
.journal-prose strong{color:var(--color-ink);font-weight:600;}
.journal-prose img{max-width:100%;height:auto;border-radius:var(--radius-lg);margin:1.5rem 0;}
.journal-prose blockquote{border-left:3px solid var(--color-gold);padding-left:1rem;margin:1.5rem 0;color:var(--color-stone);font-style:italic;}
.journal-prose > :first-child{margin-top:0;}
`;
