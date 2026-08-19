'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { Stars } from '@/components/ui/Stars';
import { KMark } from '@/components/brand/marks';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { useReducedMotionSafe } from '@/components/motion/use-reduced-motion-safe';
import { site } from '@/lib/site';

/**
 * BLD-1348 — above-the-fold hero slider: three slides showcasing the elements
 * of the business (the clinic, the academy, and the clinic film / Get My Plan),
 * replacing the single static hero at the owner's request.
 *
 * Built to keep the two properties the old hero was designed around:
 *
 * 1. The fold NEVER depends on JS (the BLD-997 lesson). Slide 1 is the active
 *    slide in the server-rendered HTML, using the same CSS-only entrance
 *    animations (.rise / .reveal-mask) as the hero it replaces. If hydration
 *    never happens, visitors get the old static hero — not a blank fold.
 * 2. The fold stays light. No `motion` import — the crossfade is a pure CSS
 *    transition and the only JS is a ~2KB index/timer shell, so the LCP
 *    heading isn't gated on an animation bundle.
 *
 * Rotation: auto-advances every 7s; pauses while hovered or keyboard-focused;
 * a visible ⏸/▶ toggle satisfies WCAG 2.2.2 for touch users. Any manual
 * navigation (arrows, dots, swipe) stops rotation — a slider that keeps moving
 * under someone who's driving it is worse than no slider — and the ▶ control
 * genuinely restarts it. prefers-reduced-motion disables auto-advance entirely
 * (arrows/dots still work) and stops the film from auto-playing.
 *
 * The film slide plays the owner-supplied video (Admin → Site → "Homepage hero
 * video") muted and looping, only while its slide is showing. Until a URL is
 * supplied it falls back to the branded generative artwork, so the slider
 * ships now and adopts the film the moment it exists — no code change.
 */

const AUTOPLAY_MS = 7000;
const SWIPE_MIN_PX = 48;
const SLIDE_COUNT = 4;
// BLD-1197: slide 2 is the Signature Facial promotion (prices owner-confirmed 18 Aug).
const SLIDE_LABELS = ['The clinic', 'Signature Facial offer', 'K Academy', 'Inside KClinics'];

const ease = 'cubic-bezier(0.16,1,0.3,1)';

