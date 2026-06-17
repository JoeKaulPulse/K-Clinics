import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.01,
    // BLD-325: mask all text + inputs and block media in session replay so no
    // client/clinical PII is ever captured in a recording.
    integrations: [Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })],
  });
}
