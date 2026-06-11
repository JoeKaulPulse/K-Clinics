'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publishCoreQuestions } from '@/app/admin/health-forms/actions';

export type CoreQ = { id: string; prompt: string; required?: boolean; type: string; options?: { value: string; label: string }[]; help?: string; showIf?: unknown };

// BLD-209 — edit the core questions of a health form. Editing the wording,
// removing or reordering questions and publishing creates a NEW version; past
// completed forms keep the version (and wording) they were captured under.
export function CoreQuestionEditor({ formKey, version, questions }: { formKey: string; version: number; questions: CoreQ[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<CoreQ[]>(questions);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const edit = (i: number, patch: Partial<CoreQ>) => setList((l) => l.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const remove = (i: number) => setList((l) => l.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => setList((l) => { const j = i + d; if (j < 0 || j >= l.length) return l; const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const reset = () => { setList(questions); setMsg(null); };

  function publish() {
    setMsg(null);
    if (list.some((q) => !q.prompt.trim())) { setMsg('Every question needs wording (or remove it).'); return; }
    if (!confirm(`Publish a new version of this form? It becomes the live form immediately; previously completed forms keep their current wording.`)) return;
    start(async () => {
      const r = await publishCoreQuestions({ questionnaireKey: formKey, questions: list });
      if (r.ok) { setMsg(`Published v${r.version}.`); setOpen(false); router.refresh(); }
      else setMsg(r.error || 'Could not publish.');
    });
  }

  if (!open) {
    return (
      <div className="mt-3">
        <button onClick={() => { setList(questions); setOpen(true); }} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-[var(--color-bone)]">Edit core questions</button>
        {msg && <span className="ml-2 text-xs text-[var(--color-stone)]">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)]/40 p-4">
      <p className="text-xs text-[var(--color-stone)]">Editing core questions (currently v{version}). Publishing creates a new version and updates the live form; <strong>previously completed forms keep their original wording</strong> for audit.</p>
      <ol className="mt-3 space-y-2">
        {list.map((q, i) => (
          <li key={q.id} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2 text-xs tabular-nums text-[var(--color-stone-soft)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <textarea value={q.prompt} onChange={(e) => edit(i, { prompt: e.target.value })} rows={2} className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]" />
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--color-stone)]">
                  <span className="rounded-full bg-[var(--color-bone)] px-2 py-0.5">{q.type}</span>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={!!q.required} onChange={(e) => edit(i, { required: e.target.checked })} /> required</label>
                  {q.showIf ? <span className="text-[var(--color-stone-soft)]">conditional</span> : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-[var(--color-line)] px-1.5 text-xs disabled:opacity-30" aria-label="Move up">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="rounded border border-[var(--color-line)] px-1.5 text-xs disabled:opacity-30" aria-label="Move down">↓</button>
                <button onClick={() => remove(i)} className="rounded border border-[var(--color-line)] px-1.5 text-xs text-[var(--color-blush-deep)]" aria-label="Remove">✕</button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {msg && <p className="mt-2 text-sm text-[var(--color-stone)]">{msg}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button onClick={publish} disabled={pending} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{pending ? 'Publishing…' : 'Publish new version'}</button>
        <button onClick={reset} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">Reset</button>
        <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">Cancel</button>
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-stone-soft)]">To add brand-new questions, use “Your extra questions” below. Conditional/branching logic is preserved from the current version.</p>
    </div>
  );
}
