'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

// BLD-530 (academy portal cleanup, Phase 0): the portal's shared UI primitives.
// One card surface, one button family, one heading/eyebrow/stat/pill set — so the
// trainee portal stops drifting into a dozen bespoke styles. A 'use client' module
// so server pages and client components can both use it; presentational props are
// serialisable and `children` render on the server and pass through.

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/** Canonical page header: optional eyebrow, title, optional lede. */
export function PageTitle({ children, lede, eyebrow, className }: { children: ReactNode; lede?: ReactNode; eyebrow?: ReactNode; className?: string }) {
  return (
    <header className={cx('mb-8', className)}>
      {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">{eyebrow}</p>}
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">{children}</h1>
      {lede && <p className="mt-2 max-w-2xl text-[var(--color-stone)]">{lede}</p>}
    </header>
  );
}

/** Section heading with optional sub-line. */
export function SectionTitle({ children, sub, className }: { children: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-4', className)}>
      <h2 className="font-[family-name:var(--font-display)] text-xl">{children}</h2>
      {sub && <p className="mt-1 text-sm text-[var(--color-stone)]">{sub}</p>}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]', className)}>{children}</p>;
}

/** The one portal card. radius-lg + line border; `tone` sets the surface, `accent`
 *  swaps the border to gold for "needs attention" cards. */
export function Card({ children, className, tone = 'bone', accent = false }: { children: ReactNode; className?: string; tone?: 'bone' | 'porcelain' | 'white'; accent?: boolean }) {
  const bg = tone === 'porcelain' ? 'bg-[var(--color-porcelain)]' : tone === 'white' ? 'bg-white' : 'bg-[var(--color-bone)]';
  return <div className={cx('rounded-[var(--radius-lg)] border', accent ? 'border-[var(--color-gold)]' : 'border-[var(--color-line)]', bg, className)}>{children}</div>;
}

/** A display-font number with a small uppercase label under it. */
export function Stat({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return <div className={className}><p className="font-[family-name:var(--font-display)] text-2xl">{value}</p><p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">{label}</p></div>;
}

/** Small status pill. Tones are semantic, not ad-hoc colours. */
export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'good' | 'info'; className?: string }) {
  const tones = {
    neutral: 'bg-[var(--color-line)] text-[var(--color-stone)]',
    gold: 'bg-[var(--color-gold)]/15 text-[var(--color-gold-deep)]',
    good: 'bg-green-100 text-green-800',
    info: 'bg-sky-100 text-sky-800',
  } as const;
  return <span className={cx('inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide', tones[tone], className)}>{children}</span>;
}

export function ProgressBar({ pct, className, label }: { pct: number; className?: string; label?: ReactNode }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={className}>
      {label != null && <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-stone)]"><span>{label}</span><span className="font-medium text-[var(--color-ink)]">{v}%</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-line)]"><div className="kc-bar-enter h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-500" style={{ width: `${v}%` }} /></div>
    </div>
  );
}

/** Empty / onboarding state in a centred card, with an optional CTA. */
export function EmptyState({ title, children, action, className }: { title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Card className={cx('p-8 text-center', className)}>
      <p className="font-medium text-[var(--color-ink)]">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--color-stone)]">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}

// Portal-weight button — plain (no magnetic/sheen), compact. The marketing
// components/ui/Button is intentionally separate (heavier, for hero CTAs).
type BtnVariant = 'primary' | 'secondary' | 'ink';
type BtnSize = 'sm' | 'md';
// Tactile press feedback (subtle scale-down on tap) + colour transitions, matching
// the admin shell's nav links; reduced-motion users get colour only.
const btnBase = 'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[transform,color,background-color,border-color] duration-200 active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-60';
const btnSizes: Record<BtnSize, string> = { sm: 'px-3 py-1.5 text-xs', md: 'px-5 py-2 text-sm' };
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-[var(--color-gold)] text-white hover:bg-[var(--color-ink)]',
  secondary: 'border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]',
  ink: 'bg-[var(--color-ink)] text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]',
};
export function AButton({ children, href, onClick, variant = 'primary', size = 'md', className, external, type = 'button', disabled, ariaLabel }: { children: ReactNode; href?: string; onClick?: () => void; variant?: BtnVariant; size?: BtnSize; className?: string; external?: boolean; type?: 'button' | 'submit'; disabled?: boolean; ariaLabel?: string }) {
  const cls = cx(btnBase, btnSizes[size], btnVariants[variant], className);
  if (href) {
    return external
      ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={cls}>{children}</a>
      : <Link href={href} aria-label={ariaLabel} className={cls}>{children}</Link>;
  }
  return <button type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={cls}>{children}</button>;
}
