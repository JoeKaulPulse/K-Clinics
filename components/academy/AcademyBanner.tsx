import { Button, ArrowIcon } from '@/components/ui/Button';
import { KMark } from '@/components/brand/marks';

/**
 * Academy homepage banner (BLD-997) — the three-level VTCT enrolment offer the
 * item actually asked for (L2+L3+L4 together, £3,500, was £5,000 crossed out,
 * save £1,500, Enrol Now CTA), in the flagship Hero's ink + gold-glow + KMark
 * brand treatment per the owner's "no artwork, brand style" note. A prior pass
 * shipped this section with generic copy, reading that note as replacing the
 * offer — it only replaced the artwork. Prices are owner-stated on BLD-997;
 * edit them here (this file) if the campaign changes.
 *
 * Deliberately NOT wrapped in <Reveal>. Reported live as "banner not showing":
 * it was shipped, deployed and present in the server HTML, but Reveal renders
 * its children at style="opacity:0" and hands visibility to a client-side
 * intersection observer that BLD-1171 already confirmed can silently never
 * fire. This is the page's primary marketing message sitting just below the
 * fold — the one place that gamble costs the most — so it renders visible in
 * the server HTML and stays visible whatever happens to JS. The Reveal backstop
 * was widened alongside this (see components/motion/Reveal.tsx), but the banner
 * no longer depends on it being right.
 */
export function AcademyBanner() {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--color-ink)] text-[var(--color-porcelain)]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_80%_15%,color-mix(in_oklab,var(--color-gold)_24%,transparent),transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-1/2 hidden h-[130%] -translate-y-1/2 text-[var(--color-gold-soft)] opacity-[0.3] md:block"
      >
        <KMark className="h-full w-auto" />
      </div>
      <div className="container-lux relative z-10 py-16 md:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow mb-4 inline-flex items-center gap-2.5 text-[var(--color-gold-soft)]">
            <span className="h-px w-8 bg-[var(--color-gold-soft)]/70" />
            Limited-time offer
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.5rem+2vw,3.25rem)] leading-[1.05] tracking-[-0.01em]">
            All three VTCT levels. <span className="text-gold-shimmer">One enrolment.</span>
          </h2>
          <p className="mt-5 max-w-xl text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">
            Enrol on Level 2, Level 3 and Level 4 together — Ofqual-regulated, VTCT-certified,
            taught inside a working Islington clinic.
          </p>
          {/* The offer price row (BLD-997: the item asks for the original price
              crossed out and the saving shown). The del carries screen-reader
              context so "£5,000 £3,500" doesn't read as one confusing number. */}
          <p className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <del className="text-xl text-[color-mix(in_oklab,var(--color-porcelain)_55%,transparent)]">
              <span className="sr-only">Was </span>£5,000
            </del>
            <span className="font-[family-name:var(--font-display)] text-4xl text-[var(--color-gold-soft)] md:text-5xl">
              <span className="sr-only">Now </span>£3,500
            </span>
            <span className="rounded-full border border-[var(--color-gold-soft)]/60 px-3 py-1 text-sm font-medium uppercase tracking-[0.12em] text-[var(--color-gold-soft)]">
              Save £1,500
            </span>
          </p>
          <div className="mt-7">
            <Button href="#courses" variant="gold">Enrol now <ArrowIcon /></Button>
          </div>
        </div>
      </div>
    </section>
  );
}
