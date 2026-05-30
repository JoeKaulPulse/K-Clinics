import { Reveal } from '@/components/motion/Reveal';

// Credential / trust markers. Replace labels with real accreditations
// (GDC, CQC, Save Face, brand partners) and logos when supplied.
const marks = [
  { k: 'GDC', v: 'Registered clinicians' },
  { k: 'CQC', v: 'Care Quality Commission' },
  { k: 'Save Face', v: 'Accredited register' },
  { k: 'Medical-grade', v: 'Technology & protocols' },
];

export function TrustStrip() {
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <div className="container-lux grid grid-cols-2 gap-px overflow-hidden md:grid-cols-4">
        {marks.map((m, i) => (
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
