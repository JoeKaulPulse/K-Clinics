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
    // BLD-705: session-signing secrets below 32 bytes are byte-repeated up to
    // HS256's minimum by lib/auth-edge.ts toKey, which stretches length but not
    // entropy — a weak configured secret yields a weak signing key. Loud
    // startup error (not a throw: an outage would be worse than the warning,
    // and the value can't be rotated from here) so it gets rotated.
    for (const name of ['ADMIN_JWT_SECRET', 'CLIENT_JWT_SECRET', 'ACADEMY_JWT_SECRET'] as const) {
      const v = process.env[name];
      if (v && Buffer.byteLength(v, 'utf8') < 32) {
        console.error(`[auth] ${name} is shorter than 32 bytes — the session signing key is derived from weak input. Rotate it to a 32+ character random value (BLD-705).`);
      }
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
