export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // BLD-415: warn at startup so misconfigured deployments are immediately visible.
    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      console.warn('[sentry] SENTRY_DSN not set — unhandled errors will not be reported');
    }
    // BLD-583: same for SMS. Checks env only (the managed secret store isn't read
    // at boot); if Twilio is set there instead, this is a harmless note. Either way
    // it flags that texts may be silently off so it isn't discovered in production.
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM) {
      console.warn('[sms] Twilio not set via environment — SMS reminders/confirmations will be off unless configured in Admin → Connections (clients get email only)');
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
