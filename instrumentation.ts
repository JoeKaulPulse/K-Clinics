// Next.js instrumentation hook — runs once on server startup (nodejs + edge).
// Sentry is a no-op when SENTRY_DSN is not set.
import * as Sentry from '@sentry/nextjs';

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    // Avoid PII leaking into breadcrumbs.
    sendDefaultPii: false,
  });
}

// Capture unhandled server-side request errors (App Router route handlers,
// Server Components, middleware). Forwards to Sentry with full context.
export const onRequestError = Sentry.captureRequestError;
