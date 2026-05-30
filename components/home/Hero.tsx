import Image from 'next/image';
import Link from 'next/link';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { KMark } from '@/components/brand/marks';
import { site } from '@/lib/site';

// next/image does not prepend basePath to unoptimised /public images on Pages.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Above-the-fold hero. A *server* component: the LCP image and headline render in
 * the initial HTML with no client JS gating them, and the entrance motion is pure
 * CSS — so the fold paints fast (good for Core Web Vitals / SERPs). Editorial
 * stacked layout: copy on a cream field above, the diverse trio band below (its
 * cream backdrop melts seamlessly into the section).
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--color-porcelain)]">
      {/* Brand geometry echoing the photography — fills the copy field's negative
          space and connects visually to the arcs in the trio band below. */}
      <svg
        aria-hidden
        viewBox="0 0 520 520"
        fill="none"
        stroke="currentColor"
        className="pointer-events-none absolute -right-24 top-2 hidden h-[42vh] w-auto text-[var(--color-stone)] opacity-[0.18] lg:block"
        strokeWidth="0.8"
      >
        <circle cx="300" cy="260" r="250" />
        <circle cx="300" cy="260" r="165" />
        <circle cx="300" cy="260" r="80" />
        <line x1="40" y1="260" x2="520" y2="260" />
        <path d="M70 60 Q300 260 70 460" />
      </svg>

      {/* ── Copy ─────────────────────────────────────────────────── */}
      <div className="container-lux relative pb-5 pt-24 lg:pb-7 lg:pt-28">
        <div className="max-w-[42rem]">
          <p className="rise eyebrow mb-4 inline-flex items-center gap-2.5" style={{ animationDelay: '0.05s' }}>
            <span className="h-px w-8 bg-[var(--color-gold)]/70" />
            Islington · London — Est. {site.founded}
          </p>

          <h1 className="font-[family-name:var(--font-display)] text-[clamp(2.4rem,1.5rem+2.9vw,4.25rem)] leading-[1.03] tracking-[-0.02em]">
            <span className="reveal-mask">
              <span className="reveal-line" style={{ animationDelay: '0.12s' }}>Aesthetics &amp; dentistry,</span>
            </span>
            <span className="reveal-mask">
              <span className="reveal-line" style={{ animationDelay: '0.28s' }}>
                <span className="text-gold-shimmer">perfected.</span>
              </span>
            </span>
          </h1>

          <p
            className="rise mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-stone)]"
            style={{ animationDelay: '0.4s' }}
          >
            Advanced laser &amp; skin science and award-worthy aesthetic dentistry — for every skin tone.
          </p>

          <div className="rise mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: '0.5s' }}>
            <Button href={site.booking.path} variant="gold" size="lg">
              Book your visit <ArrowIcon />
            </Button>
            <Button href="/treatments" variant="outline" size="lg">
              Explore treatments
            </Button>
          </div>

          <div
            className="rise mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm"
            style={{ animationDelay: '0.6s' }}
          >
            <span className="flex items-center gap-2">
              <Stars />
              <span className="font-medium">{site.ratingValue}</span>
              <span className="text-[var(--color-stone)]">· {site.reviewCount}+ five-star reviews</span>
            </span>
            <span className="hidden h-4 w-px bg-[var(--color-line)] sm:block" />
            <Link href="/consultation" className="link-underline font-medium text-[var(--color-gold)]">
              Free consultation · 15% off your first visit
            </Link>
          </div>
        </div>
      </div>

      {/* ── Trio photography band ─────────────────────────────────── */}
      <div className="hero-media relative h-[33svh] min-h-[13rem] w-full lg:h-[52vh]">
        <div className="hero-parallax absolute inset-0 lg:-inset-y-[6%]">
          <Image
            src={`${BASE}/hero/trio.webp`}
            alt="Three women of different skin tones — advanced aesthetics for everyone at K Clinics, Islington"
            fill
            priority
            sizes="100vw"
            className="hero-img object-cover object-[50%_30%]"
          />
        </div>
        {/* Blend the band's top edge into the cream copy field above it. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,var(--color-porcelain),transparent)]"
        />
        {/* Self-drawing K monogram (CSS-animated, no JS). */}
        <KMark
          animated
          className="pointer-events-none absolute bottom-5 right-6 h-16 w-auto text-[var(--color-ink)] opacity-25 lg:bottom-7 lg:right-10 lg:h-24"
        />
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
