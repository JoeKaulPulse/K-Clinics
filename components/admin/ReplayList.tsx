'use client';

import { useEffect, useRef, useState } from 'react';
import 'rrweb-player/dist/style.css';

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
            <thead><tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone-soft)]"><th className="p-2">When</th><th className="p-2">Entry</th><th className="p-2">Device</th><th className="p-2">Length</th><th className="p-2"></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-line)]">
                  <td className="p-2">{new Date(r.startedAt).toLocaleString('en-GB')}</td>
                  <td className="p-2 font-mono text-xs">{r.path}</td>
                  <td className="p-2">{r.device ?? '—'}</td>
                  <td className="p-2">{Math.round(r.durationMs / 1000)}s · {r.eventCount} ev</td>
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

function ReplayModal({ id, onClose }: { id: string; onClose: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading…');

  useEffect(() => {
    let destroyed = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/marketing/replay?id=${id}`);
        const j = await res.json();
        if (destroyed) return;
        const events = j?.events ?? [];
        if (events.length < 2) { setStatus('Not enough data to replay.'); return; }
        const { default: Player } = await import('rrweb-player');
        if (destroyed || !mount.current) return;
        mount.current.innerHTML = '';
        const width = Math.min(1000, mount.current.clientWidth || 900);
        new Player({ target: mount.current, props: { events, width, height: Math.round(width * 0.62), autoPlay: true, speedOption: [1, 2, 4, 8] } });
        setStatus('');
      } catch {
        setStatus('Could not load this replay.');
      }
    })();
    return () => { destroyed = true; };
  }, [id]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg">Session replay</h3>
          <button onClick={onClose} className="text-sm text-[var(--color-stone)] hover:underline">Close</button>
        </div>
        {status && <p className="py-8 text-center text-sm text-[var(--color-stone)]">{status}</p>}
        <div ref={mount} />
      </div>
    </div>
  );
}
