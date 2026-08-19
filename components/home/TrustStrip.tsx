import { Reveal } from '@/components/motion/Reveal';
import { getReviewAggregate } from '@/lib/reviews-aggregate';

// Real, verifiable credentials only. Update as further accreditations are
// earned (e.g. Save Face, CQC) — never list one before it's granted.
// BLD-1159: the strip also surfaces the REAL aggregate review rating (the same
// getReviewAggregate() the hero and testimonials use — Google + verified
// internal reviews, null until real reviews exist). Third-party marks (CQC,
// Save Face…) are added here only once earned — owner call, tracked on the board.
const marks = [
  { k: 'Licensed', v: 'High-Risk Special Treatment Licence' },
  { k: 'Level 7', v: 'Qualified injector' },
  { k: 'Prescriber', v: 'Prescriber-led care' },
];

export async function TrustStrip() {
  const agg = await getReviewAggregate().catch(() => null);
  const cells = agg && agg.count > 0
    ? [{ k: `${agg.average.toFixed(1)} ★`, v: `${agg.count} verified client review${agg.count === 1 ? '' : 's'}` }, ...marks]
    : marks;
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-porcelain)]">
      {/* Full class strings (not interpolated fragments) so Tailwind can see them. */}
      <div className={cells.length === 4 ? 'container-lux grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-2 lg:grid-cols-4' : 'container-lux grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-3'}>
        {cells.map((m, i) => (
          <Reveal key={m.k} delay={i * 0.06}>
            <div className="flex flex-col items-center px-4 py-8 text-center md:py-10">
              <span className="font-[family-name:var(--font-display)] text-xl text-[var(--color-ink)] md:text-2xl">{m.k}</span>
              <span className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">{m.v}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
