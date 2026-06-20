'use client';

import { useRef, useState } from 'react';
import { Card, Pill, AButton } from '@/components/academy/ui';

// BLD-535: learner-facing interactive exercises (hotspots / match / order).
export type ExercisePlay = {
  id: string; title: string; type: string; instructions: string | null; imageUrl: string | null;
  labels?: string[]; lefts?: string[]; rights?: string[]; items?: string[]; count: number; best: number | null;
};
type Grade = { ok: boolean; error?: string; scorePct?: number; correct?: number; total?: number; results?: boolean[]; reveal?: unknown };

async function grade(exerciseId: string, answer: unknown): Promise<Grade> {
  const r = await fetch('/api/academy/exercises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'grade', exerciseId, answer }) });
  return r.json().catch(() => ({ ok: false, error: 'Network error.' }));
}

export function ExercisePlayer({ exercise }: { exercise: ExercisePlay }) {
  const [result, setResult] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0); // reset children on retry

  const onGrade = async (answer: unknown) => { setBusy(true); const g = await grade(exercise.id, answer); setBusy(false); setResult(g.ok ? g : null); if (!g.ok) alert(g.error || 'Could not grade.'); };
  const retry = () => { setResult(null); setNonce((n) => n + 1); };

  return (
    <Card tone="white">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg">{exercise.title}</h3>
          {exercise.instructions && <p className="mt-0.5 text-sm text-[var(--color-stone)]">{exercise.instructions}</p>}
        </div>
        {exercise.best != null && <Pill tone={exercise.best === 100 ? 'good' : 'neutral'}>Best {exercise.best}%</Pill>}
      </div>

      <div className="mt-4">
        {exercise.type === 'HOTSPOT' && <Hotspot key={nonce} exercise={exercise} result={result} busy={busy} onGrade={onGrade} />}
        {exercise.type === 'MATCH' && <Match key={nonce} exercise={exercise} result={result} busy={busy} onGrade={onGrade} />}
        {exercise.type === 'ORDER' && <Order key={nonce} exercise={exercise} result={result} busy={busy} onGrade={onGrade} />}
      </div>

      {result && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-4">
          <span className={`text-sm font-medium ${result.scorePct === 100 ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-ink)]'}`}>
            {result.scorePct === 100 ? '🎉 Perfect!' : `You got ${result.correct} of ${result.total} right (${result.scorePct}%).`}
          </span>
          <AButton size="sm" variant="secondary" onClick={retry}>Try again</AButton>
        </div>
      )}
    </Card>
  );
}

type SubProps = { exercise: ExercisePlay; result: Grade | null; busy: boolean; onGrade: (answer: unknown) => void };

