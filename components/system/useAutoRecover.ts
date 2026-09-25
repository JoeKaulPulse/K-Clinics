'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// BLD-1611: shared auto-recovery for the unattended screens (room display, the
// live-visit companion, the NPS survey). Those boundaries must retry on their
// own — nobody is standing there to click "Try again" — but a bare
// `setTimeout(reset, N)` is unbounded when the underlying error is PERMANENT:
// reset() re-renders, the render throws again, the boundary remounts, and the
// timer restarts. That is one server round-trip and one Sentry event every N
// seconds, per screen, forever — enough to burn the Sentry quota and bury real
// alerts, which is worse than the frozen screen it was meant to fix.
//
// So: keep retrying (correct for an unattended screen), but back off, cap the
// interval, cap the error reporting, and escalate from reset() — which only
// re-renders the segment — to a full reload, which also clears any corrupt
// client-side state.
//
// The boundary REMOUNTS on every re-thrown error, so attempt state cannot live
// in component state or a module variable that a reload would reset.
// sessionStorage survives both the remount and the hard reload, and is per-tab.

const KEY = 'kc_autorecover';
const REPORT_LIMIT = 3; // Sentry events per error streak — the 4th+ are silent
const RELOAD_AFTER = 3; // in-page reset()s before escalating to a full reload
const MAX_DELAY_MS = 5 * 60_000; // ceiling on the backoff
// A screen that rendered cleanly for this long has recovered; the next error is
// a fresh streak (fast first retry, reported again) rather than a continuation.
const STREAK_WINDOW_MS = 10 * 60_000;

function readStreak(): number {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return 0;
    const { n, at } = JSON.parse(raw) as { n: number; at: number };
    if (!Number.isFinite(n) || !Number.isFinite(at)) return 0;
    if (Date.now() - at > STREAK_WINDOW_MS) return 0;
    return Math.max(0, n);
  } catch {
    return 0; // no sessionStorage (private mode, embedded webview) — retry as if fresh
  }
}

function writeStreak(n: number) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ n, at: Date.now() }));
  } catch {
    /* storage unavailable — the backoff degrades to a constant baseDelayMs */
  }
}

/** Auto-recover an unattended screen from a render error: exponential backoff
 *  from `baseDelayMs` (capped), Sentry reporting capped per streak, and a hard
 *  reload once in-place resets have stopped helping. */
export function useAutoRecover(
  error: Error & { digest?: string },
  reset: () => void,
  baseDelayMs: number,
) {
  useEffect(() => {
    const streak = readStreak();
    writeStreak(streak + 1);

    // Report the first few of a streak, then go quiet: a permanently broken
    // screen must not emit an event every few seconds for hours.
    if (streak < REPORT_LIMIT) {
      Sentry.captureException(error, {
        tags: { area: 'auto-recover' },
        extra: { attempt: streak + 1, digest: error?.digest },
      });
    }

    const delay = Math.min(baseDelayMs * 2 ** streak, MAX_DELAY_MS);
    const t = setTimeout(() => {
      if (streak + 1 >= RELOAD_AFTER) window.location.reload();
      else reset();
    }, delay);
    return () => clearTimeout(t);
  }, [error, reset, baseDelayMs]);
}
