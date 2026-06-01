'use client';

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-espresso)]">
      Download / print
    </button>
  );
}
