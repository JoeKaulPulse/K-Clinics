'use client';

import { useEffect, useRef, useState } from 'react';
import { EMOJI } from './util';
import type { DraftAttachment } from './types';

const POP = 'absolute bottom-12 z-[60] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-lift)]';

/** A compact emoji grid. */
export function EmojiPicker({ onPick, onClose, align = 'left' }: { onPick: (e: string) => void; onClose: () => void; align?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [onClose]);
  return (
    <div ref={ref} className={`${POP} ${align === 'right' ? 'right-0' : 'left-0'} w-64 p-2`}>
      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto">
        {EMOJI.map((e) => (
          <button key={e} type="button" onClick={() => { onPick(e); }} className="rounded p-1 text-lg leading-none hover:bg-[var(--color-bone)]">{e}</button>
        ))}
      </div>
    </div>
  );
}

type Gif = { id: string; url: string; preview: string; width: number; height: number; title: string };

/** GIF search popover backed by the /gifs proxy (Tenor/GIPHY). */
export function GifPicker({ onPick, onClose }: { onPick: (g: DraftAttachment) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [onClose]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/team-chat/gifs?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j) => { if (!on) return; setConfigured(Boolean(j?.configured)); setGifs(j?.gifs || []); })
        .catch(() => {})
        .finally(() => { if (on) setLoading(false); });
    }, q ? 350 : 0);
    return () => { on = false; clearTimeout(t); };
  }, [q]);

  return (
    <div ref={ref} className={`${POP} left-0 w-72 p-2`}>
      <input
        autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs…" aria-label="Search GIFs"
        className="mb-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]"
      />
      {!configured ? (
        <p className="px-1 py-6 text-center text-xs text-[var(--color-stone)]">GIF search isn’t set up yet. Add a <span className="font-mono">TENOR_API_KEY</span> or <span className="font-mono">GIPHY_API_KEY</span> to enable it.</p>
      ) : loading && !gifs.length ? (
        <p className="px-1 py-6 text-center text-xs text-[var(--color-stone)]">Loading…</p>
      ) : (
        <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto">
          {gifs.map((g) => (
            <button key={g.id} type="button" onClick={() => onPick({ kind: 'GIF', url: g.url, name: g.title, mime: 'image/gif', width: g.width, height: g.height })} className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] hover:border-[var(--color-gold)]">
              <img src={g.preview} alt={g.title} className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
          {!gifs.length && <p className="col-span-2 px-1 py-6 text-center text-xs text-[var(--color-stone)]">No GIFs found.</p>}
        </div>
      )}
      <p className="mt-1.5 text-center text-[0.6rem] text-[var(--color-stone)]">Powered by GIF search</p>
    </div>
  );
}
