import Link from 'next/link';
import Image from 'next/image';
import type { Section } from '@/lib/sections';
import { blocksToHtml, slugifyHeading, type Block } from '@/lib/blocks';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { MaskReveal } from '@/components/motion/MaskReveal';
import { MediaArt } from '@/components/ui/MediaArt';
import { Marquee } from '@/components/ui/Marquee';
import { CountUp } from '@/components/motion/CountUp';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { EnquiryForm } from '@/components/contact/EnquiryForm';
import { PersonalizedRail } from '@/components/marketing/PersonalizedRail';
import { AbBlock } from '@/components/marketing/AbBlock';
import { getSiteConfig } from '@/lib/site-config';

// Renders an array of CMS sections as native, on-brand markup. Server component.
export function SectionRenderer({ sections, includeHidden = false }: { sections: Section[]; includeHidden?: boolean }) {
  const visible = sections.filter((s) => includeHidden || !s.hidden);
  // Collect rich-text headings (matching their anchor ids) for any TOC sections.
  const headings = visible
    .filter((s) => s.type === 'richText')
    .flatMap((s) => (Array.isArray((s.data as { blocks?: Block[] }).blocks) ? (s.data as { blocks: Block[] }).blocks : []))
    .filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading' && !!b.text?.trim())
    .map((b) => ({ text: b.text, slug: slugifyHeading(b.text), level: b.level }));
  return <>{visible.map((s) => (
    <SectionFrame key={s.id} data={s.data}>
      {s.type === 'tableOfContents' ? <TocSection data={s.data} headings={headings} /> : <SectionView section={s} />}
    </SectionFrame>
  ))}</>;
}

