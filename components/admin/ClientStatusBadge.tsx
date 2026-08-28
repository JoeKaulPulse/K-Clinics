// BLD-1532: shared traffic-light badge for a client's status. Green is the
// default/unmarked state and renders nothing — no visual noise — so this only
// ever shows for YELLOW (caution) or RED (blocked). Pure/presentational (no
// 'use client'), so it renders fine from server components (client profile,
// calendar, booking picker).
type Status = 'GREEN' | 'YELLOW' | 'RED' | null | undefined;

const STYLE: Record<'YELLOW' | 'RED', { label: string; classes: string }> = {
  YELLOW: { label: 'Caution', classes: 'border-amber-500 bg-amber-100 text-amber-800' },
  RED: { label: 'Blocked', classes: 'border-[var(--color-blush-deep)] bg-[var(--color-blush)]/25 text-[var(--color-blush-deep)]' },
};

export function ClientStatusBadge({ status, className = '' }: { status: Status; className?: string }) {
  if (status !== 'YELLOW' && status !== 'RED') return null;
  const s = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${s.classes} ${className}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status === 'RED' ? 'bg-[var(--color-blush-deep)]' : 'bg-amber-500'}`} />
      {s.label}
    </span>
  );
}

/** A minimal dot-only variant for tight spaces (calendar blocks). Green =
 *  nothing rendered, matching the badge above. */
export function ClientStatusDot({ status, className = '' }: { status: Status; className?: string }) {
  if (status !== 'YELLOW' && status !== 'RED') return null;
  return (
    <span
      aria-hidden
      title={status === 'RED' ? 'Client status: Blocked' : 'Client status: Caution'}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${status === 'RED' ? 'bg-[var(--color-blush-deep)]' : 'bg-amber-500'} ${className}`}
    />
  );
}
