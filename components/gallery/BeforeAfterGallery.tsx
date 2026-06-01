'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { galleryCases, galleryCategories, type GalleryCase } from '@/lib/gallery';
import { Stagger, StaggerItem } from '@/components/motion/Reveal';

function Labels() {
  // Overlaid Before/After pills — images are composites (before top, after bottom).
  return (
    <>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[color-mix(in_oklab,var(--color-ink)_72%,transparent)] px-2.5 py-1 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-[var(--color-porcelain)] backdrop-blur">Before</span>
      <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-[color-mix(in_oklab,var(--color-gold)_85%,transparent)] px-2.5 py-1 text-[0.6rem] font-medium uppercase tracking-[0.14em] text-white backdrop-blur">After</span>
    </>
  );
}

export function BeforeAfterGallery() {
  const [cat, setCat] = useState('All');
  const [open, setOpen] = useState<number | null>(null);

  const cases = useMemo<GalleryCase[]>(
    () => (cat === 'All' ? galleryCases : galleryCases.filter((c) => c.category === cat)),
    [cat],
  );

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + cases.length) % cases.length)), [cases.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, close, step]);

  const active = open === null ? null : cases[open];

  return (
    <>
      {/* Category filter */}
      <div className="mb-10 flex flex-wrap gap-2">
        {galleryCategories.map((c) => (
          <button
            key={c}
            onClick={() => { setCat(c); setOpen(null); }}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${cat === c ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-stone-soft)]'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Grid */}
      <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cases.map((c, i) => (
          <StaggerItem key={c.src}>
            <button
              onClick={() => setOpen(i)}
              className="group relative block w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)]"
              aria-label={`View ${c.category} before and after, case ${i + 1}`}
            >
              <span className="relative block aspect-square">
                <Image src={c.src} alt={`${c.category} before and after`} fill sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw" className="object-cover transition-transform duration-700 [transition-timing-function:var(--ease-lux)] group-hover:scale-[1.05]" />
              </span>
              <Labels />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-[linear-gradient(to_top,rgba(42,36,32,0.85),transparent)] px-3 pb-2.5 pt-8 text-left">
                <span className="text-xs font-medium text-[var(--color-porcelain)]">{c.category}</span>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-[var(--color-porcelain)] opacity-0 transition-opacity group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                </span>
              </span>
            </button>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Lightbox modal */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[color-mix(in_oklab,var(--color-ink)_88%,black)] p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close} role="dialog" aria-modal="true" aria-label={`${active.category} before and after`}
          >
            <button onClick={close} aria-label="Close" className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/25 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>

            {cases.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] md:left-6">←</button>
                <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] md:right-6">→</button>
              </>
            )}

            <motion.div
              key={active.src}
              className="flex max-h-[88vh] w-full max-w-md flex-col"
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-lift)]">
                <Image src={active.src} alt={`${active.category} before and after`} width={1080} height={1080} className="h-auto max-h-[72vh] w-full object-contain" />
                <Labels />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg text-[var(--color-porcelain)]">{active.category}</p>
                  <p className="text-xs text-[color-mix(in_oklab,var(--color-porcelain)_60%,transparent)]">Real client result · individual outcomes vary</p>
                </div>
                <Link href={active.href} className="inline-flex items-center gap-2 rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-gold-soft)] hover:text-[var(--color-ink)]">
                  Explore {active.category.toLowerCase()} →
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
