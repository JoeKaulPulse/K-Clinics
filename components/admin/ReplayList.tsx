'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';

export type ReplayRow = { id: string; path: string; device: string | null; durationMs: number; eventCount: number; startedAt: string };

export function ReplayList({ rows }: { rows: ReplayRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Session replays</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-stone)]">No replays captured yet.</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)]">
          <table className="w-full text-sm">
            <thead><tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th scope="col" className="p-2">When</th><th scope="col" className="p-2">Entry</th><th scope="col" className="p-2">Device</th><th scope="col" className="p-2">Length</th><th scope="col" className="p-2"></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-line)]">
                  <td className="p-2">{new Date(r.startedAt).toLocaleString('en-GB')}</td>
                  <td className="p-2 font-mono text-xs">{r.path}</td>
                  <td className="p-2">{r.device ?? '—'}</td>
                  <td className="p-2 tabular-nums">{Math.round(r.durationMs / 1000)}s · {r.eventCount} ev</td>
                  <td className="p-2 text-right"><button onClick={() => setOpenId(r.id)} disabled={r.eventCount < 2} className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs text-[var(--color-porcelain)] disabled:opacity-40">Play</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId && <ReplayModal id={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function ReplayModal({ id, onClose }: { id: string; onClose: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(0);
  const replayerRef = useRef<{ play: (t?: number) => void; pause: (t?: number) => void; getMetaData: () => { startTime: number; totalTime: number }; on: (event: string, handler: (d: unknown) => void) => void; destroy?: () => void } | null>(null);

  useEffect(() => {
    let destroyed = false;
    let tickTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const res = await fetch(`/api/admin/marketing/replay?id=${id}`);
        const j = await res.json();
        if (destroyed) return;
        const events = j?.events ?? [];
        if (events.length < 2) { setStatus('error'); setErrMsg('Not enough data to replay.'); return; }

        // Use rrweb Replayer directly. rrweb-player v2.0.1 has a build bug where
        // the Svelte runtime is missing onMount, so the internal Replayer is never
        // instantiated. Using rrweb's Replayer directly avoids that entirely.
        const { Replayer } = await import('rrweb');
        if (destroyed || !mount.current) return;

        mount.current.innerHTML = '';
        const replayer = new Replayer(events, {
          root: mount.current,
          skipInactive: true,
          speed: 1,
          showWarning: false,
          showDebug: false,
        });
        replayerRef.current = replayer as typeof replayerRef.current;

        const meta = replayer.getMetaData();
        setTotal(meta.totalTime);

        replayer.on('finish', () => {
          setPlaying(false);
          if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        });

        replayer.on('state-change', (data: unknown) => {
          const d = data as { player?: { state?: { matches: (s: string) => boolean } } };
          const isPlaying = d?.player?.state?.matches('playing') ?? false;
          setPlaying(isPlaying);
          if (isPlaying) {
            if (!tickTimer) {
              tickTimer = setInterval(() => {
                const m = replayer.getMetaData();
                const ctx = (replayer as unknown as { service: { state: { context: { timer: { timeOffset: number } } } } }).service?.state?.context;
                setElapsed(ctx?.timer?.timeOffset ?? 0);
                setTotal(m.totalTime);
              }, 500);
            }
          } else {
            if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
          }
        });

        setStatus('ready');
        replayer.play();
        setPlaying(true);
      } catch (e) {
        if (!destroyed) { setStatus('error'); setErrMsg('Could not load this replay.'); console.error('[replay]', e); }
      }
    })();

    return () => {
      destroyed = true;
      if (tickTimer) clearInterval(tickTimer);
      if (replayerRef.current?.destroy) replayerRef.current.destroy();
      replayerRef.current = null;
    };
  }, [id]);

  function toggle() {
    if (!replayerRef.current) return;
    if (playing) {
      replayerRef.current.pause();
      setPlaying(false);
    } else {
      replayerRef.current.play();
      setPlaying(true);
    }
  }

  return (
    <Dialog open onClose={onClose} labelledby="replay-modal-title">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-4">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h3 id="replay-modal-title" className="font-[family-name:var(--font-display)] text-lg">Session replay</h3>
          <div className="flex items-center gap-3">
            {status === 'ready' && (
              <>
                <button onClick={toggle} className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs text-white">
                  {playing ? 'Pause' : 'Play'}
                </button>
                <span className="font-mono text-xs text-[var(--color-stone)]">{fmt(elapsed)} / {fmt(total)}</span>
              </>
            )}
            <button onClick={onClose} className="text-sm text-[var(--color-stone)] hover:underline">Close</button>
          </div>
        </div>
        {status === 'loading' && <p className="py-8 text-center text-sm text-[var(--color-stone)]">Loading…</p>}
        {status === 'error' && <p className="py-8 text-center text-sm text-[var(--color-stone)]">{errMsg}</p>}
        <div ref={mount} className="rounded overflow-hidden" />
      </div>
    </Dialog>
  );
}
