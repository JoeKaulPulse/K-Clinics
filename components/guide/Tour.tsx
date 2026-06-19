'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type TourStep = { target?: string; title: string; body: string };

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;

// A lightweight guided tour: dims the screen, spotlights the target element and
// shows a tooltip with Back / Next. Targets are matched by [data-tour="…"].
export function Tour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) setI(0); }, [open]);

  const step = steps[i];

  const measure = useCallback(() => {
    if (!step?.target) { setRect(null); return; }
    // A target may exist more than once in the DOM (e.g. the mobile + desktop
    // nav). Pick the one that's actually rendered/visible — a display:none copy
    // returns a 0×0 rect at the top-left, which is the "tiny square" bug.
    const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`));
    const el = els.find((e) => e.getClientRects().length > 0) ?? null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) { setRect(null); return; } // not laid out yet
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // Tell the shell a tour is running so it can reveal collapsed nav sections
  // (their items aren't in the DOM until the group is expanded).
  useEffect(() => { window.dispatchEvent(new CustomEvent('kc-tour', { detail: open })); }, [open]);

  // Re-measure a few times after each step: the target may only appear once a
  // nav group expands and the smooth scroll settles.
  useLayoutEffect(() => {
    if (!open) return;
    let n = 0; let timer: ReturnType<typeof setTimeout>;
    const tick = () => { measure(); if (++n < 10) timer = setTimeout(tick, 90); };
    timer = setTimeout(tick, 30);
    return () => clearTimeout(timer);
  }, [open, i, measure]);
  useEffect(() => {
    if (!open) return;
    const on = () => measure();
    window.addEventListener('resize', on); window.addEventListener('scroll', on, true);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, [open, measure]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1)); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => { if (i < steps.length - 1) setI(i + 1); else onClose(); };

  if (!open || !mounted || !step) return null;

  // Spotlight box (or centered when no target).
  const box = rect ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const placeBelow = !box || box.top + box.height + 180 < vh;
  const tipStyle: React.CSSProperties = box
    ? { position: 'fixed', top: placeBelow ? box.top + box.height + 12 : undefined, bottom: placeBelow ? undefined : vh - box.top + 12, left: Math.max(12, Math.min(box.left, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 332)), width: 320 }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 360 };

  return createPortal(
    <div className="fixed inset-0 z-[200]" aria-live="polite">
      {/* Dimmer with a spotlight hole (4 panels around the target) */}
      {box ? (
        <>
          <div className="fixed inset-x-0 top-0 bg-black/55" style={{ height: Math.max(0, box.top) }} onClick={onClose} />
          <div className="fixed left-0 bg-black/55" style={{ top: box.top, height: box.height, width: Math.max(0, box.left) }} onClick={onClose} />
          <div className="fixed bg-black/55" style={{ top: box.top, height: box.height, left: box.left + box.width, right: 0 }} onClick={onClose} />
          <div className="fixed inset-x-0 bg-black/55" style={{ top: box.top + box.height, bottom: 0 }} onClick={onClose} />
          <div className="pointer-events-none fixed rounded-[12px] ring-2 ring-[var(--color-gold)]" style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: '0 0 0 9999px rgba(0,0,0,0)' }} />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      )}

      {/* Tooltip */}
      <div style={tipStyle} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 shadow-[var(--shadow-lift)]">
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-[var(--color-stone)]">Step {i + 1} of {steps.length}</p>
        <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-stone)]">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={onClose} className="text-xs text-[var(--color-stone)] hover:underline">Skip</button>
          <div className="flex items-center gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">Back</button>}
            <button onClick={next} className="rounded-full bg-[var(--color-ink)] px-5 py-1.5 text-sm text-[var(--color-porcelain)]">{i < steps.length - 1 ? 'Next' : 'Done'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
