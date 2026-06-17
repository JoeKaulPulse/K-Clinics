export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // BLD-415: warn at startup so misconfigured deployments are immediately visible.
    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      console.warn('[sentry] SENTRY_DSN not set — unhandled errors will not be reported');
    }
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export async function onRequestError(
  error: { digest: string } & Error,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const { captureRequestError } = await import('@sentry/nextjs');
  captureRequestError(error, request, context);
}
