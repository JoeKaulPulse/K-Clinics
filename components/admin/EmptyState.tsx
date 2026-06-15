import Link from 'next/link';

// A consistent, on-brand empty state for admin lists and panels. Server-friendly
// (no client JS): a soft icon medallion, a clear title, a one-line hint, and an
// optional primary action. Replaces the bare "No X found." paragraphs so empty
// screens feel intentional rather than broken.
//
// Pass a Lucide-style 16-viewBox path via `icon` (stroked, inherits currentColor),
// or omit it for a default. `action` renders a primary button when provided.
export function EmptyState({
  title,
  hint,
  icon,
  action,
  className = '',
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bone)] text-[var(--color-stone)]">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {icon ?? <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>}
        </svg>
      </span>
      <p className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-[var(--color-stone)]">{hint}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-espresso)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
