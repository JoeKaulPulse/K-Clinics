'use client';

import { useEffect, useRef, useState } from 'react';
import type { KioskLivePayload, KioskLiveResult, KioskStage } from './types';

// ── Live channel: SSE first, 1s polling fallback ─────────────────────────────
// Primary: EventSource on GET /api/kiosk/sessions/{token}/stream (contract §5).
// The server function ends ~every 55s and EventSource auto-reconnects; a
// successful `open` resets the error counter so routine cycling never trips
// the fallback. Two consecutive errors without a successful open (or a fatal
// CLOSED state, e.g. the route 404s) switch permanently to polling the
// existing GET /api/kiosk/sessions/{token}, which only exposes coarse
// status — we degrade gracefully by synthesizing a stage from it and, once
// ANALYZED, fetching the public result body so reveal can still run
// (without annotations/photo — RevealScene handles that).

const POLL_MS = 1000;

/** Coarse stage from the legacy status-only poll endpoint. */
function stageFromStatus(status: string, hasResult: boolean): KioskStage {
  switch (status) {
    case 'ACTIVE': return 'idle';
    case 'PHOTO_TAKEN': return 'paired'; // someone is mid-flow on their phone
    case 'ANALYZED': return hasResult ? 'reveal' : 'analyzing';
    case 'SHARED': return 'shared';
    case 'ANALYSIS_FAILED': return 'failed';
    case 'AGE_DECLINED': return 'declined';
    case 'EXPIRED': return 'expired';
    default: return 'idle';
  }
}

export function useKioskChannel(token: string): { payload: KioskLivePayload | null; mode: 'sse' | 'poll' } {
  const [payload, setPayload] = useState<KioskLivePayload | null>(null);
  const [mode, setMode] = useState<'sse' | 'poll'>('sse');
  // Stable identity for change-detection so 1s polling doesn't re-render idly.
  const sigRef = useRef('');

  useEffect(() => {
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let errors = 0;
    let resultCache: KioskLiveResult | null = null;
    let fetchingResult = false;

    const publish = (p: KioskLivePayload) => {
      if (stopped) return;
      const sig = [p.stage, p.status, p.poseIdx, p.frameAt ?? '', (p.photoUrls ?? []).length, p.result ? 1 : 0, p.frame ? p.frame.length : 0].join('|');
      if (sig === sigRef.current) return;
      sigRef.current = sig;
      setPayload(p);
    };

    const pollTick = async () => {
      try {
        const r = await fetch(`/api/kiosk/sessions/${token}`, { cache: 'no-store' });
        if (r.status === 404) {
          publish({ stage: 'expired', status: 'EXPIRED', poseIdx: 0 });
          return;
        }
        const d = await r.json().catch(() => null) as { ok?: boolean; status?: string; resultId?: string | null } | null;
        if (!d?.ok || typeof d.status !== 'string') return;
        // Once analysis lands, fetch the public result body (scores/headline/
        // insights/treatments) so the reveal scene has something to stage.
        if ((d.status === 'ANALYZED' || d.status === 'SHARED') && d.resultId && !resultCache && !fetchingResult) {
          fetchingResult = true;
          try {
            const rr = await fetch(`/api/kiosk/results/${d.resultId}`, { cache: 'no-store' });
            const dd = await rr.json().catch(() => null) as { ok?: boolean; result?: Record<string, unknown> } | null;
            if (dd?.ok && dd.result) {
              resultCache = {
                headline: (dd.result.headline as string) ?? null,
                skinScore: (dd.result.skinScore as number) ?? null,
                smileScore: (dd.result.smileScore as number) ?? null,
                insights: (dd.result.insights as string[]) ?? [],
                treatments: (dd.result.treatments as string[]) ?? [],
                annotations: null, // not exposed on the fallback endpoint — reveal degrades
                bestPhotoUrl: null,
                shareSlug: (dd.result.shareSlug as string) ?? null,
              };
            }
          } finally {
            fetchingResult = false;
          }
        }
        publish({
          stage: stageFromStatus(d.status, !!resultCache),
          status: d.status,
          poseIdx: 0,
          frame: null,
          frameAt: null,
          photoUrls: [],
          result: resultCache,
        });
      } catch {
        /* network blip — keep polling */
      }
    };

    const startPoll = () => {
      if (stopped || pollTimer) return;
      setMode('poll');
      void pollTick();
      pollTimer = setInterval(pollTick, POLL_MS);
    };

    const startSse = () => {
      if (typeof EventSource === 'undefined') { startPoll(); return; }
      try {
        es = new EventSource(`/api/kiosk/sessions/${token}/stream`);
      } catch {
        startPoll();
        return;
      }
      es.onopen = () => { errors = 0; };
      es.onmessage = (ev) => {
        errors = 0;
        try {
          const d = JSON.parse(ev.data) as KioskLivePayload;
          if (d && typeof d === 'object' && typeof d.stage === 'string') {
            publish({
              stage: d.stage,
              status: typeof d.status === 'string' ? d.status : 'ACTIVE',
              poseIdx: typeof d.poseIdx === 'number' ? d.poseIdx : 0,
              frame: d.frame ?? null,
              frameAt: d.frameAt ?? null,
              photoUrls: Array.isArray(d.photoUrls) ? d.photoUrls : [],
              result: d.result ?? null,
            });
          }
        } catch { /* malformed frame — ignore */ }
      };
      es.onerror = () => {
        errors += 1;
        const fatal = es?.readyState === EventSource.CLOSED; // browser gave up (e.g. 404)
        if (errors >= 2 || fatal) {
          es?.close();
          es = null;
          startPoll();
        }
      };
    };

    startSse();
    return () => {
      stopped = true;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [token]);

  return { payload, mode };
}
