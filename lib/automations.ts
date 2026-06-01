import 'server-only';
import { db } from './db';
import { sendEmail, tmplBirthday, tmplFollowUp, tmplWinBack, tmplReviewRequest, tmplAppointmentReminder, tmplFormReminder } from './email';
import { site } from './site';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || site.url;
const unsub = (token: string) => `${SITE_URL}/api/unsubscribe?t=${token}`;

// Config (days) — tune freely.
const FOLLOW_UP_DAYS = 3;
const REVIEW_DAYS = 7;
const WIN_BACK_MONTHS = 6;

type Tally = { birthdays: number; followUps: number; winBacks: number; reviews: number; reminders: number; formReminders: number; treatmentFollowUps: number; giftVouchers: number; reencrypted: number; errors: number };

export async function runDailyAutomations(): Promise<Tally> {
  const t: Tally = { birthdays: 0, followUps: 0, winBacks: 0, reviews: 0, reminders: 0, formReminders: 0, treatmentFollowUps: 0, giftVouchers: 0, reencrypted: 0, errors: 0 };
  await Promise.all([birthdays(t), followUps(t), reviews(t), winBacks(t), reminders(t), formReminders(t), treatmentFollowUps(t), scheduledGiftVouchers(t), keyReencryption(t)]);
  return t;
}

// Deliver any scheduled gift vouchers whose chosen delivery date has arrived.
async function scheduledGiftVouchers(t: Tally) {
  try {
    const { deliverDueVouchers } = await import('@/lib/gift-vouchers');
    t.giftVouchers = await deliverDueVouchers();
  } catch (e) {
    t.errors++;
    console.error('[automations] gift-voucher delivery failed:', (e as Error)?.message);
  }
}

function canEmail(c: { email: string; marketingOptIn: boolean; unsubscribed: boolean }) {
  return c.email && c.marketingOptIn && !c.unsubscribed;
}
// Care-related (transactional) mail — sent regardless of marketing opt-in, but
// still suppressed for a hard unsubscribe.
function canEmailCare(c: { email: string; unsubscribed: boolean }) {
  return Boolean(c.email) && !c.unsubscribed;
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

// 1-week post-treatment follow-up questionnaire ("How is your skin today?").
async function treatmentFollowUps(t: Tally) {
  try {
    const { createDueFollowUps } = await import('@/lib/followup');
    t.treatmentFollowUps = await createDueFollowUps();
  } catch (e) {
    t.errors++;
    console.error('[automations] treatment follow-ups failed:', (e as Error)?.message);
  }
}

// Background key-rotation sweep — re-encrypts a batch of records still on a
// retired encryption key onto the active key. Idempotent; never drops keys.
async function keyReencryption(t: Tally) {
  try {
    const { rotationActive, reencryptBatch } = await import('@/lib/key-rotation');
    if (!rotationActive()) return;
    const res = await reencryptBatch(500);
    t.reencrypted = res.migrated;
    if (res.errors) t.errors += res.errors;
    if (res.migrated || res.remaining) console.log(`[key-rotation] migrated ${res.migrated}, ${res.remaining} remaining`);
  } catch (e) {
    t.errors++;
    console.error('[automations] key re-encryption failed:', (e as Error)?.message);
  }
}

// 24-hour appointment reminder — for CONFIRMED bookings starting tomorrow.
async function reminders(t: Tally) {
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setHours(23, 59, 59, 999);
  const bookings = await db.booking.findMany({
    where: { status: 'CONFIRMED', remindersSent: false, startAt: { gte: start, lte: end } },
    include: { client: true },
  });
  const { smsConfigured, sendSms } = await import('@/lib/sms');
  const smsOn = smsConfigured();
  for (const b of bookings) {
    const manageUrl = `${SITE_URL}/booking/manage?token=${b.manageToken}`;
    if (canEmailCare(b.client)) {
      const res = await sendEmail({
        to: b.client.email,
        subject: `Reminder: your ${b.treatmentTitle} is tomorrow`,
        html: tmplAppointmentReminder({ firstName: b.client.firstName, treatment: b.treatmentTitle, start: b.startAt, manageUrl }),
      });
      await logEvent(b.clientId, 'APPOINTMENT_REMINDER', b.client.email, 'Appointment reminder', res);
      res.ok ? t.reminders++ : t.errors++;
    }
    // SMS reminder when the client opted in to text reminders.
    if (smsOn && b.client.smsReminders && b.client.phone) {
      const when = b.startAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendSms(b.client.phone, `K Clinics reminder: your ${b.treatmentTitle} is tomorrow, ${when}. Manage: ${manageUrl}`).catch(() => {});
    }
    await db.booking.update({ where: { id: b.id }, data: { remindersSent: true } });
  }
}

// Pre-treatment health-form reminder — 2 days before, if the client has a
// portal account but hasn't completed a medical history yet.
async function formReminders(t: Tally) {
  const start = new Date(); start.setDate(start.getDate() + 2); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setHours(23, 59, 59, 999);
  const bookings = await db.booking.findMany({
    where: { status: 'CONFIRMED', startAt: { gte: start, lte: end } },
    include: { client: { include: { assessments: { where: { type: 'MEDICAL_HISTORY' }, take: 1 } } } },
  });
  for (const b of bookings) {
    const c = b.client;
    if (!c.portalActive || c.assessments.length > 0) continue; // only nudge if forms outstanding
    if (!canEmailCare(c)) continue;
    // Don't double-send within 3 days.
    const since = new Date(Date.now() - 3 * 864e5);
    const dup = await db.emailEvent.findFirst({ where: { clientId: c.id, kind: 'FORM_REMINDER', status: 'SENT', createdAt: { gte: since } } });
    if (dup) continue;
    const res = await sendEmail({
      to: c.email,
      subject: 'Please complete your pre-treatment forms',
      html: tmplFormReminder({ firstName: c.firstName, treatment: b.treatmentTitle, start: b.startAt, formsUrl: `${SITE_URL}/account/assessments` }),
    });
    await logEvent(c.id, 'FORM_REMINDER', c.email, 'Pre-treatment form reminder', res);
    res.ok ? t.formReminders++ : t.errors++;
  }
}

async function logEvent(clientId: string, kind: 'BIRTHDAY' | 'FOLLOW_UP' | 'WIN_BACK' | 'REVIEW_REQUEST' | 'APPOINTMENT_REMINDER' | 'FORM_REMINDER', to: string, subject: string, res: { ok: boolean; id?: string; error?: string }) {
  await db.emailEvent.create({
    data: { clientId, kind, to, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error },
  });
  if (res.ok) await db.interaction.create({ data: { clientId, type: 'EMAIL', summary: `Automated email: ${subject}`, author: 'system' } });
}
