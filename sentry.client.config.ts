import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Capture 10 % of transactions in production for performance monitoring;
  // capture all in non-production so local/staging issues surface fully.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Capture 100 % of sessions in which an error occurs.
  replaysOnErrorSampleRate: 1.0,
  // Capture 1 % of sessions overall (performance sampling).
  replaysSessionSampleRate: 0.01,
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: false }),
  ],
  // Missing DSN = Sentry is a no-op; no error is thrown.
});