// ── HOTSPOT ──────────────────────────────────────────────────────────────────
function Hotspot({ exercise, result, busy, onGrade }: SubProps) {
  const labels = exercise.labels ?? [];
  const [active, setActive] = useState(0);
  const [pins, setPins] = useState<Record<number, { x: number; y: number }>>({});
  const reveal = (result?.reveal as { label: string; x: number; y: number; r: number }[] | undefined) ?? null;
  const imgRef = useRef<HTMLDivElement>(null);

  function place(e: React.MouseEvent) {
    if (result || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const updated = { ...pins, [active]: { x, y } };
    setPins(updated);
    // Auto-advance to the next label that still needs a pin.
    const next = labels.findIndex((_, i) => !(i in updated));
    if (next >= 0) setActive(next);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {labels.map((l, i) => (
          <button key={i} onClick={() => !result && setActive(i)} disabled={!!result}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${result ? (result.results?.[i] ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-gold-deep)]' : 'border-[var(--color-blush)] bg-[var(--color-blush)]/10 text-[var(--color-blush)]') : i === active ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : pins[i] ? 'border-[var(--color-gold)] text-[var(--color-ink)]' : 'border-[var(--color-line)] text-[var(--color-stone)]'}`}>
            {pins[i] && !result ? '✓ ' : ''}{result ? (result.results?.[i] ? '✓ ' : '✗ ') : ''}{l}
          </button>
        ))}
      </div>
      <div ref={imgRef} onClick={place} className={`relative w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] ${result ? '' : 'cursor-crosshair'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {exercise.imageUrl ? <img src={exercise.imageUrl} alt={exercise.title} className="block w-full select-none" draggable={false} /> : <div className="grid h-48 place-items-center text-sm text-[var(--color-stone)]">No image</div>}
        {/* learner pins */}
        {Object.entries(pins).map(([i, p]) => (
          <span key={i} style={{ left: `${p.x}%`, top: `${p.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-[0.6rem] font-bold text-white ${result ? (result.results?.[Number(i)] ? 'bg-[var(--color-gold-deep)]' : 'bg-[var(--color-blush)]') : 'bg-[var(--color-ink)]'}`}>{Number(i) + 1}</span>
        ))}
        {/* reveal correct targets after grading */}
        {reveal?.map((s, i) => (
          <span key={`r${i}`} style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.r * 2}%`, paddingBottom: `${s.r * 2}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-[var(--color-gold-deep)]/70" />
        ))}
      </div>
      {!result && <div className="mt-3"><AButton size="sm" disabled={busy || Object.keys(pins).length < labels.length} onClick={() => onGrade(pins)}>{busy ? 'Checking…' : 'Check answers'}</AButton></div>}
      {!result && <p className="mt-1.5 text-xs text-[var(--color-stone)]">Pick a label, then click its location on the image. Place all {labels.length} to check.</p>}
    </div>
  );
}

// ── MATCH ────────────────────────────────────────────────────────────────────
function Match({ exercise, result, busy, onGrade }: SubProps) {
  const lefts = exercise.lefts ?? [];
  const rights = exercise.rights ?? [];
  const [sel, setSel] = useState<number | null>(null);
  const [pairs, setPairs] = useState<Record<number, string>>({}); // leftIndex -> right text
  const usedRights = new Set(Object.values(pairs));

  function assign(right: string) {
    if (result || sel == null) return;
    setPairs((p) => { const next = { ...p }; for (const k of Object.keys(next)) if (next[Number(k)] === right) delete next[Number(k)]; next[sel] = right; return next; });
    setSel(null);
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ul className="space-y-2">
          {lefts.map((l, i) => (
            <li key={i}>
              <button onClick={() => !result && setSel(i)} disabled={!!result}
                className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-left text-sm ${result ? (result.results?.[i] ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : 'border-[var(--color-blush)] bg-[var(--color-blush)]/10') : sel === i ? 'border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]' : 'border-[var(--color-line)]'}`}>
                <span>{l}</span>
                <span className="text-xs text-[var(--color-stone)]">{pairs[i] ? `→ ${pairs[i]}` : result ? '' : '(pick)'}</span>
              </button>
              {result && !result.results?.[i] && <p className="mt-0.5 pl-1 text-xs text-[var(--color-gold-deep)]">Correct: {(result.reveal as { left: string; right: string }[])?.[i]?.right}</p>}
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap content-start gap-2">
          {rights.map((r, i) => (
            <li key={i}>
              <button onClick={() => assign(r)} disabled={!!result || sel == null}
                className={`rounded-full border px-3 py-1.5 text-sm ${usedRights.has(r) ? 'border-[var(--color-line)] bg-[var(--color-bone)] text-[var(--color-stone)]' : 'border-[var(--color-line)] hover:border-[var(--color-gold)]'} disabled:opacity-60`}>
                {r}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {!result && <div className="mt-3"><AButton size="sm" disabled={busy || Object.keys(pairs).length < lefts.length} onClick={() => onGrade(pairs)}>{busy ? 'Checking…' : 'Check answers'}</AButton></div>}
      {!result && <p className="mt-1.5 text-xs text-[var(--color-stone)]">Tap an item on the left, then tap its match on the right.</p>}
    </div>
  );
}

// ── ORDER ────────────────────────────────────────────────────────────────────
function Order({ exercise, result, busy, onGrade }: SubProps) {
  const [items, setItems] = useState<string[]>(exercise.items ?? []);
  const dragFrom = useRef<number | null>(null);
  const move = (i: number, d: number) => { const j = i + d; if (result || j < 0 || j >= items.length) return; setItems((a) => { const b = [...a]; [b[i], b[j]] = [b[j], b[i]]; return b; }); };
  const drop = (to: number) => { const from = dragFrom.current; dragFrom.current = null; if (result || from == null || from === to) return; setItems((a) => { const b = [...a]; const [m] = b.splice(from, 1); b.splice(to, 0, m); return b; }); };

  return (
    <div>
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={it + i} draggable={!result} onDragStart={() => (dragFrom.current = i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)}
            className={`flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${result ? (result.results?.[i] ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : 'border-[var(--color-blush)] bg-[var(--color-blush)]/10') : 'border-[var(--color-line)] bg-white'}`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-xs text-[var(--color-porcelain)]">{i + 1}</span>
            <span className="flex-1">{it}{result && !result.results?.[i] && <span className="ml-2 text-xs text-[var(--color-gold-deep)]">should be: {(result.reveal as string[])?.[i]}</span>}</span>
            {!result && (
              <span className="flex shrink-0 gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-[var(--color-line)] px-2 text-xs disabled:opacity-30">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded border border-[var(--color-line)] px-2 text-xs disabled:opacity-30">↓</button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!result && <div className="mt-3"><AButton size="sm" disabled={busy} onClick={() => onGrade(items)}>{busy ? 'Checking…' : 'Check order'}</AButton></div>}
      {!result && <p className="mt-1.5 text-xs text-[var(--color-stone)]">Drag the steps, or use the arrows, into the correct order.</p>}
    </div>
  );
}
