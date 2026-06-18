'use client';

import { useMemo, useState } from 'react';
import type { GoLiveGroup, GoLiveItem, GoLiveStatus } from '@/lib/go-live';

const BADGE: Record<GoLiveStatus, { label: string; cls: string }> = {
  ready: { label: 'Ready ✓', cls: 'bg-green-100 text-green-800' },
  action: { label: 'Action needed', cls: 'bg-amber-100 text-amber-800' },
  optional: { label: 'Optional', cls: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
};

export function GoLiveChecklist({ groups: initial }: { groups: GoLiveGroup[] }) {
  const [groups, setGroups] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  const [ownerOnly, setOwnerOnly] = useState(false);

  const stats = useMemo(() => {
    const all = groups.flatMap((g) => g.items);
    const crit = all.filter((i) => !i.optional);
    const opt = all.filter((i) => i.optional);
    const owner = all.filter((i) => i.owner && !i.done).length;
    return {
      pct: crit.length ? Math.round((crit.filter((i) => i.done).length / crit.length) * 100) : 100,
      doneCrit: crit.filter((i) => i.done).length,
      totalCrit: crit.length,
      doneOpt: opt.filter((i) => i.done).length,
      totalOpt: opt.length,
      ownerOpen: owner,
    };
  }, [groups]);

  async function toggle(item: GoLiveItem) {
    if (!item.manual || pending) return;
    const next = !item.done;
    setPending(item.id);
    // Optimistic update.
    setGroups((gs) => gs.map((g) => ({ ...g, items: g.items.map((it) => (it.id === item.id ? { ...it, done: next, status: next ? 'ready' : it.optional ? 'optional' : 'action', how: next ? undefined : it.how } : it)) })));
    try {
      const res = await fetch('/api/admin/go-live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, done: next }) });
      const json = await res.json();
      if (!json.ok) throw new Error();
    } catch {
      // Revert on failure.
      setGroups((gs) => gs.map((g) => ({ ...g, items: g.items.map((it) => (it.id === item.id ? item : it)) })));
    } finally {
      setPending(null);
    }
  }

  const visibleGroups = ownerOnly
    ? groups.map((g) => ({ ...g, items: g.items.filter((i) => i.owner) })).filter((g) => g.items.length)
    : groups;

  return (
    <>
      {/* Progress */}
      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-bone)]">
              <div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-500" style={{ width: `${stats.pct}%` }} />
            </div>
          </div>
          <p className="font-[family-name:var(--font-display)] text-2xl tabular-nums">{stats.pct}%</p>
        </div>
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          <strong className="text-[var(--color-ink)]">{stats.doneCrit}/{stats.totalCrit}</strong> launch-critical tasks done
          {' · '}{stats.doneOpt}/{stats.totalOpt} enhancements
          {stats.ownerOpen > 0 && <> · <strong className="text-[var(--color-ink)]">{stats.ownerOpen}</strong> to do with the owner</>}
        </p>
      </div>

      {/* Owner filter for the call */}
      <label className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--color-stone)]">
        <input type="checkbox" checked={ownerOnly} onChange={(e) => setOwnerOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
        Show only tasks to work through with the owner
      </label>

      <div className="mt-6 space-y-8">
        {visibleGroups.map((g) => (
          <section key={g.heading}>
            <h2 className="font-[family-name:var(--font-display)] text-xl">{g.heading}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-stone)]">{g.intro}</p>
            <div className="mt-3 space-y-3">
              {g.items.map((it) => (
                <div key={it.id} className={`rounded-[var(--radius-lg)] border p-5 ${it.done ? 'border-[var(--color-jade)]/30 bg-[var(--color-bone)]/60' : 'border-[var(--color-line)] bg-[var(--color-porcelain)]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {it.manual ? (
                        <button
                          onClick={() => toggle(it)}
                          disabled={pending === it.id}
                          aria-label={it.done ? 'Mark not done' : 'Mark done'}
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition-colors ${it.done ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-stone-soft)] hover:border-[var(--color-gold)]'}`}
                        >
                          {it.done && <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </button>
                      ) : (
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${it.done ? 'bg-[var(--color-jade)]' : 'bg-amber-400'}`} />
                      )}
                      <div>
                        <h3 className="font-medium">
                          {it.title}
                          {it.owner && <span className="ml-2 rounded-full bg-[var(--color-gold-soft)]/30 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-[var(--color-gold-deep)]">with owner</span>}
                          {it.manual && <span className="ml-1.5 rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-[var(--color-stone)]">manual</span>}
                        </h3>
                        <p className="mt-0.5 text-sm text-[var(--color-stone)]">{it.what}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${BADGE[it.status].cls}`}>{BADGE[it.status].label}</span>
                  </div>
                  {it.how && !it.done && (
                    <ol className="mt-3 ml-8 list-decimal space-y-1 text-sm text-[var(--color-stone)]">
                      {it.how.map((h, j) => <li key={j}>{h}</li>)}
                    </ol>
                  )}
                  {it.links && it.links.length > 0 && (
                    <div className="mt-3 ml-8 flex flex-wrap gap-2">
                      {it.links.map((l, j) => (
                        <a
                          key={j}
                          href={l.href}
                          {...(l.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-gold)] hover:bg-[var(--color-bone)]"
                        >
                          {l.label}
                          <span aria-hidden className="text-[var(--color-stone)]">{l.external ? '↗' : '→'}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