export function HeroSlider({
  rating,
  video,
}: {
  rating?: { average: number; count: number } | null;
  video?: { videoUrl: string; videoPoster: string } | null;
}) {
  const [index, setIndex] = useState(0);
  // Hover and keyboard focus each hold their own pause — a single shared flag
  // meant a mouse leaving could resume rotation under a keyboard user still
  // focused inside (review finding).
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // WCAG 2.2.2 (Pause, Stop, Hide): auto-rotation needs an explicit control,
  // not just hover-pause — a touch user has no hover. `stopped` backs the
  // visible ⏸/▶ toggle, and any manual navigation (arrows, dots, swipe) also
  // stops rotation — so the toggle's icon always tells the truth about whether
  // the slider is rotating, and ▶ genuinely restarts it.
  const [stopped, setStopped] = useState(false);
  const reduce = useReducedMotionSafe();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  // The <video> mounts only once (a) its slide has been shown AND (b) the
  // visitor has actually interacted with the page. Two review findings behind
  // this: browsers fetch a poster image eagerly on element insertion
  // (preload="none" governs media data only), so an up-front mount downloads
  // the poster on every homepage visit while hidden; and Chrome keeps
  // registering larger LCP candidates until the first input/scroll — a
  // full-bleed video frame fading in at ~14s would become the reported LCP of
  // every interaction-free session. Gating the mount on interaction makes that
  // impossible (the interaction that arms it is the event that finalises LCP);
  // an idle session rotating to slide 3 sees the branded artwork, which is CSS
  // gradients and text — not LCP candidates.
  const [interacted, setInteracted] = useState(false);
  useEffect(() => {
    const arm = () => setInteracted(true);
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    evs.forEach((ev) => window.addEventListener(ev, arm, { once: true, passive: true }));
    return () => evs.forEach((ev) => window.removeEventListener(ev, arm));
  }, []);
  const [visitedFilm, setVisitedFilm] = useState(false);
  useEffect(() => { if (index === 3) setVisitedFilm(true); }, [index]);
  const filmArmed = interacted && visitedFilm;
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback((next: number, manual = false) => {
    if (manual) setStopped(true);
    setIndex(((next % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT);
  }, []);

  const rotating = !reduce && !hovered && !focused && !stopped;

  // Auto-advance while rotating; the interval restarts on each slide change so
  // every slide gets its full dwell time.
  useEffect(() => {
    if (!rotating) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDE_COUNT), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [rotating, index]);

  // The film plays only while its slide is showing, and never under reduced
  // motion (an ambient looping video is exactly what that preference asks off).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (index === 3 && !reduce) v.play().catch(() => { /* autoplay blocked — poster/fallback stays */ });
    else v.pause();
  }, [index, reduce]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // A deliberate horizontal swipe only — a vertical or diagonal page-scroll
    // flick must never change slides (review finding).
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1), true);
  };

  // Pause while any control (or link) inside the slider holds keyboard focus.
  const onFocus = () => setFocused(true);
  const onBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  // `pointer-events-none` applies instantly (unlike visibility, which holds
  // `visible` for the whole 900ms crossfade), so an outgoing slide can never
  // intercept clicks aimed at the incoming one; `z-[1]` keeps the active slide
  // painting above the outgoing slide regardless of DOM order (review finding).
  const slide = (i: number) =>
    `relative col-start-1 row-start-1 flex min-h-[100svh] items-center overflow-hidden transition-[opacity,visibility] duration-[900ms] ${
      index === i ? 'z-[1] opacity-100' : 'pointer-events-none invisible opacity-0'
    }`;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="KClinics highlights"
      // APG carousel pattern: announce slide changes only while rotation is
      // NOT running (a rotating carousel announcing itself every 7s is noise).
      aria-live={rotating ? 'off' : 'polite'}
      className="relative isolate grid overflow-hidden bg-[var(--color-ink)] text-[var(--color-porcelain)]"
      style={{ transitionTimingFunction: ease }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={onFocus}
      onBlurCapture={onBlur}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Slide 1 — the clinic (the previous hero, verbatim; the page's LCP) ──
          `inert` applies the moment a slide goes inactive (visibility only flips
          at the END of the 900ms crossfade), so a fading-out slide's links can't
          be tabbed into and then have focus destroyed at the flip. */}
      <div role="group" aria-roledescription="slide" aria-label={`1 of ${SLIDE_COUNT}: ${SLIDE_LABELS[0]}`} inert={index !== 0} className={slide(0)} style={{ transitionTimingFunction: ease }}>
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(125%_95%_at_74%_36%,color-mix(in_oklab,var(--color-gold)_26%,transparent),transparent_56%)]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_125%,color-mix(in_oklab,#000_45%,transparent),transparent_52%)]" />
        <div aria-hidden className="pointer-events-none absolute right-[-6%] top-1/2 hidden h-[80%] -translate-y-1/2 text-[var(--color-gold-soft)] opacity-[0.55] md:block lg:right-[1%]">
          <KMark animated className="h-full w-auto" />
        </div>

        <div className="container-lux relative z-10 py-32">
          <div className="max-w-2xl">
            <p className="rise eyebrow mb-6 inline-flex items-center gap-2.5 text-[var(--color-gold-soft)]" style={{ animationDelay: '0.05s' }}>
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
            <p className="rise mt-7 max-w-xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]" style={{ animationDelay: '0.4s' }}>
              A London clinic devoted to natural beauty — expert aesthetics and aesthetic dentistry,
              tailored to you and delivered with warmth, artistry and genuine care.
            </p>
            <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: '0.5s' }}>
              <Button href={site.booking.path} variant="gold" size="lg">Book your visit <ArrowIcon /></Button>
              <Button href="/treatments" variant="outline" size="lg">Explore treatments</Button>
            </div>
            <div className="rise mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.12] pt-7 text-sm" style={{ animationDelay: '0.6s' }}>
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
              <Link href="/book" className="link-underline font-medium text-[var(--color-gold-soft)]">
                Free consultation · 15% off your first visit
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide 2 — Signature Facial promotion (BLD-1197; £150/£210 owner-confirmed 18 Aug) ── */}
      <div role="group" aria-roledescription="slide" aria-label={`2 of ${SLIDE_COUNT}: ${SLIDE_LABELS[1]}`} inert={index !== 1} className={slide(1)} style={{ transitionTimingFunction: ease }}>
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_75%_25%,color-mix(in_oklab,var(--color-gold)_26%,transparent),transparent_56%)]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_125%,color-mix(in_oklab,#000_45%,transparent),transparent_52%)]" />
        <div aria-hidden className="pointer-events-none absolute right-[-8%] top-1/2 hidden h-[110%] -translate-y-1/2 text-[var(--color-gold-soft)] opacity-[0.3] md:block">
          <KMark className="h-full w-auto" />
        </div>

        <div className="container-lux relative z-10 py-32">
          <div className="max-w-2xl">
            <p className="eyebrow mb-6 inline-flex items-center gap-2.5 text-[var(--color-gold-soft)]">
              <span className="h-px w-8 bg-[var(--color-gold-soft)]/70" />
              Limited-time offer
            </p>
            {/* Same 4rem cap as the other later slides — see the LCP note on slide 3. */}
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(2.25rem,1.4rem+2.9vw,4rem)] leading-[1.04] tracking-[-0.02em]">
              The Signature Facial, <span className="text-gold-shimmer">at its best price.</span>
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">
              Cleanse, resurface and glow — our prescriptive signature facial, tailored to your skin
              by the clinicians who know it best.
            </p>
            <p className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <del className="text-xl text-[color-mix(in_oklab,var(--color-porcelain)_55%,transparent)]"><span className="sr-only">Was </span>£210</del>
              <span className="font-[family-name:var(--font-display)] text-4xl text-[var(--color-gold-soft)] md:text-5xl"><span className="sr-only">Now </span>£150</span>
              <span className="rounded-full border border-[var(--color-gold-soft)]/60 px-3 py-1 text-sm font-medium uppercase tracking-[0.12em] text-[var(--color-gold-soft)]">Save £60</span>
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button href="/book?treatment=face-treatments" variant="gold" size="lg">Book the offer <ArrowIcon /></Button>
              <Button href="/face-treatments" variant="outline" size="lg">About the facial</Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide 3 — K Academy ── */}
      <div role="group" aria-roledescription="slide" aria-label={`3 of ${SLIDE_COUNT}: ${SLIDE_LABELS[2]}`} inert={index !== 2} className={slide(2)} style={{ transitionTimingFunction: ease }}>
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_20%_20%,color-mix(in_oklab,var(--color-gold)_22%,transparent),transparent_58%)]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_125%,color-mix(in_oklab,#000_45%,transparent),transparent_52%)]" />
        <div aria-hidden className="pointer-events-none absolute right-[-8%] top-1/2 hidden h-[110%] -translate-y-1/2 text-[var(--color-gold-soft)] opacity-[0.3] md:block">
          <KMark className="h-full w-auto" />
        </div>

        <div className="container-lux relative z-10 py-32">
          <div className="max-w-2xl">
            <p className="eyebrow mb-6 inline-flex items-center gap-2.5 text-[var(--color-gold-soft)]">
              <span className="h-px w-8 bg-[var(--color-gold-soft)]/70" />
              K Academy — Level 2 to Level 7
            </p>
            {/* Capped at 4rem (h1 runs to 5.5rem): a later slide's heading must
                paint a SMALLER area than slide 1's h1, or the 7s auto-advance
                registers a new, larger LCP candidate in interaction-free
                sessions (review finding). */}
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(2.25rem,1.4rem+2.9vw,4rem)] leading-[1.04] tracking-[-0.02em]">
              Train to the standard you’d <span className="text-gold-shimmer">want to be treated by.</span>
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">
              Accredited aesthetics training inside a working Islington clinic — Ofqual-regulated,
              VTCT and CPD-accredited, taught by the clinicians who practise it every day.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button href="/academy" variant="gold" size="lg">Explore the academy <ArrowIcon /></Button>
              <Button href="/academy/funding" variant="outline" size="lg">Funding &amp; finance</Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide 4 — the clinic film (owner-supplied video; branded fallback) ── */}
      <div role="group" aria-roledescription="slide" aria-label={`4 of ${SLIDE_COUNT}: ${SLIDE_LABELS[3]}`} inert={index !== 3} className={slide(3)} style={{ transitionTimingFunction: ease }}>
        {video?.videoUrl && !videoFailed && filmArmed ? (
          <video
            ref={videoRef}
            src={video.videoUrl}
            poster={video.videoPoster || undefined}
            muted
            loop
            playsInline
            preload="none"
            autoPlay={!reduce}
            aria-hidden
            tabIndex={-1}
            onError={() => setVideoFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <GenerativeArt from="#2a2420" to="#7b6a5d" seed={3} className="absolute inset-0" />
        )}
        {/* Scrims so the live text stays legible even over bright footage
            (review finding: nothing else guards against a white film frame).
            Mobile copy spans nearly the full viewport width, so it gets a flat
            layer; the desktop gradient keeps a 0.38 floor at the right edge. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[rgba(42,36,32,0.55)] md:bg-transparent" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(42,36,32,0.82),rgba(42,36,32,0.62)_58%,rgba(42,36,32,0.38))]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(42,36,32,0.55),transparent_45%)]" />

        <div className="container-lux relative z-10 py-32">
          <div className="max-w-2xl">
            <p className="eyebrow mb-6 inline-flex items-center gap-2.5 text-[var(--color-gold-soft)]">
              <span className="h-px w-8 bg-[var(--color-gold-soft)]/70" />
              Inside KClinics
            </p>
            {/* Same 4rem cap as slide 2 — see the LCP note there. */}
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(2.25rem,1.4rem+2.9vw,4rem)] leading-[1.04] tracking-[-0.02em]">
              One address. <span className="text-gold-shimmer">Every kind of confidence.</span>
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">
              Advanced laser and skin aesthetics, smile design and an accredited academy — step
              inside the clinic and get a personalised plan built around you.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button href="/ai-consultation" variant="gold" size="lg">Get My Plan <ArrowIcon /></Button>
              <Button href="/about" variant="outline" size="lg">Our story</Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls — aligned to the same container as the slide copy ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20">
        <div className="container-lux flex items-center justify-center gap-4 lg:justify-end">
        <div className="pointer-events-auto flex items-center gap-4">
        <button
          type="button"
          onClick={() => go(index - 1, true)}
          aria-label="Previous slide"
          className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold-soft)] hover:text-[var(--color-gold-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold-soft)]"
        >
          <span aria-hidden>←</span>
        </button>
        <div className="flex items-center">
          {SLIDE_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => go(i, true)}
              aria-label={`Go to slide ${i + 1}: ${label}`}
              aria-current={index === i ? 'true' : undefined}
              // 24px minimum hit target (WCAG 2.5.8); the pill inside is the visual.
              className="grid h-6 min-w-6 place-items-center px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold-soft)]"
            >
              <span
                aria-hidden
                className={`block h-2 rounded-full transition-all duration-500 ${
                  index === i ? 'w-8 bg-[var(--color-gold-soft)]' : 'w-2 bg-white/45 hover:bg-white/65'
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStopped((v) => !v)} // ▶ genuinely restarts rotation — manual nav only sets `stopped`
          aria-label={stopped ? 'Resume slideshow' : 'Pause slideshow'}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold-soft)] hover:text-[var(--color-gold-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold-soft)]"
        >
          {stopped ? (
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><path d="M4 2.5v11l9-5.5-9-5.5z" /></svg>
          ) : (
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" /></svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => go(index + 1, true)}
          aria-label="Next slide"
          className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold-soft)] hover:text-[var(--color-gold-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold-soft)]"
        >
          <span aria-hidden>→</span>
        </button>
        </div>
        </div>
      </div>

      {/* Scroll cue (as on the hero this replaces) — hidden where the controls sit centred. */}
      <div className="rise pointer-events-none absolute bottom-8 left-8 hidden lg:block" style={{ animationDelay: '0.9s' }}>
        <span className="flex h-12 w-7 items-start justify-center rounded-full border border-white/25 p-1.5">
          <span className="hero-scroll-dot h-2 w-2 rounded-full bg-[var(--color-gold-soft)]" />
        </span>
      </div>
    </section>
  );
}
