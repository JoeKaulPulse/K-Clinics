'use client';

import { useEffect, useRef, useState } from 'react';

// Reads the consent, requires every acknowledgement to be ticked, captures a
// drawn signature + full name, then submits. The exact wording shown is what
// gets recorded server-side.
export function ConsentSigner({ token, title, bodyHtml, acknowledgements, defaultName, kind }: { token: string; title: string; bodyHtml: string; acknowledgements: string[]; defaultName: string; kind: string }) {
  const [name, setName] = useState(defaultName);
  const [ticks, setTicks] = useState<boolean[]>(acknowledgements.map(() => false));
  const [hasSig, setHasSig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const openedAt = useRef(new Date().toISOString());
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio; ctx.scale(ratio, ratio);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#2a2420';
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => { drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); c.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!drawing.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSig(true); };
    const up = () => { drawing.current = false; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  function clearSig() { const c = canvas.current; const ctx = c?.getContext('2d'); if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); setHasSig(false); } }

  async function submit() {
    setErr('');
    if (!name.trim()) return setErr('Please type your full name.');
    if (ticks.some((t) => !t)) return setErr('Please tick every box to confirm.');
    if (!hasSig) return setErr('Please sign in the box.');
    const signatureDataUrl = canvas.current?.toDataURL('image/png') ?? '';
    setBusy(true);
    const res = await fetch('/api/consent/sign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, signerName: name, acknowledgements: acknowledgements.map((label, i) => ({ label, checked: ticks[i] })), signatureDataUrl, openedAt: openedAt.current }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) setDone(true); else setErr(j.error || 'Could not submit — please try again.');
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center">
        <p className="font-[family-name:var(--font-display)] text-xl">Thank you — signed ✓</p>
        <p className="mt-2 text-sm text-[var(--color-stone)]">A secure copy has been recorded. You can hand the device back / close this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <article className="prose-consent rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-sm leading-relaxed text-[var(--color-ink)] [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-gold)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--color-stone)] [&_h2]:mt-0 [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-xl [&_h3]:mt-4 [&_h3]:font-[family-name:var(--font-display)] [&_h3]:text-lg [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <div className="space-y-2">
          {acknowledgements.map((a, i) => (
            <label key={i} className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={ticks[i]} onChange={(e) => setTicks((p) => p.map((v, j) => (j === i ? e.target.checked : v)))} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-gold)]" />
              <span>{a}</span>
            </label>
          ))}
        </div>

        <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)]">Full name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2.5 text-base" />
        </label>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-soft)]">Signature</span>
            <button type="button" onClick={clearSig} className="text-xs text-[var(--color-stone)] hover:underline">Clear</button>
          </div>
          <canvas ref={canvas} className="mt-1 h-40 w-full touch-none rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] bg-white" />
        </div>

        {err && <p className="mt-3 text-sm text-[var(--color-blush)]">{err}</p>}
        <button onClick={submit} disabled={busy} className="mt-4 w-full rounded-full bg-[var(--color-ink)] px-6 py-3.5 text-base font-medium text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Submitting…' : kind === 'photo_opt_out' ? 'Sign & decline photo' : 'Sign & consent'}</button>
        <p className="mt-2 text-center text-[0.7rem] text-[var(--color-stone-soft)]">Your signature, the time and this device are recorded securely as proof of consent.</p>
      </div>
    </div>
  );
}
