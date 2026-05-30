import Link from 'next/link';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { KMark } from '@/components/brand/marks';
import { site } from '@/lib/site';

/**
 * Above-the-fold hero — the signature dark composition: refined copy on the left,
 * the self-drawing K monogram anchored to the right. A *server* component with
 * CSS-only entrance motion, so the fold paints fast (good for Core Web Vitals).
 */
export function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[var(--color-ink)] text-[var(--color-porcelain)]">
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
            Islington · London — Est. {site.founded}
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
            <span className="flex items-center gap-2">
              <Stars />
              <span className="font-medium">{site.ratingValue}</span>
              <span className="text-[color-mix(in_oklab,var(--color-porcelain)_60%,transparent)]">
                · {site.reviewCount}+ five-star reviews
              </span>
            </span>
            <span className="hidden h-4 w-px bg-white/15 sm:block" />
            <Link href="/consultation" className="link-underline font-medium text-[var(--color-gold-soft)]">
              Free consultation · 15% off your first visit
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="rise pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 lg:block" style={{ animationDelay: '0.9s' }}>
        <span className="flex h-12 w-7 items-start justify-center rounded-full border border-white/25 p-1.5">
          <span className="hero-scroll-dot h-2 w-2 rounded-full bg-[var(--color-gold-soft)]" />
        </span>
      </div>
    </section>
  );
}

function Stars() {
  return (
    <span className="flex gap-0.5 text-[var(--color-gold-soft)]" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M10 1.6l2.55 5.17 5.7.83-4.13 4.02.98 5.68L10 18.99 4.92 21.32l.98-5.68L1.75 7.6l5.7-.83z" />
        </svg>
      ))}
    </span>
  );
}
