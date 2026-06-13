import Link from 'next/link';
import type { ReactNode } from 'react';

// PRJ-63.3 — reusable dashboard widget primitives. View bundles (Admin, Clinician,
// Reception, Developer, Contractor) compose these rather than forking bespoke
// layouts, so every view shares one visual language. Server-safe (no client hooks).
// Interaction is hover/press only — a small lift + shadow on clickable cards
// (BLD-226 slice 2); under prefers-reduced-motion the global reset in globals.css
// collapses every transition to instant, so no motion remains.

// Shared interactive treatment for clickable cards/rows: unified 150ms ease-out
// transition with a gentle hover lift, warmed border, soft shadow, and a press
// settle. Transform/shadow only, so nothing reflows. Matches the nav-link feedback
// established in slice 1.
export const CLICKABLE_CARD =
  'transition-[transform,box-shadow,border-color] duration-150 ease-out ' +
  'hover:-translate-y-0.5 hover:border-[var(--color-stone-soft)] hover:shadow-[var(--shadow-soft)] ' +
  'active:translate-y-0 active:shadow-none';

/** A titled panel. The standard container for a dashboard widget. */
export function DashWidget({
  title,
  eyebrow,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 ${className}`}
    >
      {(title || eyebrow || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow text-[var(--color-stone)]">{eyebrow}</p>}
            {title && <h2 className="font-[family-name:var(--font-display)] text-lg leading-tight">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A single number/metric tile. Optionally a link, optionally with a % trend. */
export function StatTile({
  label,
  value,
  sub,
  href,
  trend,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  href?: string;
  trend?: number;
}) {
  const up = (trend ?? 0) >= 0;
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-[family-name:var(--font-display)] text-3xl tabular-nums text-[var(--color-ink)]">{value}</p>
        {typeof trend === 'number' && (
          <span
            role="img"
            aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(trend)} percent`}
            className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${up ? 'text-[var(--color-jade)]' : 'text-[var(--color-blush)]'}`}
          >
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden className={up ? '' : 'rotate-180'}>
              <path d="M6 2.5 10 9 2 9Z" fill="currentColor" />
            </svg>
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-[var(--color-stone)]">{label}{sub ? ` · ${sub}` : ''}</p>
    </>
  );
  const cls = 'block rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6';
  return href ? (
    <Link href={href} className={`${cls} ${CLICKABLE_CARD}`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export type TimelineItem = {
  id: string;
  /** Short leading label, e.g. a time ("11:45") or a tag. */
  lead?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Right-hand pill/status. */
  trailing?: ReactNode;
  href?: string;
};

/** A vertical list of rows (appointments, arrivals, jobs…) inside a bordered card. */
export function TimelineList({ items, empty }: { items: TimelineItem[]; empty?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      {items.length === 0 && (
        <p className="p-6 text-sm text-[var(--color-stone)]">{empty ?? 'Nothing to show.'}</p>
      )}
      {items.map((it) => {
        const inner = (
          <>
            {it.lead != null && (
              <span className="w-14 shrink-0 font-[family-name:var(--font-display)] text-lg text-[var(--color-gold)]">{it.lead}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{it.title}</p>
              {it.meta != null && <p className="truncate text-xs text-[var(--color-stone)]">{it.meta}</p>}
            </div>
            {it.trailing != null && <span className="shrink-0">{it.trailing}</span>}
          </>
        );
        const rowCls = 'flex items-center gap-4 border-b border-[var(--color-line)] px-5 py-3.5 last:border-0';
        return it.href ? (
          <Link
            key={it.id}
            href={it.href}
            className={`${rowCls} transition-colors duration-150 ease-out hover:bg-[var(--color-bone)] active:bg-[var(--color-sand)]`}
          >
            {inner}
          </Link>
        ) : (
          <div key={it.id} className={rowCls}>{inner}</div>
        );
      })}
    </div>
  );
}

/** A graceful "nothing here / not built yet" placeholder inside a widget. */
export function EmptyWidget({
  icon,
  title,
  hint,
  tone = 'muted',
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  tone?: 'muted' | 'soon';
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 px-6 py-8 text-center">
      {icon && (
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-porcelain)] text-[var(--color-stone)]"
        >
          {icon}
        </span>
      )}
      <p className="font-medium text-[var(--color-ink)]">{title}</p>
      {hint && <p className="max-w-prose text-sm text-[var(--color-stone)]">{hint}</p>}
      {tone === 'soon' && (
        <span className="mt-1 rounded-full bg-[var(--color-porcelain)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">
          Coming soon
        </span>
      )}
    </div>
  );
}
