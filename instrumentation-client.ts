import { getConsent } from '@/components/legal/CookieConsent';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// BLD-1241: Sentry.init() used to run unconditionally on every page load,
// including anonymous marketing traffic that never triggers an error. The
// resulting chunk (~563KB raw / ~177KB brotli) was the single largest JS chunk
// on the homepage — roughly half its total compressed JS. Init is now deferred
// (dynamic import, only fetched once actually needed) until the browser is
// idle, the visitor first interacts, or a short timeout elapses — except on
// /admin, which stays eager: staff-reported bugs are what Sentry visibility
// matters most for, and admin sessions are a tiny fraction of total traffic so
// the payload cost there is immaterial.
//
// Tradeoff: on public pages, a crash in the first ~0-5s (before idle/interaction/
// timeout fires) would previously have been captured immediately and now is not
// — UNLESS it's a window 'error'/'unhandledrejection', which IS captured: a
// lightweight buffer (below) records those from the very first paint and replays
// them into Sentry the moment it finishes loading, so no early-load crash is
// silently lost, only delayed. This is judged an acceptable tradeoff for a P2
// perf finding — the buffer keeps the risk the task called out (losing early
// crashes) from actually materialising.

function warnIfUnconfigured() {
  if (process.env.NODE_ENV === 'production' && typeof console !== 'undefined') {
    console.warn('[sentry] NEXT_PUBLIC_SENTRY_DSN is not set — client errors are not being reported.');
  }
}

function initSentry(bufferedErrors: { kind: 'error' | 'rejection'; value: unknown }[]) {
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.05,
      sendDefaultPii: false,
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: 0.01,
      // BLD-509: session replay records the page, so it must only start AFTER the
      // user grants analytics consent (matching BehaviorRecorder). Error monitoring
      // runs immediately without replay; the replay integration is added on consent.
      integrations: [],
    });

    // Replay anything the pre-init buffer caught so a deferred init doesn't
    // silently drop an early-load crash — see the module-level comment.
    for (const b of bufferedErrors) {
      Sentry.captureException(b.kind === 'error' ? b.value : (b.value instanceof Error ? b.value : new Error(String(b.value))));
    }

    // BLD-325: mask all text + inputs and block media so no client/clinical PII is
    // ever captured in a recording.
    const addReplay = () => Sentry.addIntegration(Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }));
    if (getConsent()?.analytics) {
      addReplay();
    } else if (typeof window !== 'undefined') {
      const onConsent = () => {
        if (getConsent()?.analytics) { addReplay(); window.removeEventListener('kc-consent', onConsent); }
      };
      window.addEventListener('kc-consent', onConsent);
    }
  }).catch(() => {
    // Chunk fetch can fail (stale HTML after a deploy, offline). Swallow it:
    // an unhandled rejection here would be reported by nothing and only add
    // console noise.
  });
}

if (!dsn) {
  warnIfUnconfigured();
} else if (typeof window === 'undefined') {
  // Not a browser context (shouldn't normally happen for this file) — stay inert.
} else if (/^\/admin(\/|$)/.test(window.location.pathname)) {
  // Staff area: keep eager init so bugs staff hit are captured from first paint.
  initSentry([]);
} else {
  // Pre-init capture buffer: window-level errors during the deferred window are
  // queued here and replayed into Sentry once it loads (see module comment).
  const buffered: { kind: 'error' | 'rejection'; value: unknown }[] = [];
  const MAX_BUFFERED = 20;
  const onWindowError = (e: ErrorEvent) => { if (buffered.length < MAX_BUFFERED) buffered.push({ kind: 'error', value: e.error ?? e.message }); };
  const onRejection = (e: PromiseRejectionEvent) => { if (buffered.length < MAX_BUFFERED) buffered.push({ kind: 'rejection', value: e.reason }); };
  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onRejection);

  let started = false;
  const events = ['pointerdown', 'keydown', 'scroll'] as const;
  const start = () => {
    if (started) return;
    started = true;
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onRejection);
    for (const ev of events) window.removeEventListener(ev, start);
    initSentry(buffered);
  };

  for (const ev of events) window.addEventListener(ev, start, { once: true, passive: true });
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number }).requestIdleCallback;
  if (ric) ric(start, { timeout: 5000 });
  else setTimeout(start, 4000);
}
