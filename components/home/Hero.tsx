'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { WordReveal } from '@/components/motion/WordReveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { KMark } from '@/components/brand/marks';
import { site } from '@/lib/site';

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '24%']);
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.12]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative flex min-h-[100svh] items-end overflow-hidden">
      {/* Generative backdrop */}
      <motion.div style={{ y, scale }} className="absolute inset-0">
        <GenerativeArt from="#2a2420" to="#4a3f37" className="h-full w-full" />
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_70%_30%,rgba(169,138,109,0.30),transparent_60%)]" />
      </motion.div>

      {/* Signature animated K emblem — self-draws on load, drifts on scroll */}
      <motion.div
        aria-hidden
        style={{ y: useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '-18%']) }}
        className="pointer-events-none absolute -right-[6%] top-1/2 z-0 hidden h-[80%] -translate-y-1/2 text-[var(--color-gold-soft)] opacity-[0.16] md:block lg:-right-[2%]"
      >
        <KMark animated className="h-full w-auto" />
      </motion.div>

      {/* Content */}
      <motion.div style={{ opacity: fade }} className="container-lux relative z-10 pb-20 pt-40 md:pb-28">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="eyebrow mb-6 text-[var(--color-gold-soft)]"
        >
          Islington · London · Est. {site.founded}
        </motion.p>

        <WordReveal
          as="h1"
          text="Aesthetics & dentistry,"
          delay={0.2}
          className="text-hero max-w-5xl text-[var(--color-porcelain)]"
        />
        <WordReveal
          as="span"
          text="perfected."
          delay={0.5}
          className="text-hero block max-w-5xl text-gold-gradient"
        />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]"
        >
          A singular London clinic where advanced laser and skin science meets
          award-worthy aesthetic dentistry — delivered with precision, artistry and
          uncommon care.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.05 }}
          className="mt-10"
        >
          <BookingButtons />
          <p className="mt-5 text-sm text-[color-mix(in_oklab,var(--color-porcelain)_60%,transparent)]">
            Complimentary consultations · 15% off your first visit
          </p>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 md:block"
      >
        <span className="flex h-12 w-7 items-start justify-center rounded-full border border-white/30 p-1.5">
          <motion.span
            className="h-2 w-2 rounded-full bg-[var(--color-gold-soft)]"
            animate={reduce ? undefined : { y: [0, 14, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      </motion.div>
    </section>
  );
}
