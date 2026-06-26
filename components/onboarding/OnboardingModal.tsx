'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export type OnbStep =
  | { type: 'text' | 'textarea' | 'tel' | 'date'; key: string; label: string; help?: string; placeholder?: string }
  | { type: 'select'; key: string; label: string; help?: string; options: { value: string; label: string }[] }
  | { type: 'chips'; key: string; label: string; help?: string; options: string[] }
  | { type: 'toggle'; key: string; label: string; help?: string }
  | { type: 'info'; key: string; label: string; help?: string; ctaLabel?: string; ctaHref?: string };

const field = 'mt-3 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3 text-base';

export function OnboardingModal({ title, intro, steps, initial, endpoint, onClose }: {
  title: string; intro: string; steps: OnbStep[]; initial: Record<string, unknown>; endpoint: string; onClose: (completed: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [vals, setVals] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setVals((p) => ({ ...p, [k]: v }));
  const step = steps[i];
  const last = i === steps.length - 1;

  // BLD-418: dialog accessibility — keep focus inside while open, Esc to close,
  // and restore focus to the trigger on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? []).filter((n) => n.offsetParent !== null);
    const el = dialogRef.current;
    if (el && !el.contains(document.activeElement)) (focusables()[0] ?? el).focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(false); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(); if (f.length === 0) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);

  async function finish() {
    setBusy(true);
    await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vals) }).catch(() => {});
    setBusy(false);
    onClose(true);
  }
  const next = () => (last ? finish() : setI(i + 1));

  return (
    <div onClick={() => onClose(false)} className="fixed inset-0 z-[210] flex items-center justify-center bg-[var(--color-ink)]/80 p-4 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xl overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-lift)] outline-none">
        {/* Progress */}
        <div className="h-1.5 w-full bg-[var(--color-bone)]"><div className="h-full bg-[var(--color-gold)] transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>

        <div className="p-7 md:p-9">
          <button onClick={() => onClose(false)} className="absolute right-4 top-4 text-sm text-[var(--color-stone)] hover:underline">Skip for now</button>
          {i === 0 && <p className="mb-4 text-sm text-[var(--color-stone)]">{intro}</p>}

          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--color-stone)]">{title} · {i + 1}/{steps.length}</p>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight">{step.label}</h2>
              {step.help && <p className="mt-1.5 text-sm text-[var(--color-stone)]">{step.help}</p>}

              <div className="mt-2">
                {(step.type === 'text' || step.type === 'tel' || step.type === 'date') && (
                  <input type={step.type === 'text' ? 'text' : step.type} autoFocus aria-label={step.label} value={(vals[step.key] as string) ?? ''} onChange={(e) => set(step.key, e.target.value)} placeholder={'placeholder' in step ? step.placeholder : ''} className={field} />
                )}
                {step.type === 'textarea' && (
                  <textarea autoFocus aria-label={step.label} rows={4} value={(vals[step.key] as string) ?? ''} onChange={(e) => set(step.key, e.target.value)} placeholder={step.placeholder} className={field} />
                )}
                {step.type === 'select' && (
                  <select aria-label={step.label} value={(vals[step.key] as string) ?? ''} onChange={(e) => set(step.key, e.target.value)} className={field}>
                    <option value="">Choose…</option>
                    {step.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {step.type === 'chips' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.options.map((o) => {
                      const arr = (vals[step.key] as string[]) ?? [];
                      const on = arr.includes(o);
                      return <button key={o} onClick={() => set(step.key, on ? arr.filter((x) => x !== o) : [...arr, o])} className={`rounded-full border px-4 py-2 text-sm ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>{o}</button>;
                    })}
                  </div>
                )}
                {step.type === 'toggle' && (
                  <label className="mt-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 text-sm">
                    <input type="checkbox" checked={Boolean(vals[step.key])} onChange={(e) => set(step.key, e.target.checked)} className="h-5 w-5 accent-[var(--color-gold)]" />
                    Yes, please
                  </label>
                )}
                {step.type === 'info' && step.ctaHref && (
                  <a href={step.ctaHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)]">{step.ctaLabel ?? 'Open'}</a>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => (i > 0 ? setI(i - 1) : onClose(false))} className="text-sm text-[var(--color-stone)] hover:underline">{i > 0 ? 'Back' : 'Later'}</button>
            <button onClick={next} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : last ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
