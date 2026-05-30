import type { ReactNode } from 'react';
import { WordReveal } from '@/components/motion/WordReveal';
import { Reveal } from '@/components/motion/Reveal';
import { GenerativeArt } from '@/components/ui/GenerativeArt';

/** Compact, premium hero for interior pages. Text is live HTML over generative art. */
export function PageHero({
  eyebrow,
  title,
  lede,
  gradient = ['#161310', '#3f342b'],
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: ReactNode;
  gradient?: [string, string];
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <GenerativeArt from={gradient[0]} to={gradient[1]} className="absolute inset-0" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(22,19,16,0.35),rgba(22,19,16,0.55))]" />
      <div className="container-lux relative z-10 pb-16 pt-[calc(var(--header-h,5.25rem)+4.5rem)] text-[var(--color-porcelain)] md:pb-24 md:pt-[calc(var(--header-h,5.25rem)+6rem)]">
        <Reveal>
          <p className="eyebrow mb-5 text-[var(--color-gold-soft)]">{eyebrow}</p>
        </Reveal>
        <WordReveal as="h1" text={title} className="text-display max-w-4xl" />
        {lede && (
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_82%,transparent)]">
              {lede}
            </p>
          </Reveal>
        )}
        {children && (
          <Reveal delay={0.25}>
            <div className="mt-9">{children}</div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
