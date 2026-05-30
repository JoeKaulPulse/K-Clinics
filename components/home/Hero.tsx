import Image from 'next/image';
import Link from 'next/link';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { KMark } from '@/components/brand/marks';
import { site } from '@/lib/site';

// next/image does not prepend basePath to unoptimised /public images on Pages.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Above-the-fold hero. Deliberately a *server* component: the LCP image and the
 * headline render in the initial HTML with no client JS gating them, and the
 * entrance motion is pure CSS — so the fold paints fast (better for Core Web
 * Vitals / SERPs). Split editorial layout: content left, photography right.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--color-porcelain)]">
      <div className="grid min-h-[100svh] lg:grid-cols-[1.04fr_0.96fr]">
        {/* ── Content ──────────────────────────────────────────────── */}
        <div className="order-2 flex flex-col justify-center px-[var(--gutter)] pb-14 pt-4 lg:order-1 lg:py-28 lg:pr-12">
          <div className="mx-auto w-full max-w-[34rem] lg:mx-0">
            <p className="rise eyebrow mb-6 inline-flex items-center gap-2.5" style={{ animationDelay: '0.05s' }}>
              <span className="h-px w-8 bg-[var(--color-gold)]/70" />
              Islington · London — Est. {site.founded}
            </p>

            <h1 className="font-[family-name:var(--font-display)] text-[clamp(2.75rem,1.55rem+3.7vw,5rem)] leading-[1.02] tracking-[-0.02em]">
              <span className="rise block" style={{ animationDelay: '0.12s' }}>
                Aesthetics &amp; dentistry,
              </span>
              <span className="rise block text-gold-shimmer" style={{ animationDelay: '0.22s' }}>
                perfected.
              </span>
            </h1>

            <p
              className="rise mt-7 max-w-md text-lg leading-relaxed text-[var(--color-stone)]"
              style={{ animationDelay: '0.32s' }}
            >
              London&rsquo;s clinic for advanced laser &amp; skin science and award-worthy aesthetic
              dentistry — delivered with precision, artistry and uncommon care.
            </p>

            <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '0.42s' }}>
              <Button href={site.booking.path} variant="gold" size="lg">
                Book your visit <ArrowIcon />
              </Button>
              <Button href="/treatments" variant="outline" size="lg">
                Explore treatments
              </Button>
            </div>

            <p className="rise mt-5 text-sm text-[var(--color-stone)]" style={{ animationDelay: '0.5s' }}>
              <Link href="/consultation" className="link-underline font-medium text-[var(--color-gold)]">
                Book a complimentary consultation
              </Link>{' '}
              · 15% off your first visit
            </p>

            <div
              className="rise mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--color-line)] pt-7 text-sm"
              style={{ animationDelay: '0.58s' }}
            >
              <span className="flex items-center gap-2">
                <Stars />
                <span className="font-medium">{site.ratingValue}</span>
                <span className="text-[var(--color-stone)]">· {site.reviewCount}+ five-star reviews</span>
              </span>
              <span className="hidden h-4 w-px bg-[var(--color-line)] sm:block" />
              <span className="text-[var(--color-stone)]">Award-trained clinicians</span>
            </div>
          </div>
        </div>

        {/* ── Photography ──────────────────────────────────────────── */}
        <div className="media-in relative order-1 h-[37svh] min-h-[15rem] overflow-hidden lg:order-2 lg:h-auto">
          <Image
            src={`${BASE}/hero/skin.webp`}
            alt="Radiant, healthy skin — advanced aesthetics at K Clinics, Islington"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-[40%_26%]"
          />
          {/* Seam blend into the cream content panel (desktop) */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(to_right,var(--color-porcelain),transparent_16%)] lg:block"
          />
          {/* Bottom blend so the image flows into content on mobile */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_top,var(--color-porcelain),transparent)] lg:hidden"
          />
          {/* Self-drawing K monogram watermark (CSS-animated, no JS) */}
          <KMark
            animated
            className="pointer-events-none absolute bottom-6 right-6 h-24 w-auto text-[var(--color-gold)] opacity-25 lg:bottom-10 lg:right-10 lg:h-40"
          />
        </div>
      </div>

      {/* Scroll cue */}
      <div
        className="rise pointer-events-none absolute bottom-7 left-1/2 hidden -translate-x-1/2 lg:flex"
        style={{ animationDelay: '1s' }}
      >
        <span className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.22em] text-[var(--color-stone)]">
          Scroll <span className="h-px w-12 bg-[var(--color-line)]" />
        </span>
      </div>
    </section>
  );
}

function Stars() {
  return (
    <span className="flex gap-0.5 text-[var(--color-gold)]" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M10 1.6l2.55 5.17 5.7.83-4.13 4.02.98 5.68L10 18.99 4.92 21.32l.98-5.68L1.75 7.6l5.7-.83z" />
        </svg>
      ))}
    </span>
  );
}
