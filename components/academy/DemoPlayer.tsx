'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, Pill, AButton } from '@/components/academy/ui';

// BLD-539: "spot the mistake" player. The learner watches and presses SPACE when
// they think they see a mistake; presses (seconds) are graded server-side.
export type DemoPlay = { id: string; title: string; description: string | null; videoUrl: string; durationSec: number | null; mistakeCount: number; best: number | null };
type Result = { ok: boolean; error?: string; spotted?: number; total?: number; falsePositives?: number; scorePct?: number; mistakes?: { atSec: number; label: string; caught: boolean }[] };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function DemoPlayer({ demo }: { demo: DemoPlay }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pressesRef = useRef<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [flags, setFlags] = useState<number[]>([]);
  const [flash, setFlash] = useState(false);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const flag = () => {
    const v = videoRef.current;
    if (!v || finished || result || v.paused) return;
    const t = Math.round(v.currentTime * 100) / 100;
    const last = pressesRef.current[pressesRef.current.length - 1];
    if (last != null && Math.abs(t - last) < 0.4) return; // debounce double-taps
    pressesRef.current.push(t);
    setFlags((f) => [...f, t]);
    setFlash(true); setTimeout(() => setFlash(false), 220);
  };

  // Spacebar → flag (capture globally; stop it scrolling/toggling controls).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      e.preventDefault();
      flag();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, result]);

  function toggle() {
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }

  async function finish() {
    const v = videoRef.current; if (v) v.pause();
    setFinished(true); setBusy(true);
    const r = await fetch('/api/academy/demos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'grade', videoId: demo.id, presses: pressesRef.current }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) setResult(r); else { alert(r.error || 'Could not score.'); setFinished(false); }
  }

  function again() {
    pressesRef.current = []; setFlags([]); setResult(null); setFinished(false);
    const v = videoRef.current; if (v) { v.currentTime = 0; }
  }

  return (
    <Card tone="white">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">{demo.title}</h1>
          {demo.description && <p className="mt-1 text-sm text-[var(--color-stone)]">{demo.description}</p>}
        </div>
        {demo.best != null && <Pill tone={demo.best === 100 ? 'good' : 'neutral'}>Best {demo.best}%</Pill>}
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} src={demo.videoUrl} playsInline onClick={() => !result && toggle()} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); if (!finished && !result) finish(); }} className="block max-h-[60vh] w-full" />
        {flash && <div className="pointer-events-none absolute inset-0 ring-4 ring-[var(--color-gold)] ring-inset" />}
        {!playing && !result && (
          <button onClick={toggle} className="absolute inset-0 grid place-items-center bg-black/30 text-white">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-2xl text-[var(--color-ink)]">▶</span>
          </button>
        )}
      </div>

      {!result ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AButton onClick={toggle} size="sm" variant="secondary">{playing ? 'Pause' : 'Play'}</AButton>
          <button onClick={flag} disabled={!playing} className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-semibold text-[var(--color-porcelain)] disabled:opacity-40">Flag a mistake — press SPACE</button>
          <span className="text-sm text-[var(--color-stone)]">{flags.length} flag{flags.length === 1 ? '' : 's'}</span>
          <AButton onClick={finish} size="sm" disabled={busy || finished}>{busy ? 'Scoring…' : 'Finish & score'}</AButton>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-lg font-semibold ${result.scorePct === 100 ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-ink)]'}`}>{result.scorePct === 100 ? '🎯 Perfect!' : `Score ${result.scorePct}%`}</span>
            <span className="text-sm text-[var(--color-stone)]">Spotted {result.spotted}/{result.total}{result.falsePositives ? ` · ${result.falsePositives} false flag${result.falsePositives === 1 ? '' : 's'}` : ''}</span>
            <AButton onClick={again} size="sm" variant="secondary">Watch again</AButton>
          </div>
          <ul className="space-y-1.5">
            {result.mistakes?.map((m, i) => (
              <li key={i} className={`flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${m.caught ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : 'border-[var(--color-blush)] bg-[var(--color-blush)]/5'}`}>
                <span className={m.caught ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-blush-deep)]'}>{m.caught ? '✓' : '✗'}</span>
                <span className="font-mono text-xs text-[var(--color-stone)]">{mmss(m.atSec)}</span>
                <span className="flex-1 text-[var(--color-ink-soft)]">{m.label}</span>
                {!m.caught && <button onClick={() => { const v = videoRef.current; if (v) { setResult(null); setFinished(false); pressesRef.current = []; setFlags([]); v.currentTime = Math.max(0, m.atSec - 2); v.play().catch(() => {}); } }} className="text-xs text-[var(--color-gold-deep)] hover:underline">replay</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!result && <p className="mt-2 text-xs text-[var(--color-stone)]">Watch the walkthrough and press <kbd className="rounded border border-[var(--color-line)] px-1">Space</kbd> the moment you spot something done wrong. Finish to see how many you caught.</p>}
    </Card>
  );
}
