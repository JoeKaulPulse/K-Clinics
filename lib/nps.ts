import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';

// Net Promoter Score — opt-in. One NpsResponse per send; the client scores 0–10
// with one tap from the email (link carries the score), then can add a comment.
const baseUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');

/** Create + send an NPS survey to a client. (Caller gates on recency/settings.) */
export async function sendNps(o: { clientId: string; email: string; firstName: string; bookingId?: string; treatment?: string }): Promise<boolean> {
  const row = await db.npsResponse.create({ data: { clientId: o.clientId, bookingId: o.bookingId || null, treatment: o.treatment || null } });
  const { sendEmail, tmplNps } = await import('@/lib/email');
  const res = await sendEmail({
    to: o.email,
    subject: 'How are we doing? One quick tap',
    html: tmplNps({ firstName: o.firstName, treatment: o.treatment, baseUrl: baseUrl(), token: row.token }),
  });
  await db.emailEvent.create({ data: { clientId: o.clientId, kind: 'MANUAL', to: o.email, subject: 'NPS survey', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { type: 'nps' } } }).catch(() => {});
  return res.ok;
}

/** Has this client been sent an NPS within the last `days`? (dedupe) */
export async function npsSentRecently(clientId: string, days = 90): Promise<boolean> {
  const since = new Date(Date.now() - days * 864e5);
  return (await db.npsResponse.count({ where: { clientId, sentAt: { gte: since } } })) > 0;
}

/** Record a score and/or comment from the capture page. Token-gated (no auth). */
export async function recordNps(token: string, data: { score?: number; comment?: string }): Promise<{ ok: boolean; score?: number | null; error?: string }> {
  const row = await db.npsResponse.findUnique({
    where: { token },
    select: { id: true, score: true, clientId: true, client: { select: { email: true, firstName: true } } },
  });
  if (!row) return { ok: false, error: 'This feedback link is invalid or has expired.' };
  const prevScore = row.score;
  const update: { score?: number; respondedAt?: Date; comment?: string } = {};
  if (typeof data.score === 'number' && data.score >= 0 && data.score <= 10) { update.score = Math.round(data.score); update.respondedAt = new Date(); }
  if (typeof data.comment === 'string' && data.comment.trim()) update.comment = data.comment.trim().slice(0, 2000);
  if (Object.keys(update).length) await db.npsResponse.update({ where: { token }, data: update });
  const fresh = await db.npsResponse.findUnique({ where: { token }, select: { score: true } });
  // BLD-653: send a promoter follow-up (Google review + refer-a-friend) once, when
  // score first reaches 9–10. Non-fatal — email failure never blocks the score save.
  if (update.score != null && update.score >= 9 && (prevScore == null || prevScore < 9) && row.client) {
    const client = row.client;
    const clientId = row.clientId;
    const referUrl = `${baseUrl()}/account/rewards`;
    Promise.resolve().then(async () => {
      try {
        const [{ sendEmail, tmplNpsPromoter }, { googleReviewLink }] = await Promise.all([
          import('@/lib/email'),
          import('@/lib/review-system'),
        ]);
        const googleUrl = await googleReviewLink().catch(() => null);
        const res = await sendEmail({
          to: client.email,
          subject: 'Thank you — help spread the word',
          html: tmplNpsPromoter({ firstName: client.firstName, googleUrl, referUrl }),
        });
        if (clientId) {
          await db.emailEvent.create({
            data: { clientId, kind: 'MANUAL', to: client.email, subject: 'NPS promoter follow-up', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { type: 'nps_promoter' } },
          }).catch(() => {});
        }
      } catch { /* non-fatal */ }
    }).catch(() => {});
  }
  return { ok: true, score: fresh?.score ?? null };
}

export async function getNps(token: string) {
  return db.npsResponse.findUnique({ where: { token }, select: { token: true, score: true, treatment: true } });
}

/** Admin summary: NPS = %promoters(9–10) − %detractors(0–6). */
export async function npsSummary(days = 365) {
  const since = new Date(Date.now() - days * 864e5);
  const rows = await db.npsResponse.findMany({
    where: { score: { not: null }, respondedAt: { gte: since } },
    orderBy: { respondedAt: 'desc' }, take: 500,
    select: { score: true, comment: true, treatment: true, respondedAt: true },
  });
  const n = rows.length;
  const promoters = rows.filter((r) => (r.score ?? 0) >= 9).length;
  const passives = rows.filter((r) => (r.score ?? 0) >= 7 && (r.score ?? 0) <= 8).length;
  const detractors = rows.filter((r) => (r.score ?? 0) <= 6).length;
  const nps = n ? Math.round(((promoters - detractors) / n) * 100) : null;
  const avg = n ? rows.reduce((s, r) => s + (r.score ?? 0), 0) / n : null;
  const sentTotal = await db.npsResponse.count({ where: { sentAt: { gte: since } } });
  const comments = rows.filter((r) => r.comment).slice(0, 30).map((r) => ({ score: r.score, comment: r.comment, treatment: r.treatment, at: r.respondedAt }));
  return { nps, avg, responses: n, promoters, passives, detractors, sentTotal, comments };
}
