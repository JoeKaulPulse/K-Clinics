'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addCustomQuestion, setCustomQuestionActive, deleteCustomQuestion, moveCustomQuestion } from '@/app/admin/health-forms/actions';

// BLD-190 — manage the EXTRA questions on one health form. Base (code-defined)
// questions are shown read-only by the page; this handles add-on questions only.
export type CustomQ = { id: string; prompt: string; fieldType: string; help: string | null; required: boolean; active: boolean; options: { value: string; label: string }[] | null };

const TYPES: { value: string; label: string }[] = [
  { value: 'text', label: 'Short text' }, { value: 'longtext', label: 'Long text' },
  { value: 'boolean', label: 'Yes / No' }, { value: 'single', label: 'Single choice' },
  { value: 'multi', label: 'Multiple choice' }, { value: 'scale', label: 'Scale (1–10)' }, { value: 'date', label: 'Date' },
];
const typeLabel = (t: string) => TYPES.find((x) => x.value === t)?.label ?? t;
const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

export function HealthFormManager({ formKey, questions }: { formKey: string; questions: CustomQ[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldType, setFieldType] = useState('text');
  const needsOptions = fieldType === 'single' || fieldType === 'multi';

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => { const r = await fn(); if (r.ok) { after?.(); router.refresh(); } else setError(r.error || 'Something went wrong.'); });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    run(() => addCustomQuestion({
      questionnaireKey: formKey,
      prompt: String(fd.get('prompt') || ''),
      fieldType: String(fd.get('fieldType') || 'text'),
      help: String(fd.get('help') || ''),
      required: fd.get('required') === 'on',
      optionsText: String(fd.get('optionsText') || ''),
    }), () => { form.reset(); setFieldType('text'); setOpen(false); });
  }

  return (
    <div className="mt-3">
      {questions.length > 0 ? (
        <ul className="space-y-2">
          {questions.map((q, i) => (
            <li key={q.id} className={`flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2.5 ${q.active ? '' : 'opacity-55'}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{q.prompt}{q.required && <span className="ml-1 text-[var(--color-gold-deep)]">*</span>}</p>
                <p className="mt-0.5 text-xs text-[var(--color-stone)]">{typeLabel(q.fieldType)}{q.options?.length ? ` · ${q.options.map((o) => o.label).join(', ')}` : ''}{q.help ? ` · ${q.help}` : ''}{q.active ? '' : ' · hidden'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs">
                <button type="button" disabled={pending || i === 0} onClick={() => run(() => moveCustomQuestion(q.id, 'up'))} className="rounded px-1.5 py-1 hover:bg-[var(--color-bone)] disabled:opacity-30" title="Move up">↑</button>
                <button type="button" disabled={pending || i === questions.length - 1} onClick={() => run(() => moveCustomQuestion(q.id, 'down'))} className="rounded px-1.5 py-1 hover:bg-[var(--color-bone)] disabled:opacity-30" title="Move down">↓</button>
                <button type="button" disabled={pending} onClick={() => run(() => setCustomQuestionActive(q.id, !q.active))} className="rounded-full border border-[var(--color-line)] px-2 py-1 hover:bg-[var(--color-bone)]">{q.active ? 'Hide' : 'Show'}</button>
                <button type="button" disabled={pending} onClick={() => { if (confirm('Delete this question? Answers already given are kept on file but no longer shown.')) run(() => deleteCustomQuestion(q.id)); }} className="rounded-full px-2 py-1 text-[#b23b3b] hover:bg-[#b23b3b]/10">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-stone)]">No extra questions added to this form yet.</p>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-3 space-y-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 p-3">
          <input name="prompt" placeholder="Question wording (e.g. Have you had this treatment before?)" className={field} maxLength={400} autoFocus />
          <div className="grid gap-2 sm:grid-cols-2">
            <select name="fieldType" value={fieldType} onChange={(e) => setFieldType(e.target.value)} className={field}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input name="help" placeholder="Helper text (optional)" className={field} maxLength={300} />
          </div>
          {needsOptions && (
            <textarea name="optionsText" rows={3} placeholder={'One option per line, e.g.\nYes\nNo\nNot sure'} className={field} />
          )}
          <label className="flex items-center gap-2 text-sm text-[var(--color-stone)]"><input type="checkbox" name="required" /> Required</label>
          {error && <p className="text-xs text-[#b23b3b]">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{pending ? 'Adding…' : 'Add question'}</button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }} className="px-3 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)]">+ Add a question</button>
      )}
    </div>
  );
}
