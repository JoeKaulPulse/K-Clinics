'use client';

import { useEffect, useRef, useState } from 'react';
import { useDialogBehaviours } from '@/components/ui/Dialog';

// BLD-529: view-only PDF reader. Renders pages to <canvas> with pdf.js — no
// browser PDF toolbar, so no download/print buttons — and pulls bytes from the
// authenticated proxy (/api/academy/pdf), never the public Blob URL. Right-click
// is disabled as a further nudge. Honest limit: no web viewer can stop a
// screenshot or photo; this stops casual downloading, not a determined copier.
// BLD-865: a denial reason from the proxy maps to a message the student can
// actually act on, instead of one unexplained "couldn't be opened" that looked
// identical whether the file was missing, the session had expired, or their
// enrolment/cohort access hadn't started yet.
// BLD-1537: canvas-only rendering gave screen-reader users zero content from
// any lesson PDF. Each page now also gets pdf.js's real text layer (the
// documented getTextContent()+TextLayer API), overlaid on the canvas so it
// sits in the accessibility tree in reading order — but it's invisible and
// non-interactive (see .kc-pdf-text-layer, globals.css: transparent,
// pointer-events:none, user-select:none), so it adds nothing a sighted mouse
// user can see or copy. The canvas rendering, no-toolbar, and no-right-click
// protections above are unchanged.
const REASON_MESSAGES: Record<string, string> = {
  unauthenticated: 'Your session has expired — please sign in again.',
  'not-enrolled': 'Your course access isn’t active yet — contact us if you believe this is wrong.',
  locked: 'This lesson isn’t released yet.',
  'lesson-not-found': 'This document couldn’t be found.',
  'bad-index': 'This document couldn’t be found.',
  'upstream-error': 'This document couldn’t be loaded — please try again in a moment.',
};
const DEFAULT_ERROR = 'This document couldn’t be opened.';

export function SecurePdfViewer({ lessonId, index, title, onClose }: { lessonId: string; index: number; title: string; onClose: () => void }) {
  const canvasHost = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState(DEFAULT_ERROR);
  // PRJ-1032.25: dialog semantics + focus trap / Escape / restore.
  const { panelRef, onKeyDown } = useDialogBehaviours<HTMLDivElement>(onClose, true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // Bundled worker (Next resolves the asset URL at build time).
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const res = await fetch(`/api/academy/pdf?lesson=${encodeURIComponent(lessonId)}&i=${index}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null) as { reason?: string } | null;
          if (!cancelled) setErrorMessage((body?.reason && REASON_MESSAGES[body.reason]) || DEFAULT_ERROR);
          throw new Error('fetch failed');
        }
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

          // Wrapper gives the (invisible) text layer below a same-sized,
          // positioned ancestor to overlay via inset:0 — width is explicit so
          // it shrinks to the canvas's rendered size (not the full scroll
          // width) and centers via mx-auto same as the canvas did before;
          // height is left auto so it sizes to the canvas alone and the
          // canvas's own mb-4 still collapses through for page spacing,
          // reproducing the original layout exactly.
          const pageWrap = document.createElement('div');
          pageWrap.className = 'relative mx-auto';
          pageWrap.style.width = `${viewport.width / ratio}px`;
          host.appendChild(pageWrap);

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / ratio}px`;
          canvas.style.height = `${viewport.height / ratio}px`;
          canvas.setAttribute('aria-hidden', 'true'); // real content is the sibling text layer below
          pageWrap.appendChild(canvas);
          // pdf.js v6: render takes the canvas element directly (canvasContext is legacy).
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;

          // BLD-1537: accessible text layer. Non-fatal on failure — the
          // visual canvas rendering above already succeeded, so one page's
          // text layer erroring (e.g. an unusual embedded font) shouldn't
          // take down the whole viewer.
          try {
            const textContent = await page.getTextContent();
            if (cancelled) return;
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'kc-pdf-text-layer';
            pageWrap.appendChild(textLayerDiv);
            await new pdfjs.TextLayer({ textContentSource: textContent, container: textLayerDiv, viewport }).render();
          } catch {
            // swallow — see comment above
          }
        }
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId, index]);

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={onKeyDown} className="fixed inset-0 z-[220] flex flex-col bg-black/85 outline-none" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <span className="hidden shrink-0 text-xs text-white/45 sm:block">View only — downloading and printing are disabled</span>
        <button onClick={onClose} className="shrink-0 rounded-full bg-white/15 px-4 py-1.5 text-sm hover:bg-white/25">Close</button>
      </div>
      <div className="flex-1 overflow-auto bg-[#3a3a3a] p-4">
        {status === 'loading' && <p className="mt-10 text-center text-sm text-white/60">Loading document…</p>}
        {status === 'error' && <p className="mt-10 text-center text-sm text-white/60">{errorMessage}</p>}
        <div ref={canvasHost} className="select-none [&_canvas]:mx-auto [&_canvas]:mb-4 [&_canvas]:rounded [&_canvas]:shadow-lg" />
      </div>
    </div>
  );
}
