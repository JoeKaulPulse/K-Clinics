import type { ReactNode } from 'react';
import { Reveal } from '@/components/motion/Reveal';

/** Standard eyebrow + title + lede block. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'start',
  className = '',
  tone = 'dark',
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: 'start' | 'center';
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <div
      className={`${align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'} ${className}`}
    >
      {eyebrow && (
        <Reveal>
          <p className={`eyebrow mb-6 inline-flex items-center gap-2.5 ${align === 'center' ? 'justify-center' : ''}`}>
            <span className="h-px w-7 bg-[var(--color-gold)]/60" />
            {eyebrow}
          </p>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h2 className={`text-title ${tone === 'light' ? 'text-[var(--color-porcelain)]' : ''}`}>{title}</h2>
      </Reveal>
      {lede && (
        <Reveal delay={0.12}>
          <p
            className={`mt-6 text-lede leading-relaxed ${align === 'center' ? 'mx-auto' : ''} max-w-2xl ${
              tone === 'light'
                ? 'text-[color-mix(in_oklab,var(--color-porcelain)_74%,transparent)]'
                : 'text-[var(--color-stone)]'
            }`}
          >
            {lede}
          </p>
        </Reveal>
      )}
    </div>
  );
}
