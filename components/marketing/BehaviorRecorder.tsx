'use client';

import { useEffect } from 'react';
import { getConsent } from '@/components/legal/CookieConsent';

// First-party heatmap + session-replay capture. Runs ONLY after analytics
// consent and never on the admin/portal areas. Inputs are masked; we store
// coarse interaction data only (no keystrokes, no personal data).
const SAMPLE = 1; // fraction of consenting sessions to record (1 = all)

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
  useEffect(() => {
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/account')) return;
    let stop: (() => void) | undefined;
    let cleanup: (() => void) | undefined;

    const start = async () => {
      if (stop) return;
      if (!getConsent()?.analytics) return;
      if (Math.random() > SAMPLE) return;
      const key = sessionKey();
      const path = location.pathname;

      // ── Session replay (rrweb) ──
      try {
        const { record } = await import('rrweb');
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
        stop = () => { clearInterval(t); flush(); rec?.(); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); };
      } catch { /* replay unavailable */ }

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
      const prevStop = stop;
      cleanup = () => { document.removeEventListener('click', onClick, true); window.removeEventListener('scroll', onScroll); window.removeEventListener('pagehide', onLeave); onLeave(); };
      stop = () => { prevStop?.(); cleanup?.(); };
    };

    start();
    const onConsent = () => { if (getConsent()?.analytics) start(); };
    window.addEventListener('kc-consent', onConsent);
    return () => { window.removeEventListener('kc-consent', onConsent); stop?.(); };
  }, []);

  return null;
}
