import { Button, ArrowIcon } from '@/components/ui/Button';
import { KMark } from '@/components/brand/marks';
import { Reveal } from '@/components/motion/Reveal';

/**
 * Academy homepage banner (BLD-997) — mirrors the flagship homepage Hero's
 * ink + gold-glow + KMark treatment so it reads as one brand, without relying
 * on supplied photography.
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
        <Reveal className="max-w-2xl">
          <p className="eyebrow mb-4 inline-flex items-center gap-2.5 text-[var(--color-gold-soft)]">
            <span className="h-px w-8 bg-[var(--color-gold-soft)]/70" />
            K Academy
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.5rem+2vw,3.25rem)] leading-[1.05] tracking-[-0.01em]">
            Learn where beauty is <span className="text-gold-shimmer">practised</span>, not just taught.
          </h2>
          <p className="mt-5 max-w-xl text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">
            Small cohorts, real clinic equipment and clinician-led teaching inside a working
            Islington clinic — accredited qualifications from Level 2 to Level 7.
          </p>
          <div className="mt-7">
            <Button href="#courses" variant="gold">Explore courses <ArrowIcon /></Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
