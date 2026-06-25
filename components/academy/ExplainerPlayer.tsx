'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KSpeech } from '@/components/academy/KMascot';
import { Illustration, matchIllustration } from '@/components/academy/Illustrations';
import { AmbientBackdrop } from '@/components/academy/AmbientBackdrop';

// A short animated "video" explainer generated on the fly from a lesson's own
// points — the K narrates each beat (typed speech) over a matched illustration,
// auto-advancing like a reel. No file rendering or storage: it's assembled and
// played in-browser at the click of a button.

type Scene = { kind: 'title' } | { kind: 'point'; text: string } | { kind: 'end' };

export function ExplainerPlayer({ title, level, points, onClose, onStart }: { title: string; level?: string | null; points: string[]; onClose: () => void; onStart?: () => void }) {
  const scenes = useMemo<Scene[]>(() => [{ kind: 'title' }, ...points.slice(0, 6).map((p) => ({ kind: 'point' as const, text: p })), { kind: 'end' }], [points]);
  const [i, setI] = useState(0);
  const cur = scenes[i];
  const last = i >= scenes.length - 1;

  useEffect(() => {
    if (last) return;
    const t = setTimeout(() => setI((x) => x + 1), cur.kind === 'title' ? 4200 : 5400);
    return () => clearTimeout(t);
  }, [i, last, cur.kind]);
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);

  const art = cur.kind === 'point' ? matchIllustration(cur.text) : null;

  return (
    <div className="fixed inset-0 z-[320] flex flex-col bg-[var(--color-ink)] text-[var(--color-porcelain)]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }} role="button" tabIndex={0} aria-label={last ? 'Explainer complete' : 'Tap to advance'} onClick={() => !last && setI((x) => x + 1)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !last) { e.preventDefault(); setI((x) => x + 1); } }}>
      <AmbientBackdrop tone="dark" />
      <header className="relative z-10 flex items-center justify-between px-5 py-3">
        <span className="text-xs uppercase tracking-[0.18em] text-white/45">60-second explainer</span>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close explainer" className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="m3 3 10 10M13 3 3 13" /></svg>
        </button>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="w-full">
            {cur.kind === 'title' && (
              <>
                {level && <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold)]">{level}</p>}
                <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight sm:text-4xl">{title}</h1>
                <div className="mt-9"><KSpeech text="Here’s the quick version — then we’ll dive in properly." mood="happy" /></div>
              </>
            )}
            {cur.kind === 'point' && (
              <>
                {art && <div className="mx-auto mb-6 max-w-xs"><Illustration name={art} /></div>}
                <KSpeech text={cur.text} mood="think" />
              </>
            )}
            {cur.kind === 'end' && (
              <>
                <KSpeech text="That’s the gist. Ready to learn it properly?" mood="cheer" />
                <button onClick={(e) => { e.stopPropagation(); (onStart ?? onClose)(); }} className="mt-9 rounded-full bg-[var(--color-gold)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] transition-transform hover:scale-[1.02]">Start the lesson →</button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex justify-center gap-1.5 pb-6">
        {scenes.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? 'w-6 bg-[var(--color-gold)]' : 'w-1.5 bg-white/25'}`} />)}
      </div>
    </div>
  );
}
