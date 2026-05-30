'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { useRef, type ReactNode, type MouseEvent } from 'react';

type Variant = 'gold' | 'ink' | 'ghost' | 'outline';
type Size = 'md' | 'lg';

const base =
  'group relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-colors duration-500 will-change-transform focus-visible:outline-2';

const sizes: Record<Size, string> = {
  md: 'px-6 py-3 text-[0.95rem]',
  lg: 'px-8 py-4 text-base',
};

const variants: Record<Variant, string> = {
  gold: 'bg-[var(--color-gold)] text-white hover:bg-[var(--color-ink)] shadow-[var(--shadow-gold)]',
  ink: 'bg-[var(--color-ink)] text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]',
  ghost: 'bg-transparent text-current hover:bg-[color-mix(in_oklab,currentColor_8%,transparent)]',
  outline:
    'bg-transparent text-current ring-1 ring-[color-mix(in_oklab,currentColor_28%,transparent)] hover:ring-[var(--color-gold)] hover:text-[var(--color-gold)]',
};

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  className?: string;
  external?: boolean;
  ariaLabel?: string;
  magnetic?: boolean;
};

/** A refined, optionally magnetic button with a sliding sheen on hover. */
export function Button({
  children,
  href,
  onClick,
  variant = 'gold',
  size = 'md',
  className = '',
  external,
  ariaLabel,
  magnetic = true,
}: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);

  const handleMove = (e: MouseEvent) => {
    if (reduce || !magnetic || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * 0.18;
    const y = (e.clientY - (r.top + r.height / 2)) * 0.28;
    ref.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = 'translate(0px, 0px)';
  };

  const inner = (
    <span
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className="inline-flex items-center gap-2 transition-transform duration-500 [transition-timing-function:var(--ease-spring)]"
    >
      {children}
    </span>
  );

  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;

  const content = (
    <>
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span className="absolute -inset-x-2 -inset-y-8 translate-x-[-120%] rotate-12 bg-white/25 blur-md transition-transform duration-700 [transition-timing-function:var(--ease-lux)] group-hover:translate-x-[120%]" />
      </span>
      {inner}
    </>
  );

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={cls}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} aria-label={ariaLabel} className={cls}>
        {content}
      </Link>
    );
  }

  return (
    <motion.button type="button" onClick={onClick} aria-label={ariaLabel} className={cls}>
      {content}
    </motion.button>
  );
}

export function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:translate-x-1 ${className}`}
      aria-hidden
    >
      <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
