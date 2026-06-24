'use client';

import { useEffect, useRef, useState } from 'react';

// BLD-529: view-only PDF reader. Renders pages to <canvas> with pdf.js — no
// browser PDF toolbar, so no download/print buttons — and pulls bytes from the
// authenticated proxy (/api/academy/pdf), never the public Blob URL. Right-click
// is disabled as a further nudge. Honest limit: no web viewer can stop a
// screenshot or photo; this stops casual downloading, not a determined copier.
export function SecurePdfViewer({ lessonId, index, title, onClose }: { lessonId: string; index: number; title: string; onClose: () => void }) {
  const canvasHost = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // Bundled worker (Next resolves the asset URL at build time).
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const res = await fetch(`/api/academy/pdf?lesson=${encodeURIComponent(lessonId)}&i=${index}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.arrayBuffer();
        if (cancelled) return;
        const doc = await pdfjs.getDocument({ data }).promise;
        const host = canvasHost.current;
        if (cancelled || !host) return;
        host.innerHTML = '';
        const ratio = window.devicePixelRatio || 1;
        const targetWidth = Math.min(host.clientWidth || 800, 900);
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (targetWidth / base.width) * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / ratio}px`;
          canvas.style.height = `${viewport.height / ratio}px`;
          host.appendChild(canvas);
          // pdf.js v6: render takes the canvas element directly (canvasContext is legacy).
          await page.render({ canvas, viewport }).promise;
        }
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId, index]);

  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-black/85" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <span className="hidden shrink-0 text-xs text-white/45 sm:block">View only — downloading and printing are disabled</span>
        <button onClick={onClose} className="shrink-0 rounded-full bg-white/15 px-4 py-1.5 text-sm hover:bg-white/25">Close</button>
      </div>
      <div className="flex-1 overflow-auto bg-[#3a3a3a] p-4">
        {status === 'loading' && <p className="mt-10 text-center text-sm text-white/60">Loading document…</p>}
        {status === 'error' && <p className="mt-10 text-center text-sm text-white/60">This document couldn’t be opened.</p>}
        <div ref={canvasHost} className="select-none [&_canvas]:mx-auto [&_canvas]:mb-4 [&_canvas]:rounded [&_canvas]:shadow-lg" />
      </div>
    </div>
  );
}