function TocSection({ data, headings }: { data: Record<string, unknown>; headings: { text: string; slug: string; level: number }[] }) {
  if (!headings.length) return null;
  return (
    <section className="container-narrow section-sm">
      <nav className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
        {str(data.heading) && <p className="eyebrow mb-3">{str(data.heading)}</p>}
        <ul className="space-y-1.5">
          {headings.map((h, i) => (
            <li key={i} className={h.level === 3 ? 'pl-4' : ''}>
              <a href={`#${h.slug}`} className="text-sm text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-gold)]">{h.text.replace(/[*_`]/g, '')}</a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

// Optional per-section background band + extra spacing (editor "Layout" controls).
function SectionFrame({ data, children }: { data: Record<string, unknown>; children: React.ReactNode }) {
  const bg = data._bg === 'cream' ? 'bg-[var(--color-bone)]' : data._bg === 'sand' ? 'bg-[var(--color-sand)]' : '';
  const pad = data._pad === 'sm' ? 'py-8' : data._pad === 'md' ? 'py-16' : data._pad === 'lg' ? 'py-28' : '';
  if (!bg && !pad) return <>{children}</>;
  return <div className={`${bg} ${pad}`.trim()}>{children}</div>;
}

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const paras = (s: string) => s.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
function embedUrl(u: string): string {
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = u.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return /^https?:\/\//.test(u) ? u : '';
}

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
    case 'abHeadline':
      return (
        <AbBlock
          slug={str(data.testSlug)}
          fallback={{ headline: str(data.headline) || undefined, subhead: str(data.subhead) || undefined, ctaLabel: str(data.ctaLabel) || undefined, ctaHref: str(data.ctaHref) || undefined }}
        />
      );

    case 'personalizedTreatments':
      return (
        <PersonalizedRail
          heading={str(data.heading) || undefined}
          subheading={str(data.subheading) || undefined}
          count={Number(str(data.count, '6')) || 6}
          showGiftCard={data.showGiftCard !== false && data.showGiftCard !== 'false'}
        />
      );

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
      const img = str(data.image);
      return (
        <section className="container-lux grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
          <MaskReveal className={`relative aspect-[4/5] overflow-hidden rounded-[var(--radius-2xl)] shadow-[var(--shadow-lift)] ${right ? 'md:order-2' : ''}`}>
            {img
              ? <Image src={img} alt={str(data.heading)} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" style={{ objectPosition: str(data.focal, '50% 50%') }} />
              : <MediaArt src="" from="#a98a6d" to="#7b6a5d" alt={str(data.heading)} className="h-full w-full" />}
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

    case 'twoColumn':
      return (
        <section className="container-lux section-sm">
          {str(data.heading) && <h2 className="text-title mb-8">{str(data.heading)}</h2>}
          <div className="grid gap-10 md:grid-cols-2">
            {[str(data.left), str(data.right)].map((col, i) => (
              <div key={i} className="space-y-4 text-lg leading-relaxed text-[var(--color-stone)]">{paras(col).map((p, j) => <p key={j}>{p}</p>)}</div>
            ))}
          </div>
        </section>
      );

    case 'steps':
      return (
        <section className="container-lux section">
          {(str(data.eyebrow) || str(data.heading)) && (
            <div className="mb-10 text-center">
              {str(data.eyebrow) && <p className="eyebrow mb-3">{str(data.eyebrow)}</p>}
              {str(data.heading) && <h2 className="text-title">{str(data.heading)}</h2>}
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-3">
            {arr<{ title: string; text: string }>(data.items).map((it, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div className="h-full rounded-[var(--radius-lg)] border border-[var(--color-line)] p-7">
                  <span className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-gold)]">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl">{it.title}</h3>
                  <p className="mt-2 text-[var(--color-stone)]">{it.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      );

    case 'pricingTable':
      return (
        <section className="container-narrow section">
          {str(data.heading) && <h2 className="text-title mb-8 text-center">{str(data.heading)}</h2>}
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            {arr<{ name: string; price: string; note: string }>(data.items).map((it, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] px-6 py-4 last:border-0">
                <span><span className="font-medium">{it.name}</span>{it.note && <span className="ml-2 text-sm text-[var(--color-stone)]">{it.note}</span>}</span>
                <span className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">{it.price}</span>
              </div>
            ))}
          </div>
        </section>
      );

    case 'logos':
      return (
        <section className="container-lux section-sm text-center">
          {str(data.heading) && <p className="eyebrow mb-8">{str(data.heading)}</p>}
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {arr<{ label: string; image: string }>(data.items).map((it, i) => (
              it.image
                ? <Image key={i} src={it.image} alt={it.label || ''} width={160} height={36} className="h-9 w-auto object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" />
                : <span key={i} className="font-[family-name:var(--font-display)] text-xl text-[var(--color-stone)]">{it.label}</span>
            ))}
          </div>
        </section>
      );

    case 'video': {
      const url = embedUrl(str(data.url));
      if (!url) return null;
      return (
        <section className="container-lux section-sm">
          <div className="aspect-video overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] shadow-[var(--shadow-soft)]">
            <iframe src={url} title={str(data.caption) || 'Video'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" />
          </div>
          {str(data.caption) && <p className="mt-3 text-center text-sm text-[var(--color-stone)]">{str(data.caption)}</p>}
        </section>
      );
    }

    case 'contactCards': {
      const cols = str(data.columns, '3');
      const grid = cols === '4' ? 'lg:grid-cols-4 sm:grid-cols-2' : cols === '2' ? 'sm:grid-cols-2' : 'lg:grid-cols-3 sm:grid-cols-2';
      return (
        <section className="container-lux section">
          {str(data.heading) && <h2 className="text-title mb-8 text-center">{str(data.heading)}</h2>}
          <div className={`grid gap-6 ${grid}`}>
            {arr<{ title: string; text: string; linkLabel: string; linkHref: string }>(data.items).map((it, i) => (
              <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
                <h3 className="font-[family-name:var(--font-display)] text-lg">{it.title}</h3>
                {it.text && <p className="mt-2 text-sm text-[var(--color-stone)]">{it.text}</p>}
                {it.linkLabel && it.linkHref && <Link href={it.linkHref} className="mt-3 inline-block text-sm font-medium text-[var(--color-gold)] hover:underline">{it.linkLabel} →</Link>}
              </div>
            ))}
          </div>
        </section>
      );
    }

    case 'tags':
      return (
        <section className="container-lux section-sm">
          {(str(data.eyebrow) || str(data.heading)) && (
            <div className="mb-6">
              {str(data.eyebrow) && <p className="eyebrow mb-3">{str(data.eyebrow)}</p>}
              {str(data.heading) && <h2 className="text-title">{str(data.heading)}</h2>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {arr<{ label: string }>(data.items).map((it, i) => (
              <span key={i} className="rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2 text-sm text-[var(--color-ink-soft)]">{it.label}</span>
            ))}
          </div>
        </section>
      );

    case 'contactInfo':
      return <ContactInfoSection data={data} />;
    case 'map':
      return <MapSection data={data} />;
    case 'enquiryForm':
      return (
        <section className="bg-[var(--color-bone)] section">
          <div className="container-lux grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                {str(data.eyebrow) && <p className="eyebrow mb-4">{str(data.eyebrow)}</p>}
                <h2 className="text-title">{str(data.heading, 'Get in touch')}</h2>
                {str(data.intro) && <p className="mt-5 text-[var(--color-stone)]">{str(data.intro)}</p>}
              </div>
            </Reveal>
            <Reveal delay={0.1}><EnquiryForm /></Reveal>
          </div>
        </section>
      );

    default:
      return null;
  }
}

// Pulls live contact details from Site settings so they stay in sync.
async function ContactInfoSection({ data }: { data: Record<string, unknown> }) {
  const c = await getSiteConfig();
  return (
    <section className="container-lux section-sm">
      <div className="space-y-8">
        {str(data.heading) && <h2 className="text-title">{str(data.heading)}</h2>}
        <div>
          <p className="eyebrow mb-3">Address</p>
          <p className="font-[family-name:var(--font-display)] text-2xl leading-snug">{c.address.street}<br />{c.address.locality}<br />{c.address.region} {c.address.postalCode}</p>
          <a href={c.mapLink} target="_blank" rel="noopener noreferrer" className="link-underline mt-3 inline-block text-sm font-medium text-[var(--color-gold)]">Get directions →</a>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div><p className="eyebrow mb-2">Call</p><a href={c.phoneHref} className="link-underline text-lg">{c.phone}</a></div>
          <div><p className="eyebrow mb-2">Email</p><a href={c.emailHref} className="link-underline text-lg">{c.email}</a></div>
        </div>
        {data.showHours !== false && (
          <div>
            <p className="eyebrow mb-3">Opening hours</p>
            <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
              {c.hours.map((h) => (
                <li key={h.day} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-[var(--color-ink-soft)]">{h.day}</span>
                  <span className={h.open === 'Closed' ? 'text-[var(--color-stone)]' : 'font-medium'}>{h.open === 'Closed' ? 'Closed' : `${h.open} – ${h.close}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.showBooking !== false && <div><p className="eyebrow mb-4">Book instantly</p><BookingButtons /></div>}
      </div>
    </section>
  );
}

async function MapSection({ data }: { data: Record<string, unknown> }) {
  const c = await getSiteConfig();
  const h = str(data.height, 'md') === 'lg' ? 'min-h-[34rem]' : str(data.height) === 'sm' ? 'min-h-[20rem]' : 'min-h-[28rem]';
  return (
    <section className="container-lux section-sm">
      <div className={`overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] shadow-[var(--shadow-soft)] ${h}`}>
        <iframe title="KClinics location map" src={c.mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className={`w-full grayscale-[0.2] ${h}`} />
      </div>
    </section>
  );
}

const PROSE_CSS = `
.journal-prose{color:var(--color-ink-soft);font-size:1.075rem;line-height:1.75;}
.journal-prose h2,.journal-prose h3{scroll-margin-top:calc(var(--header-h,5.25rem) + 1.5rem);}
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
