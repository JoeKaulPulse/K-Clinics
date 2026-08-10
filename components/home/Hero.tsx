import Link from 'next/link';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { Stars } from '@/components/ui/Stars';
import { KMark } from '@/components/brand/marks';
import { site } from '@/lib/site';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { HERO_SLIDES, type PromoHeroSlide } from '@/components/home/hero-slides';

type Rating = { average: number; count: number } | null | undefined;

/**
 * Above-the-fold hero (BLD-1197: now a rotating carousel of promotional
 * slides — see components/home/hero-slides.ts for the ordered slide list).
 *
 * Stays a *server* component: each slide's markup is rendered here (CSS-only
 * entrance motion, no client JS needed to paint it) and handed as pre-built
 * content to <HeroCarousel>, a small client component that owns only the
 * rotation timer, pause-on-hover/focus and the dot controls. Slide 1 — the
 * original static hero — therefore still paints on first response, before
 * any hydration.
 *
 * `rating` is the REAL aggregate (our reviews + Google) or null — the rating
 * strip only renders when genuine reviews exist.
 */
export function Hero({ rating }: { rating?: Rating }) {
  const slides = HERO_SLIDES.map((slide) =>
    slide.kind === 'brand' ? <BrandSlide key={slide.id} rating={rating} /> : <PromoSlide key={slide.id} slide={slide} />,
  );
  const labels = HERO_SLIDES.map((slide) => (slide.kind === 'brand' ? 'KClinics' : slide.title));

  return <HeroCarousel slides={slides} labels={labels} />;
}

/** Slide 1 — the original, unchanged hero content. */
function BrandSlide({ rating }: { rating?: Rating }) {
  return (
    <div className="flex h-full min-h-[100svh] items-center">
      {/* Depth — champagne glow + soft vignette */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(125%_95%_at_74%_36%,color-mix(in_oklab,var(--color-gold)_26%,transparent),transparent_56%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_125%,color-mix(in_oklab,#000_45%,transparent),transparent_52%)]"
      />

      {/* Signature animated K — self-draws on load, anchored right. */}
      <div
        aria-hidden
        className="hero-k pointer-events-none absolute right-[-6%] top-1/2 hidden h-[80%] -translate-y-1/2 text-[var(--color-gold-soft)] opacity-[0.55] md:block lg:right-[1%]"
      >
        <KMark animated className="h-full w-auto" />
      </div>

      {/* ── Copy ─────────────────────────────────────────────────── */}
      <div className="container-lux relative z-10 py-32">
        <div className="max-w-2xl">
          <p
            className="rise eyebrow mb-6 inline-flex items-center gap-2.5 text-[var(--color-gold-soft)]"
            style={{ animationDelay: '0.05s' }}
          >
            <span className="h-px w-8 bg-[var(--color-gold-soft)]/70" />
            Islington · London — Established {site.founded}
          </p>

          <h1 className="font-[family-name:var(--font-display)] text-[clamp(2.75rem,1.6rem+3.8vw,5.5rem)] leading-[1.02] tracking-[-0.02em]">
            <span className="reveal-mask">
              <span className="reveal-line" style={{ animationDelay: '0.12s' }}>Radiant skin,</span>
            </span>
            <span className="reveal-mask">
              <span className="reveal-line" style={{ animationDelay: '0.28s' }}>
                <span className="text-gold-shimmer">confident smiles.</span>
              </span>
            </span>
          </h1>

          <p
            className="rise mt-7 max-w-xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]"
            style={{ animationDelay: '0.4s' }}
          >
            A London clinic devoted to natural beauty — expert aesthetics and aesthetic dentistry,
            tailored to you and delivered with warmth, artistry and genuine care.
          </p>

          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '0.5s' }}>
            <Button href={site.booking.path} variant="gold" size="lg">
              Book your visit <ArrowIcon />
            </Button>
            <Button href="/treatments" variant="outline" size="lg">
              Explore treatments
            </Button>
          </div>

          <div
            className="rise mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.12] pt-7 text-sm"
            style={{ animationDelay: '0.6s' }}
          >
            {rating && rating.count > 0 && (
              <>
                <Link href="/reviews" className="flex items-center gap-2 text-[var(--color-gold-soft)]">
                  <Stars rating={rating.average} colorClass="text-[var(--color-gold-soft)]" />
                  <span className="font-medium">{rating.average.toFixed(1)}</span>
                  <span className="text-[color-mix(in_oklab,var(--color-porcelain)_60%,transparent)]">
                    · {rating.count} review{rating.count === 1 ? '' : 's'}
                  </span>
                </Link>
                <span className="hidden h-4 w-px bg-white/15 sm:block" />
              </>
            )}
            <Link href="/consultation" className="link-underline font-medium text-[var(--color-gold-soft)]">
              Free consultation · 15% off your first visit
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll cue — nudged up from the very bottom edge (BLD-1197) so it
          doesn't collide with the carousel's dot controls. */}
      <div className="rise pointer-events-none absolute bottom-20 left-1/2 hidden -translate-x-1/2 lg:block" style={{ animationDelay: '0.9s' }}>
        <span className="flex h-12 w-7 items-start justify-center rounded-full border border-white/25 p-1.5">
          <span className="hero-scroll-dot h-2 w-2 rounded-full bg-[var(--color-gold-soft)]" />
        </span>
      </div>
    </div>
  );
}

