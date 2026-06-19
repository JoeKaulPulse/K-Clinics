'use client';

import { motion, AnimatePresence, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Form motion kit for the client portal — gives the form pages the same premium
 * entrance + feedback language the dashboard cards carry, while staying fully
 * accessible. Everything routes through `motion/react`, so the portal's global
 * `<MotionConfig reducedMotion="user">` automatically drops the transforms (and
 * keeps opacity) when the visitor prefers reduced motion.
 */

// Fields rise in sequence on mount (not on scroll) so an above-the-fold form
// animates in immediately, mirroring the Reveal/Stagger ease used elsewhere.
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const fieldItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

/** A `<form>` whose `<FormField>` children rise in a soft, staggered sequence. */
export function FormStagger({
  children,
  className,
  onSubmit,
}: {
  children: ReactNode;
  className?: string;
  onSubmit?: (e: React.FormEvent) => void;
}) {
  return (
    <motion.form className={className} onSubmit={onSubmit} variants={container} initial="hidden" animate="show">
      {children}
    </motion.form>
  );
}

/** One staggered row. Pass grid classes to animate a field pair as a single unit. */
export function FormField({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fieldItem}>
      {children}
    </motion.div>
  );
}

/** Staggered container outside a `<form>` (e.g. a card body of controls). */
export function StaggerOnMount({
  children,
  className,
  gap = 0.07,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: 0.04 } } }}
    >
      {children}
    </motion.div>
  );
}

type Tone = 'success' | 'error' | 'info';
const toneStyle: Record<Tone, string> = {
  success: 'bg-[var(--color-jade)]/12 text-[var(--color-jade)]',
  error: 'bg-[var(--color-blush)]/20 text-[var(--color-ink)]',
  info: 'bg-[var(--color-gold)]/12 text-[var(--color-gold-deep)]',
};

/**
 * Animated, screen-reader-announced submit result. Renders nothing when empty;
 * keyed on the message so a changed result re-animates. `aria-live` means the
 * outcome is announced without moving focus.
 */
export function SubmitFeedback({
  message,
  tone = 'info',
  className = '',
}: {
  message: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {message && (
        <motion.p
          key={message}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm ${toneStyle[tone]} ${className}`}
        >
          {tone === 'success' && <CheckMark />}
          {tone === 'error' && <AlertMark />}
          <span>{message}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** Submit button with a press-spring and an inline spinner while pending. */
export function SubmitButton({
  pending,
  disabled,
  children,
  pendingLabel,
  className,
}: {
  pending?: boolean;
  disabled?: boolean;
  children: ReactNode;
  pendingLabel?: ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      type="submit"
      disabled={pending || disabled}
      whileTap={{ scale: 0.97 }}
      className={
        className ??
        'inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-gold)] px-6 py-3 font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)] disabled:opacity-60'
      }
    >
      {pending && <Spinner />}
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
    </motion.button>
  );
}

function Spinner() {
  return (
    <motion.span
      aria-hidden
      className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-white/40 border-t-white"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
    />
  );
}

function CheckMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AlertMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}
