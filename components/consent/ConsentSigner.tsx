'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

// BLD-138 v2 — the consent experience, rebuilt as a guided three-act flow:
// Read (the wording, beautifully typeset, scroll-aware) → Agree (each
// acknowledgement a tappable card) → Sign (large smoothed-ink canvas with a
// proper signing ceremony). Same API contract as v1 (/api/consent/sign), so
// every existing consent request keeps working.

type Act = 'read' | 'agree' | 'sign' | 'done';

export function ConsentSigner({
  token, title, bodyHtml, acknowledgements, defaultName, kind,
}: {
  token: string; title: string; bodyHtml: string; acknowledgements: string[];
  defaultName: string; kind: string;
}) {
  const reduce = useReducedMotion();
  const [act, setAct] = useState<Act>('read');
  const [name, setName] = useState(defaultName);
  const [ticks, setTicks] = useState<boolean[]>(acknowledgements.map(() => false));
  const [hasSig, setHasSig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [readPct, setReadPct] = useState(0);
  const openedAt = useRef(new Date().toISOString());
  const canvas = useRef<HTMLCanvasElement>(null);
  const article = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const allTicked = ticks.every(Boolean);
  const acts: Act[] = ['read', 'agree', 'sign'];
  const actIdx = acts.indexOf(act === 'done' ? 'sign' : act);

  // Reading progress — the gold thread fills as the client scrolls the wording.
  useEffect(() => {
    if (act !== 'read') return;
    const el = article.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setReadPct(max <= 8 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100)));
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [act]);

  // Signature canvas — DPI-aware with midpoint-smoothed strokes (real-ink feel).
  useEffect(() => {
    if (act !== 'sign') return;
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio; ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#2a2420';
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => {
      drawing.current = true; const p = pos(e); lastPoint.current = p;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current || !lastPoint.current) return;
      const p = pos(e); const l = lastPoint.current;
      // Quadratic through the midpoint — strokes curve naturally instead of jagging.
      const mid = { x: (l.x + p.x) / 2, y: (l.y + p.y) / 2 };
      ctx.quadraticCurveTo(l.x, l.y, mid.x, mid.y);
      ctx.stroke();
      lastPoint.current = p;
      setHasSig(true);
    };
    const up = () => { drawing.current = false; lastPoint.current = null; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [act]);

  function clearSig() {
    const c = canvas.current; const ctx = c?.getContext('2d');
    if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); ctx.beginPath(); setHasSig(false); }
  }

  async function submit() {
    setErr('');
    if (!name.trim()) return setErr('Please type your full name.');
    if (!allTicked) return setErr('Please confirm every statement first.');
    if (!hasSig) return setErr('Please sign in the box.');
    const signatureDataUrl = canvas.current?.toDataURL('image/png') ?? '';
    setBusy(true);
    const res = await fetch('/api/consent/sign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token, signerName: name, acknowledgements: acknowledgements.map((label, i) => ({ label, checked: ticks[i] })),
        signatureDataUrl, openedAt: openedAt.current,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) setAct('done'); else setErr(j.error || 'Could not submit — please try again.');
  }

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } };

  if (act === 'done') {
    return (
      <motion.div {...fade} className="rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-porcelain)] p-10 text-center">
        <motion.span
          aria-hidden
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--color-gold)] text-white"
        >
          <svg width="28" height="28" viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.8 9 10 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </motion.span>
        <p className="mt-5 font-[family-name:var(--font-display)] text-2xl">Thank you, {name.split(/\s+/)[0]}.</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-stone)]">
          {kind === 'photo_opt_out' ? 'Your decision is recorded securely.' : 'Your consent is recorded securely — a tamper-evident copy is sealed to your record.'} You can hand the device back or close this page.
        </p>
      </motion.div>
    );
  }

  return (
    <div>
      {/* Act dots */}
      <ol aria-label="Signing steps" className="mb-6 flex items-center justify-center gap-2">
        {acts.map((a, i) => (
          <li key={a} aria-current={i === actIdx ? 'step' : undefined}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === actIdx ? 'w-8 bg-[var(--color-gold)]' : i < actIdx ? 'w-3 bg-[var(--color-gold)]/50' : 'w-3 bg-[var(--color-line)]'}`} />
        ))}
      </ol>

      <AnimatePresence mode="wait">
        {act === 'read' && (
          <motion.section key="read" {...fade}>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-[var(--color-gold)]">Step 1 · Read</p>
            <h2 className="mt-1 text-center font-[family-name:var(--font-display)] text-2xl">{title}</h2>

            <div className="relative mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
              {/* Gold reading thread */}
              <span aria-hidden className="absolute left-0 top-0 z-10 h-0.5 bg-[var(--color-gold)] transition-[width] duration-200" style={{ width: `${readPct}%` }} />
              <div
                ref={article}
                className="prose-consent max-h-[55dvh] overflow-y-auto p-6 text-sm leading-relaxed text-[var(--color-ink-soft)] [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-lg [&_h2]:text-[var(--color-ink)] [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-[var(--color-ink)]"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            </div>

            <button type="button" onClick={() => setAct('agree')}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3.5 text-base font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)]">
              I’ve read this — continue
            </button>
            <p className="mt-2 text-center text-xs text-[var(--color-stone-soft)]" role="status">{readPct < 100 ? 'Scroll to read it all — the gold line tracks your place.' : 'Read to the end — thank you.'}</p>
          </motion.section>
        )}

        {act === 'agree' && (
          <motion.section key="agree" {...fade}>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-[var(--color-gold)]">Step 2 · Confirm</p>
            <h2 className="mt-1 text-center font-[family-name:var(--font-display)] text-2xl">Tap each statement to confirm</h2>
            <p className="mt-1 text-center text-xs tabular-nums text-[var(--color-stone)]">{ticks.filter(Boolean).length} of {acknowledgements.length} confirmed</p>

            <ul className="mt-5 space-y-2.5">
              {acknowledgements.map((a, i) => {
                const on = ticks[i];
                return (
                  <motion.li key={i}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduce ? 0 : Math.min(i * 0.04, 0.3), duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                    <button
                      type="button" role="checkbox" aria-checked={on}
                      onClick={() => setTicks((p) => p.map((v, j) => (j === i ? !v : v)))}
                      className={`flex w-full items-start gap-3 rounded-[var(--radius-md)] border p-4 text-left text-sm leading-relaxed transition-all duration-200 ${on
                        ? 'border-[var(--color-gold)] bg-[var(--color-bone)]'
                        : 'border-[var(--color-line)] bg-[var(--color-porcelain)] hover:border-[var(--color-gold)]/50'}`}
                    >
                      <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-200 ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)]'}`}>
                        {on && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.8 9 10 3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </span>
                      <span className={on ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}>{a}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>

            <div className="mt-5 flex items-center gap-3">
              <button type="button" onClick={() => setAct('read')} className="min-h-11 rounded-full px-4 py-2 text-sm text-[var(--color-stone)] transition-colors hover:text-[var(--color-ink)]">← Back</button>
              <button type="button" disabled={!allTicked} onClick={() => setAct('sign')}
                className="min-h-12 flex-1 rounded-full bg-[var(--color-ink)] px-6 py-3.5 text-base font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)] disabled:opacity-40">
                Continue to sign
              </button>
            </div>
          </motion.section>
        )}

        {act === 'sign' && (
          <motion.section key="sign" {...fade}>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-[var(--color-gold)]">Step 3 · Sign</p>
            <h2 className="mt-1 text-center font-[family-name:var(--font-display)] text-2xl">{kind === 'photo_opt_out' ? 'Sign to decline' : 'Sign to consent'}</h2>

            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
              <label htmlFor="signer-name" className="block text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-stone)]">Full name</label>
              <input id="signer-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
                className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-3 text-base outline-none transition-colors focus:border-[var(--color-gold)]" />

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-stone)]">Signature</span>
                  {hasSig && <button type="button" onClick={clearSig} className="min-h-9 rounded-full px-3 text-xs text-[var(--color-stone)] transition-colors hover:text-[var(--color-ink)]">Start again</button>}
                </div>
                <div className="relative mt-1.5">
                  <canvas ref={canvas} className="h-44 w-full touch-none rounded-[var(--radius-sm)] border border-dashed border-[var(--color-gold)]/50 bg-white" aria-label="Signature pad — sign with your finger" />
                  {!hasSig && (
                    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[var(--color-stone-soft)]">
                      Sign here with your finger
                    </span>
                  )}
                </div>
              </div>

              {err && <p role="alert" aria-live="assertive" className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/20 px-3 py-2 text-sm">{err}</p>}

              <div className="mt-5 flex items-center gap-3">
                <button type="button" onClick={() => setAct('agree')} className="min-h-11 rounded-full px-4 py-2 text-sm text-[var(--color-stone)] transition-colors hover:text-[var(--color-ink)]">← Back</button>
                <button type="button" onClick={submit} disabled={busy}
                  className="min-h-12 flex-1 rounded-full bg-[var(--color-gold)] px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-[var(--color-ink)] disabled:opacity-50">
                  {busy ? 'Sealing…' : kind === 'photo_opt_out' ? 'Sign & decline photos' : 'Sign & consent'}
                </button>
              </div>
              <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-[var(--color-stone-soft)]">
                Your signature, the time and this device are sealed into a tamper-evident record.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
