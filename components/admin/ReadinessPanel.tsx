import type { ReadyItem } from '@/lib/readiness';

const ICON: Record<string, string> = { ok: '✓', needed: '!', na: '–' };
const CLS: Record<string, string> = {
  ok: 'bg-[var(--color-jade)]/15 text-[var(--color-ink)]',
  needed: 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]',
  na: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
};

// Proactive pre-treatment checklist. Green when ready; amber items must be
// cleared before the appointment can be started.
export function ReadinessPanel({ items, ready, neededCount, started }: { items: ReadyItem[]; ready: boolean; neededCount: number; started: boolean }) {
  return (
    <div className={`rounded-[var(--radius-lg)] border p-4 ${started ? 'border-[var(--color-line)] bg-[var(--color-porcelain)]' : ready ? 'border-[var(--color-jade)]/40 bg-[var(--color-jade)]/8' : 'border-[var(--color-gold)]/40 bg-[var(--color-gold)]/8'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Pre-treatment checklist</h2>
        <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${started ? 'bg-[var(--color-bone)] text-[var(--color-stone)]' : ready ? 'bg-[var(--color-jade)]/20 text-[var(--color-ink)]' : 'bg-[var(--color-gold)]/25 text-[var(--color-ink)]'}`}>
          {started ? 'In progress' : ready ? 'Ready to treat' : `${neededCount} to do`}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((it) => (
          <li key={it.key} className="flex items-start gap-2.5 text-sm">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] font-bold ${CLS[it.status]}`}>{ICON[it.status]}</span>
            <span className={it.status === 'na' ? 'text-[var(--color-stone)]' : 'text-[var(--color-ink)]'}>
              {it.label}
              {it.status === 'needed' && it.detail && <span className="block text-xs font-normal text-[var(--color-gold-deep)]">{it.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
