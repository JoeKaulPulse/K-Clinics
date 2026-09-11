'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getConsent } from '@/components/legal/CookieConsent';
import { NO_RECORD_PATH } from '@/lib/no-record-paths';

// First-party heatmap + session-replay capture. Runs ONLY after analytics
// consent and never on the admin/portal areas. Inputs are masked; we store
// coarse interaction data only (no keystrokes, no personal data).
// BLD-1276: was 1 (100% of consenting sessions) — rrweb's mutation-observer/DOM
// snapshot recorder ran continuously for the FULL session on every
// analytics-consenting marketing visitor. 0.08 (8%) is still a representative
// sample for heatmap/replay review while cutting the recording cost ~12x.
const SAMPLE = 0.08; // fraction of consenting sessions to record

// Never record the app areas, the booking flow, the shop checkout (personal
// data — name/email/address/DOB — is entered/echoed there; BLD-1314), or the
// academy portal (BLD-1621: real client before/after treatment photos,
// trainee income/employment/residency data, and trainee contact details).
// PRJ-1191.1: NO_RECORD_PATH now lives in lib/no-record-paths.ts, shared with
// the server-side ingest safeguard, so the two lists can't drift apart again.

function sessionKey(): string {
  try {
    let k = sessionStorage.getItem('kc_rk');
    if (!k) { k = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; sessionStorage.setItem('kc_rk', k); }
    return k;
  } catch { return `${Date.now().toString(36)}`; }
}
const device = () => (/mobi|iphone|android.*mobile/i.test(navigator.userAgent) ? 'mobile' : /ipad|tablet/i.test(navigator.userAgent) ? 'tablet' : 'desktop');
const send = (url: string, data: unknown) => {
  try {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    if (!navigator.sendBeacon?.(url, blob)) fetch(url, { method: 'POST', body: blob, keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
};

export function BehaviorRecorder() {
  const pathname = usePathname();
  // BLD-1621: this component is rendered by the marketing layout, which stays
  // MOUNTED across client-side navigation — /book, /booking, /shop and /academy
  // all live inside that same route group. The mount-time path check below
  // therefore only ever covered visitors who LAND on an excluded page; anyone
  // who soft-navigated into one from a public page (home → "Explore the
  // academy" → /academy/portal) kept being recorded, which is exactly the case
  // the exclusion exists to stop. `abortRef` is the teardown for that: it stops
  // rrweb and DISCARDS whatever is still buffered rather than flushing it like
  // the normal stop path, because the excluded page's DOM may already be in the
  // buffer by the time this effect runs. The teardown is one-way for the rest
  // of the session (deliberately conservative — navigating back out to a public
  // page does not restart the recorder).
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (NO_RECORD_PATH.test(location.pathname)) return;
    let stop: (() => void) | undefined;
    let cleanup: (() => void) | undefined;
    let aborted = false;
    let abortReplay: (() => void) | undefined;
    let abortHeatmap: (() => void) | undefined;

    // Registered synchronously so a navigation that lands while start() is still
    // awaiting the rrweb import also cancels it (`aborted` is re-checked after
    // every await below).
    abortRef.current = () => {
      aborted = true;
      abortReplay?.(); abortHeatmap?.();
      abortReplay = undefined; abortHeatmap = undefined;
      stop = undefined; cleanup = undefined;
    };

    const start = async () => {
      if (aborted || stop) return;
      if (!getConsent()?.analytics) return;
      if (Math.random() > SAMPLE) return;
      const key = sessionKey();
      const path = location.pathname;

      // ── Session replay (rrweb) ──
      try {
        const { record } = await import('rrweb');
        if (aborted) return;
        let buffer: unknown[] = [];
        const flush = () => { if (!buffer.length) return; const events = buffer; buffer = []; send('/api/track/replay', { sessionKey: key, path, device: device(), events }); };
        const rec = record({
          emit: (e) => { buffer.push(e); if (buffer.length >= 40) flush(); },
          maskAllInputs: true, maskTextClass: 'kc-mask', blockClass: 'kc-no-record',
          sampling: { mousemove: 100, scroll: 200, input: 'last' },
          recordCanvas: false, collectFonts: false,
        });
        const t = setInterval(flush, 5000);
        const onHide = () => flush();
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onHide);
        const detachReplay = () => { clearInterval(t); rec?.(); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); };
        stop = () => { flush(); detachReplay(); };
        // Drop the buffer instead of flushing it — see abortRef above.
        abortReplay = () => { buffer = []; detachReplay(); };
      } catch { /* replay unavailable */ }
      if (aborted) return;

      // ── Heatmap (clicks, rage-clicks, scroll depth) ──
      const hits: { type: string; xPct: number; yPct: number; scrollPct: number }[] = [];
      let recent: number[] = [];
      let maxScroll = 0;
      const pageH = () => Math.max(document.documentElement.scrollHeight, 1);
      const onClick = (e: MouseEvent) => {
        const xPct = Math.round((e.clientX / Math.max(window.innerWidth, 1)) * 1000);
        const yPct = Math.round(((e.clientY + window.scrollY) / pageH()) * 1000);
        const now = Date.now();
        recent = recent.filter((t) => now - t < 1000); recent.push(now);
        hits.push({ type: recent.length >= 3 ? 'rage' : 'click', xPct, yPct, scrollPct: 0 });
        if (hits.length >= 12) flushHits();
      };
      const onScroll = () => { maxScroll = Math.max(maxScroll, Math.round(((window.scrollY + window.innerHeight) / pageH()) * 1000)); };
      const flushHits = () => { if (!hits.length) return; const events = hits.splice(0, hits.length); send('/api/track/heatmap', { path, events }); };
      const flushScroll = () => { if (maxScroll > 0) { send('/api/track/heatmap', { path, events: [{ type: 'scroll', xPct: 0, yPct: 0, scrollPct: maxScroll }] }); maxScroll = 0; } };
      document.addEventListener('click', onClick, true);
      window.addEventListener('scroll', onScroll, { passive: true });
      const onLeave = () => { flushHits(); flushScroll(); };
      window.addEventListener('pagehide', onLeave);
      const detachHeatmap = () => { document.removeEventListener('click', onClick, true); window.removeEventListener('scroll', onScroll); window.removeEventListener('pagehide', onLeave); };
      const prevStop = stop;
      cleanup = () => { detachHeatmap(); onLeave(); };
      stop = () => { prevStop?.(); cleanup?.(); };
      abortHeatmap = () => { detachHeatmap(); hits.length = 0; maxScroll = 0; };
    };

    start();
    // BLD-1554: withdrawing analytics consent tears the recorder down. Clearing
    // `stop` afterwards is part of the teardown, not tidiness: `start()` bails on
    // a truthy `stop`, so leaving it set would (a) make a later re-grant a no-op
    // — consent could never be turned back on within the session — and (b) leave
    // the unmount cleanup below calling the same rrweb stop function a second time.
    const onConsent = () => { if (getConsent()?.analytics) start(); else { stop?.(); stop = undefined; } };
    window.addEventListener('kc-consent', onConsent);
    return () => { window.removeEventListener('kc-consent', onConsent); stop?.(); abortRef.current = null; };
  }, []);

  // BLD-1621: soft navigation into an excluded area stops an already-running
  // recorder (the effect above runs once, at mount, so it cannot do this itself).
  useEffect(() => {
    if (!pathname || !NO_RECORD_PATH.test(pathname)) return;
    abortRef.current?.();
    abortRef.current = null;
  }, [pathname]);

  return null;
}
