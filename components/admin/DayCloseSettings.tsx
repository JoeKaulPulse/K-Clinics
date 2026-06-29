'use client';

import { useState } from 'react';
import type { DayCloseConfig, ChecklistSection } from '@/lib/day-close';

const uid = () => Math.random().toString(36).slice(2, 9);

export function DayCloseSettings({ initial }: { initial: DayCloseConfig }) {
  const [config, setConfig] = useState<DayCloseConfig>(initial);
  const [remindersText, setRemindersText] = useState(initial.reminderOffsetsMin.join(', '));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  function patch(p: Partial<DayCloseConfig>) {
    setConfig((c) => ({ ...c, ...p }));
    setStatus('idle');
  }
  function patchSection(i: number, p: Partial<ChecklistSection>) {
    setConfig((c) => ({ ...c, sections: c.sections.map((s, j) => (j === i ? { ...s, ...p } : s)) }));
    setStatus('idle');
  }

  async function save() {
    setStatus('saving');
    setError('');
    const reminderOffsetsMin = remindersText.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n));
    try {
      const res = await fetch('/api/admin/day-close/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, reminderOffsetsMin }),
      });
      const json = await res.json();
      if (json.ok) { setConfig(json.config); setRemindersText(json.config.reminderOffsetsMin.join(', ')); setStatus('saved'); }
      else { setError(json.error || 'Could not save.'); setStatus('error'); }
    } catch { setError('Network error.'); setStatus('error'); }
  }

  const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

  return (
    <div className="max-w-2xl space-y-8">
      {/* Timing & reminders */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Timing &amp; reminders</h2>
        <p className="mb-4 mt-1 text-sm text-[var(--color-stone)]">Staff are nudged to start the close-down around closing time, so security and equipment checks never get missed.</p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs text-[var(--color-stone)]">Closing time<br />
            <input type="time" value={config.closingTime} onChange={(e) => patch({ closingTime: e.target.value })} className={`${field} mt-1`} />
          </label>
          <label className="text-xs text-[var(--color-stone)]">Remind at (minutes before close, comma-separated)<br />
            <input value={remindersText} onChange={(e) => { setRemindersText(e.target.value); setStatus('idle'); }} placeholder="30, 0" className={`${field} mt-1 w-48`} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={config.cashHandling} onChange={(e) => patch({ cashHandling: e.target.checked })} className="h-4 w-4 accent-[var(--color-gold)]" />
            This site takes cash (show cash-drawer reconciliation)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={config.stockTake} onChange={(e) => patch({ stockTake: e.target.checked })} className="h-4 w-4 accent-[var(--color-gold)]" />
            Include the stock take
          </label>
        </div>
      </section>

      {/* Checklist sections */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl">Closedown tasks</h2>
          <button
            onClick={() => patch({ sections: [...config.sections, { id: uid(), title: 'New section', items: [{ id: uid(), label: 'New task' }] }] })}
            className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-[var(--color-bone)]"
          >+ Add section</button>
        </div>

        {config.sections.map((sec, si) => (
          <div key={sec.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <div className="flex items-start gap-2">
              <input value={sec.title} onChange={(e) => patchSection(si, { title: e.target.value })} className={`${field} flex-1 font-medium`} />
              <button onClick={() => patch({ sections: config.sections.filter((_, j) => j !== si) })} className="px-2 py-2 text-xs text-[var(--color-blush)] hover:underline">Remove</button>
            </div>
            <input value={sec.description || ''} onChange={(e) => patchSection(si, { description: e.target.value })} placeholder="Short description (optional)" className={`${field} mt-2 w-full text-xs`} />

            <ul className="mt-3 space-y-2">
              {sec.items.map((it, ii) => (
                <li key={it.id} className="flex items-center gap-2">
                  <input
                    value={it.label}
                    onChange={(e) => patchSection(si, { items: sec.items.map((x, j) => (j === ii ? { ...x, label: e.target.value } : x)) })}
                    className={`${field} flex-1`}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--color-stone)]">
                    <input
                      type="checkbox"
                      checked={!!it.note}
                      onChange={(e) => patchSection(si, { items: sec.items.map((x, j) => (j === ii ? { ...x, note: e.target.checked } : x)) })}
                      className="h-3.5 w-3.5 accent-[var(--color-gold)]"
                    />
                    note
                  </label>
                  <button onClick={() => patchSection(si, { items: sec.items.filter((_, j) => j !== ii) })} aria-label="Remove item" className="px-1.5 text-xs text-[var(--color-blush)] hover:underline">✕</button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => patchSection(si, { items: [...sec.items, { id: uid(), label: '' }] })}
              className="mt-3 text-xs text-[var(--color-gold-deep)] hover:underline"
            >+ Add task</button>
          </div>
        ))}
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={status === 'saving'} className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-60">
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {status === 'saved' && <span className="text-sm text-[var(--color-jade)]">Saved ✓</span>}
        {status === 'error' && <span className="text-sm text-[var(--color-blush)]">{error}</span>}
      </div>
    </div>
  );
}
