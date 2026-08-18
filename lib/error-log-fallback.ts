import 'server-only';
import { db } from '@/lib/db';

// BLD-1273: Sentry.captureException/captureMessage becomes a silent no-op at
// every one of its dozens of call sites across app/api/** and lib/** whenever
// SENTRY_DSN isn't set — sentry.server.config.ts / sentry.edge.config.ts /
// instrumentation-client.ts all skip Sentry.init() without a DSN and only
// console.warn once at boot (Vercel function logs aren't routinely read). This
// is a lightweight fallback, not a replacement for Sentry: it only does
// anything when SENTRY_DSN is absent (Sentry already has the error otherwise —
// no need to duplicate), and it's wired into the single highest-leverage
// integration point (instrumentation.ts's onRequestError, which Next.js already
// calls for every otherwise-unhandled server/edge request error) rather than
// every individual try/catch across the codebase — see the note on the
// BLD-1273 backlog entry for why a full per-call-site migration is out of
// scope here. It reuses the existing Setting key-value table (no new table)
// and the existing CRON_ALERT_WEBHOOK_URL ops-alert mechanism already used by
// app/api/health and the cron routes — both per CLAUDE.md's schema-change and
// "reuse the existing pattern" guidance.

const FALLBACK_KEY = 'error_log_fallback';
const MAX_ENTRIES = 30;

export type ErrorLogEntry = {
  at: string;
  summary: string;
  route?: string;
  digest?: string;
};

function sentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/** Best-effort, never throws, and only does anything when SENTRY_DSN is unset. */
export async function logErrorFallback(summary: string, meta?: { route?: string; digest?: string }): Promise<void> {
  if (sentryConfigured()) return;
  const entry: ErrorLogEntry = { at: new Date().toISOString(), summary: summary.slice(0, 500), route: meta?.route, digest: meta?.digest };

  try {
    const row = await db.setting.findUnique({ where: { key: FALLBACK_KEY } });
    const prior: ErrorLogEntry[] = row?.value ? JSON.parse(row.value) : [];
    const next = [entry, ...prior].slice(0, MAX_ENTRIES);
    await db.setting.upsert({
      where: { key: FALLBACK_KEY },
      update: { value: JSON.stringify(next), updatedBy: 'error-log-fallback' },
      create: { key: FALLBACK_KEY, value: JSON.stringify(next), updatedBy: 'error-log-fallback' },
    });
  } catch { /* best-effort — DB may itself be down, or unreachable from the edge runtime */ }

  const webhookUrl = process.env.CRON_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `[kclinics error] Sentry not configured — ${entry.summary}${entry.route ? ` (${entry.route})` : ''}` }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch { /* non-fatal — alert is best-effort by design, matching every other CRON_ALERT_WEBHOOK_URL call site */ }
  }
}

/** Read back the rotating buffer — e.g. for an admin page that wants to show
 *  recent errors when Sentry has no DSN. Not currently rendered anywhere; kept
 *  small and read-only so it's cheap to wire into a page later. */
export async function getErrorLogFallback(): Promise<ErrorLogEntry[]> {
  try {
    const row = await db.setting.findUnique({ where: { key: FALLBACK_KEY } });
    return row?.value ? JSON.parse(row.value) : [];
  } catch { return []; }
}
