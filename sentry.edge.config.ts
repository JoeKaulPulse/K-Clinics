import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
  });
} else if (process.env.NODE_ENV === 'production') {
  // BLD-507: without a DSN every edge error is silently dropped — make it visible.
  console.warn('[sentry] SENTRY_DSN is not set — edge errors are not being reported.');
}
