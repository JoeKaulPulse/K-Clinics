'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import type { Treatment } from '@/lib/treatments';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { ArrowIcon } from '@/components/ui/Button';

/**
 * Pinned horizontal-scroll gallery — vertical scroll drives the row sideways,
 * the signature award interaction. Mobile / reduced-motion falls back to a
 * native horizontal swipe rail.
 */
export function HorizontalGallery({ items, eyebrow, title }: { items: Treatment[]; eyebrow: string; title: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  // Move the row from 2% to roughly -(n-1.6) cards' worth across the pin.
  const x = useTransform(scrollYProgress, [0, 1], ['1%', '-72%']);

  // Mobile (and reduced-motion): a native horizontal swipe rail. Always rendered
  // on small screens; on md+ it's replaced by the pinned scroll version below.
  const SwipeRail = (
    <section className={`section-t ${reduce ? '' : 'md:hidden'}`}>
      <div className="container-lux mb-[var(--space-block)]">
        <Header eyebrow={eyebrow} title={title} />
      </div>
      <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-[var(--gutter)] pb-6 [scrollbar-width:none]">
        {items.map((t, i) => (
          <div key={t.slug} className="w-[78vw] shrink-0 snap-start sm:w-[42vw] lg:w-[28vw]">
            <Card t={t} index={i} />
          </div>
        ))}
      </div>
    </section>
  );

  if (reduce) return SwipeRail;

  return (
    <>
      {SwipeRail}
      <section ref={ref} className="relative hidden md:block" style={{ height: '320vh' }}>
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="container-lux mb-10">
          <Header eyebrow={eyebrow} title={title} />
        </div>
        <motion.div style={{ x }} className="flex gap-6 pl-[var(--gutter)] will-change-transform">
          {items.map((t, i) => (
            <div key={t.slug} className="w-[30vw] shrink-0 lg:w-[26vw]">
              <Card t={t} index={i} />
            </div>
          ))}
          <div className="flex w-[20vw] shrink-0 items-center">
            <Link href="/treatments" className="group inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">
              View all <ArrowIcon className="h-5 w-5" />
            </Link>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <div className="container-lux mt-8 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[var(--color-stone)]">
          <span>Scroll</span>
          <span className="h-px w-16 bg-[var(--color-line)]" />
        </div>
      </div>
    </section>
    </>
  );
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        <p className="eyebrow mb-5 inline-flex items-center gap-2.5">
          <span className="h-px w-7 bg-[var(--color-gold)]/60" />
          {eyebrow}
        </p>
        <h2 className="text-title">{title}</h2>
      </div>
    </div>
  );
}

function Card({ t, index }: { t: Treatment; index: number }) {
  return (
    <Link href={`/${t.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-2xl)]">
        <GenerativeArt
          from={t.gradient[0]}
          to={t.gradient[1]}
          seed={index}
          className="h-full w-full transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-[1.07]"
        />
        <span className="absolute left-5 top-5 rounded-full bg-black/25 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
          {t.group}
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(42,36,32,0.85),transparent)] p-6 pt-16 text-[var(--color-porcelain)]">
          <h3 className="font-[family-name:var(--font-display)] text-2xl">{t.title}</h3>
          <p className="mt-1.5 text-sm text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">{t.tagline}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-gold-soft)]">
            Discover <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  );
}
