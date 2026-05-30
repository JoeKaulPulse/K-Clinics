import 'server-only';
import { db } from './db';
import { sendEmail, tmplBirthday, tmplFollowUp, tmplWinBack, tmplReviewRequest } from './email';
import { site } from './site';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || site.url;
const unsub = (token: string) => `${SITE_URL}/api/unsubscribe?t=${token}`;

// Config (days) — tune freely.
const FOLLOW_UP_DAYS = 3;
const REVIEW_DAYS = 7;
const WIN_BACK_MONTHS = 6;

type Tally = { birthdays: number; followUps: number; winBacks: number; reviews: number; errors: number };

export async function runDailyAutomations(): Promise<Tally> {
  const t: Tally = { birthdays: 0, followUps: 0, winBacks: 0, reviews: 0, errors: 0 };
  await Promise.all([birthdays(t), followUps(t), reviews(t), winBacks(t)]);
  return t;
}

function canEmail(c: { email: string; marketingOptIn: boolean; unsubscribed: boolean }) {
  return c.email && c.marketingOptIn && !c.unsubscribed;
}

// Already sent this kind to this client today/this cycle?
async function sentRecently(clientId: string, kind: 'BIRTHDAY' | 'WIN_BACK', sinceDays: number) {
  const since = new Date(Date.now() - sinceDays * 864e5);
  const existing = await db.emailEvent.findFirst({
    where: { clientId, kind, status: 'SENT', createdAt: { gte: since } },
  });
  return Boolean(existing);
}

async function birthdays(t: Tally) {
  const today = new Date();
  const clients = await db.client.findMany({ where: { dob: { not: null } } });
  for (const c of clients) {
    if (!c.dob || !canEmail(c)) continue;
    if (c.dob.getMonth() !== today.getMonth() || c.dob.getDate() !== today.getDate()) continue;
    if (await sentRecently(c.id, 'BIRTHDAY', 350)) continue;
    const res = await sendEmail({ to: c.email, subject: `Happy birthday, ${c.firstName} — a gift from K Clinics`, html: tmplBirthday(c.firstName, unsub(c.unsubToken)) });
    await logEvent(c.id, 'BIRTHDAY', c.email, 'Birthday greeting', res);
    res.ok ? t.birthdays++ : t.errors++;
  }
}

async function followUps(t: Tally) {
  const target = new Date(Date.now() - FOLLOW_UP_DAYS * 864e5);
  const start = new Date(target); start.setHours(0, 0, 0, 0);
  const end = new Date(target); end.setHours(23, 59, 59, 999);
  const appts = await db.appointment.findMany({
    where: { status: 'COMPLETED', followUpSent: false, scheduledAt: { gte: start, lte: end } },
    include: { client: true },
  });
  for (const a of appts) {
    if (canEmail(a.client)) {
      const res = await sendEmail({ to: a.client.email, subject: `How are you after your ${a.treatment}?`, html: tmplFollowUp(a.client.firstName, a.treatment, unsub(a.client.unsubToken)) });
      await logEvent(a.clientId, 'FOLLOW_UP', a.client.email, 'Post-treatment follow-up', res);
      res.ok ? t.followUps++ : t.errors++;
    }
    await db.appointment.update({ where: { id: a.id }, data: { followUpSent: true } });
  }
}

async function reviews(t: Tally) {
  const target = new Date(Date.now() - REVIEW_DAYS * 864e5);
  const start = new Date(target); start.setHours(0, 0, 0, 0);
  const end = new Date(target); end.setHours(23, 59, 59, 999);
  const appts = await db.appointment.findMany({
    where: { status: 'COMPLETED', reviewSent: false, scheduledAt: { gte: start, lte: end } },
    include: { client: true },
  });
  for (const a of appts) {
    if (canEmail(a.client)) {
      const res = await sendEmail({ to: a.client.email, subject: 'We’d love your thoughts', html: tmplReviewRequest(a.client.firstName, unsub(a.client.unsubToken)) });
      await logEvent(a.clientId, 'REVIEW_REQUEST', a.client.email, 'Review request', res);
      res.ok ? t.reviews++ : t.errors++;
    }
    await db.appointment.update({ where: { id: a.id }, data: { reviewSent: true } });
  }
}

async function winBacks(t: Tally) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - WIN_BACK_MONTHS);
  const clients = await db.client.findMany({
    where: { lastVisitAt: { not: null, lte: cutoff } },
  });
  for (const c of clients) {
    if (!canEmail(c)) continue;
    if (await sentRecently(c.id, 'WIN_BACK', 90)) continue;
    const res = await sendEmail({ to: c.email, subject: `We’ve missed you, ${c.firstName}`, html: tmplWinBack(c.firstName, unsub(c.unsubToken)) });
    await logEvent(c.id, 'WIN_BACK', c.email, 'Win-back', res);
    res.ok ? t.winBacks++ : t.errors++;
  }
}

async function logEvent(clientId: string, kind: 'BIRTHDAY' | 'FOLLOW_UP' | 'WIN_BACK' | 'REVIEW_REQUEST', to: string, subject: string, res: { ok: boolean; id?: string; error?: string }) {
  await db.emailEvent.create({
    data: { clientId, kind, to, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error },
  });
  if (res.ok) await db.interaction.create({ data: { clientId, type: 'EMAIL', summary: `Automated email: ${subject}`, author: 'system' } });
}