/** Slide 2 (BLD-1197) — Signature Facial promotion, and the template for
 *  future promo slides appended to HERO_SLIDES. */
function PromoSlide({ slide }: { slide: PromoHeroSlide }) {
  return (
    <div className="flex h-full min-h-[100svh] items-center">
      {/* Same dark/gold visual language as slide 1, glow anchored top-left this
          time so the two slides don't feel like a repeat of one another. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_22%_28%,color-mix(in_oklab,var(--color-gold)_28%,transparent),transparent_58%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_125%,color-mix(in_oklab,#000_45%,transparent),transparent_52%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-1/2 hidden h-[110%] -translate-y-1/2 text-[var(--color-gold-soft)] opacity-[0.35] md:block lg:right-[-2%]"
      >
        <KMark className="h-full w-auto" />
      </div>

      <div className="container-lux relative z-10 py-32">
        <div className="max-w-2xl">
          <p className="eyebrow mb-6 inline-flex items-center gap-2.5 text-[var(--color-gold-soft)]">
            <span className="h-px w-8 bg-[var(--color-gold-soft)]/70" />
            {slide.eyebrow}
          </p>

          <h2 className="font-[family-name:var(--font-display)] text-[clamp(2.5rem,1.5rem+3.2vw,4.75rem)] leading-[1.03] tracking-[-0.02em]">
            {slide.title}
          </h2>
          <p className="text-gold-shimmer mt-2 font-[family-name:var(--font-display)] text-[clamp(1.35rem,1.05rem+1vw,1.85rem)] leading-snug">
            {slide.tagline}
          </p>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">
            {slide.description}
          </p>

          {/* Price treatment */}
          <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
            <span className="text-gold-gradient font-[family-name:var(--font-display)] text-[clamp(2.75rem,2rem+2.4vw,4rem)] leading-none">
              {slide.price}
            </span>
            <span className="text-lg text-[color-mix(in_oklab,var(--color-porcelain)_55%,transparent)] line-through decoration-[color-mix(in_oklab,var(--color-porcelain)_45%,transparent)]">
              Was {slide.wasPrice}
            </span>
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[color-mix(in_oklab,var(--color-porcelain)_55%,transparent)]">
            {slide.priceNote}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button href={slide.ctaHref} variant="gold" size="lg">
              {slide.ctaLabel} <ArrowIcon />
            </Button>
            {slide.secondaryLabel && slide.secondaryHref && (
              <Button href={slide.secondaryHref} variant="outline" size="lg">
                {slide.secondaryLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
