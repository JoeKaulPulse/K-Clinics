'use client';

// BLD-145 — shared micro-components extracted from SessionRunner and
// LiveCompanion (rule-of-three). Pure render — no hooks or side-effects.

export function CheckIcon({ large = false }: { large?: boolean }) {
  const s = large ? 22 : 12;
  return (
    <svg aria-hidden width={s} height={s} viewBox="0 0 12 12" fill="none">
      <path d="M2 6.2 4.8 9 10 3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
