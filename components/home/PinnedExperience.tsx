'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'motion/react';
import { MediaArt } from '@/components/ui/MediaArt';
import { treatmentImage } from '@/lib/treatment-images';
import { Aurora } from '@/components/ui/Aurora';

type Step = { n: string; t: string; d: string; grad: [string, string]; img: string | null };

const steps: Step[] = [
  { n: '01', t: 'Consultation', d: 'We listen first. A thorough, unhurried assessment of your goals, your skin or your smile — and complete transparency on what is possible.', grad: ['#a98a6d', '#7b6a5d'], img: treatmentImage('hydraglow-facial') },
  { n: '02', t: 'Your bespoke plan', d: 'A clear, staged plan tailored to you, with the right treatments sequenced for results that build beautifully over time.', grad: ['#7b6a5d', '#2a2420'], img: treatmentImage('rf-lifting') },
  { n: '03', t: 'Refined results', d: 'Expert delivery, attentive aftercare and outcomes that look natural, considered and unmistakably yours.', grad: ['#c2a589', '#4a3f37'], img: treatmentImage('veneers') },
];

/**
 * Pinned scrollytelling — the visual column stays fixed while the three steps
 * advance and the artwork cross-fades. A signature award-site interaction.
 * Falls back to a simple stacked layout on mobile / reduced-motion.
 */
export function PinnedExperience() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  return (
    <section className="surface-ink grain relative">
      <Aurora />
      <div className="container-lux relative section-t pb-6 text-center md:pb-10">
        <p className="eyebrow mb-6 inline-flex items-center gap-2.5 text-[var(--color-gold-soft)]">
          <span className="h-px w-7 bg-[var(--color-gold-soft)]/60" />
          The K Clinics experience
        </p>
        <h2 className="text-title mx-auto max-w-3xl text-[var(--color-porcelain)]">Considered from the first hello.</h2>
      </div>

      {reduce ? (
        <div className="container-lux relative grid gap-10 pb-[var(--space-section)] md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="border-t border-white/15 pt-6">
              <p className="font-[family-name:var(--font-display)] text-5xl text-[var(--color-gold)]/45">{s.n}</p>
              <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl text-[var(--color-porcelain)]">{s.t}</h3>
              <p className="mt-3 leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_70%,transparent)]">{s.d}</p>
            </div>
          ))}
        </div>
      ) : (
        <div ref={ref} className="relative hidden md:block" style={{ height: `${steps.length * 100}vh` }}>
          <div className="sticky top-0 flex h-screen items-center">
            <div className="container-lux grid w-full grid-cols-2 items-center gap-16">
              <div className="relative h-[60vh]">
                {steps.map((s, i) => (
                  <StepText key={s.n} step={s} index={i} total={steps.length} progress={scrollYProgress} />
                ))}
              </div>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-2xl)] shadow-[var(--shadow-lift)]">
                {steps.map((s, i) => (
                  <StepArt key={s.n} step={s} index={i} total={steps.length} progress={scrollYProgress} />
                ))}
                <div className="absolute bottom-6 left-6 right-6 flex gap-2">
                  {steps.map((_, i) => (
                    <RailSeg key={i} index={i} total={steps.length} progress={scrollYProgress} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StepText({ step, index, total, progress }: { step: Step; index: number; total: number; progress: MotionValue<number> }) {
  const seg = 1 / total;
  const start = index * seg;
  const first = index === 0;
  const last = index === total - 1;
  const opacity = useTransform(
    progress,
    [start - 0.01, start + 0.05, start + seg - 0.05, start + seg + 0.01],
    [first ? 1 : 0, 1, 1, last ? 1 : 0],
  );
  const y = useTransform(progress, [start, start + seg], ['18px', '-18px']);
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0 flex flex-col justify-center">
      <p className="font-[family-name:var(--font-display)] text-[6rem] leading-none text-[var(--color-gold)]/40">{step.n}</p>
      <h3 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-[var(--color-porcelain)]">{step.t}</h3>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]">{step.d}</p>
    </motion.div>
  );
}

function StepArt({ step, index, total, progress }: { step: Step; index: number; total: number; progress: MotionValue<number> }) {
  const seg = 1 / total;
  const start = index * seg;
  const last = index === total - 1;
  const opacity = useTransform(progress, [start - 0.06, start + 0.04, start + seg - 0.04, start + seg + 0.02], [0, 1, 1, last ? 1 : 0]);
  const scale = useTransform(progress, [start, start + seg], [1.08, 1]);
  return (
    <motion.div style={{ opacity, scale }} className="absolute inset-0">
      <MediaArt src={step.img} from={step.grad[0]} to={step.grad[1]} seed={index * 3} alt={step.t} sizes="(max-width: 768px) 100vw, 50vw" className="h-full w-full" />
    </motion.div>
  );
}

function RailSeg({ index, total, progress }: { index: number; total: number; progress: MotionValue<number> }) {
  const seg = 1 / total;
  const scaleX = useTransform(progress, [index * seg, (index + 1) * seg], [0, 1]);
  return (
    <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
      <motion.span style={{ scaleX }} className="block h-full origin-left bg-[var(--color-gold-soft)]" />
    </span>
  );
}
