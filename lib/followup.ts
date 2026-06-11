import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';
import { encClinical } from '@/lib/clinical-crypto';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || site.url;

/** Create + send post-treatment follow-up questionnaires for treatments
 *  completed ~7 days ago that don't already have one. Returns the count sent. */
export async function createDueFollowUps(): Promise<number> {
  const start = new Date(); start.setDate(start.getDate() - 8); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setDate(end.getDate() - 6); end.setHours(23, 59, 59, 999);

  const bookings = await db.booking.findMany({
    where: { status: 'COMPLETED', startAt: { gte: start, lte: end }, followUp: null },
    include: { client: true },
  });

  const { sendEmail, tmplFollowUpQuestionnaire } = await import('@/lib/email');
  let sent = 0;
  for (const b of bookings) {
    if (!b.client || b.client.unsubscribed) continue; // care email, but honour hard unsubscribe
    const fu = await db.followUp.create({ data: { bookingId: b.id, clientId: b.clientId, treatmentTitle: b.treatmentTitle } });
    const url = `${SITE_URL}/follow-up/${fu.token}`;
    const res = await sendEmail({ to: b.client.email, subject: `How is your ${b.treatmentTitle}?`, html: tmplFollowUpQuestionnaire({ firstName: b.client.firstName, treatment: b.treatmentTitle, url }) });
    await db.emailEvent.create({ data: { clientId: b.clientId, kind: 'FOLLOW_UP', to: b.client.email, subject: 'Post-treatment follow-up', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } }).catch(() => {});
    if (res.ok) sent++;
  }
  return sent;
}

/** Record a client's follow-up response. A reported concern auto-creates a
 *  high-priority task for the team and logs an interaction. */
export async function submitFollowUp(token: string, sentiment: string, comment?: string): Promise<{ ok: boolean; concern?: boolean; error?: string }> {
  const fu = await db.followUp.findUnique({ where: { token }, include: { client: true } });
  if (!fu) return { ok: false, error: 'This link is no longer valid.' };
  if (fu.respondedAt) return { ok: true, concern: fu.concern };

  const valid = ['great', 'ok', 'concerned'].includes(sentiment) ? sentiment : 'ok';
  const concern = valid === 'concerned';
  const note = comment?.trim().slice(0, 1000) || null;

  let taskId: string | undefined;
  if (concern) {
    const name = [fu.client.firstName, fu.client.lastName].filter(Boolean).join(' ');
    const task = await db.task.create({
      data: {
        title: `Follow-up concern — ${name} (${fu.treatmentTitle})`,
        detail: note ? `Client reported a concern at their 1-week follow-up: “${note}”` : 'Client flagged a concern at their 1-week follow-up.',
        priority: 'HIGH', status: 'OPEN', clientId: fu.clientId, createdBy: 'system',
      },
    });
    taskId = task.id;
    // Reference ID (TSK-n) for tracing/search; best-effort (backfill self-heals).
    const { assignTaskRef } = await import('@/lib/task-refs');
    await assignTaskRef(task.id).catch(() => {});
    await db.interaction.create({ data: { clientId: fu.clientId, type: 'FOLLOW_UP', summary: `Post-treatment concern flagged (${fu.treatmentTitle})`, detail: note ? encClinical(note) : undefined, author: 'system' } }).catch(() => {});
  }

  await db.followUp.update({ where: { id: fu.id }, data: { respondedAt: new Date(), sentiment: valid, concern, comment: note, taskId } });
  return { ok: true, concern };
}

export async function getFollowUp(token: string) {
  return db.followUp.findUnique({ where: { token }, select: { token: true, treatmentTitle: true, respondedAt: true, sentiment: true } });
}
