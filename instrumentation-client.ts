import * as Sentry from '@sentry/nextjs';
import { getConsent } from '@/components/legal/CookieConsent';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
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
} else if (process.env.NODE_ENV === 'production' && typeof console !== 'undefined') {
  // BLD-507: a missing DSN means every client error is silently dropped. Surface it.
  console.warn('[sentry] NEXT_PUBLIC_SENTRY_DSN is not set — client errors are not being reported.');
}
