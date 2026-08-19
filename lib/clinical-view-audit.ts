import 'server-only';

// BLD-1240 / BLD-1392: decClinical() decrypts Art. 9 health data (allergies,
// medical flags, consultation concerns, chat bodies…) at 15+ display sites,
// but only the health-assessment formatter and the calls route ever wrote a
// "who viewed whose medical record" audit row — the trail was far narrower
// than the remediation history suggests. This helper is the shared, throttled
// view-audit emission the audits asked for: call it wherever clinical fields
// are decrypted FOR DISPLAY, alongside (not inside) decClinical — the decrypt
// itself stays a pure sync function.
//
// Throttle: at most one audit row per (actor, client, surface) per hour per
// server instance. Serverless instances are short-lived, so the map resets on
// cold start — that duplicates the occasional row rather than dropping any,
// which is the right failure direction for an audit trail. Fire-and-forget:
// a logging failure must never break the page that triggered it.

const seen = new Map<string, number>();
const WINDOW_MS = 60 * 60 * 1000;

export function auditClinicalView(opts: { actor: string; actorRole?: string; clientId: string; surface: string; bookingId?: string | null }): void {
  if (!opts.actor || !opts.clientId) return;
  const key = `${opts.actor}|${opts.clientId}|${opts.surface}`;
  const now = Date.now();
  const last = seen.get(key);
  if (last && now - last < WINDOW_MS) return;
  seen.set(key, now);
  if (seen.size > 5000) {
    for (const [k, t] of seen) if (now - t > WINDOW_MS) seen.delete(k);
  }
  void import('@/lib/audit')
    .then(({ logAudit }) => logAudit({
      action: 'ASSESSMENT_VIEWED',
      actor: opts.actor,
      actorRole: opts.actorRole,
      clientId: opts.clientId,
      bookingId: opts.bookingId ?? undefined,
      summary: `Clinical data viewed (${opts.surface})`,
    }))
    .catch(() => {});
}
