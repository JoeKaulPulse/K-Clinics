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
      className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-2xl ${className}`}
    >
      {eyebrow && (
        <Reveal>
          <p className="eyebrow mb-4">{eyebrow}</p>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h2 className={`text-title ${tone === 'light' ? 'text-[--color-porcelain]' : ''}`}>{title}</h2>
      </Reveal>
      {lede && (
        <Reveal delay={0.12}>
          <p
            className={`mt-5 text-lg leading-relaxed ${
              tone === 'light'
                ? 'text-[color-mix(in_oklab,var(--color-porcelain)_74%,transparent)]'
                : 'text-[--color-stone]'
            }`}
          >
            {lede}
          </p>
        </Reveal>
      )}
    </div>
  );
}
