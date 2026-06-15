// Client-side Sentry init. This file name is the convention Next.js (and the
// @sentry/nextjs Turbopack integration) loads for browser instrumentation —
// `sentry.client.config.ts` is NOT injected under Turbopack builds, which is
// what this project uses (`next build` => Turbopack). No-op when
// NEXT_PUBLIC_SENTRY_DSN is not set, so builds without Sentry are unchanged.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    // No session replay — avoids capturing PII.
    integrations: [],
    sendDefaultPii: false,
  });
}

// App Router navigation instrumentation — recommended export so client-side
// route transitions are traced. No-op when Sentry isn't initialised.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
