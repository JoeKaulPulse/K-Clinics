import 'server-only';
import { db } from './db';
import { sendEmail, emailShell, tmplBirthday, tmplFollowUp, tmplWinBack, tmplReviewRequest, tmplAppointmentReminder, tmplFormReminder, tmplAbandonedBooking } from './email';
import { site } from './site';
import { escapeHtml } from './sanitize';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || site.url;
const unsub = (token: string) => `${SITE_URL}/api/unsubscribe?t=${token}`;

// Config (days) — tune freely.
const FOLLOW_UP_DAYS = 3;
const REVIEW_DAYS = 7;
const WIN_BACK_MONTHS = 6;

const TIER_NUDGE_PENCE = 20000;   // nudge clients within £200 of the next tier
const ANNIVERSARY_POINTS = 1000;  // bonus points on a membership anniversary

type Tally = { birthdays: number; followUps: number; winBacks: number; reviews: number; reminders: number; formReminders: number; treatmentFollowUps: number; giftVouchers: number; tierNudges: number; anniversaries: number; abandonedBookings: number; membershipRenewals: number; staffDigests: number; staffNudges: number; reencrypted: number; errors: number };

export async function runDailyAutomations(): Promise<Tally> {
  const t: Tally = { birthdays: 0, followUps: 0, winBacks: 0, reviews: 0, reminders: 0, formReminders: 0, treatmentFollowUps: 0, giftVouchers: 0, tierNudges: 0, anniversaries: 0, abandonedBookings: 0, membershipRenewals: 0, staffDigests: 0, staffNudges: 0, reencrypted: 0, errors: 0 };
  const { staffWeeklyDigest, staffReengagement } = await import('@/lib/staff-emails');
  await Promise.all([birthdays(t), followUps(t), reviews(t), winBacks(t), reminders(t), formReminders(t), treatmentFollowUps(t), scheduledGiftVouchers(t), tierNudges(t), anniversaries(t), abandonedBookings(t), membershipRenewal(t), staffWeeklyDigest(t), staffReengagement(t), keyReencryption(t)]);
  return t;
}

// ── Membership: "£X from the next tier" nudge ──
async function tierNudges(t: Tally) {
  try {
    const { getTiers, nextTier } = await import('@/lib/membership');
    const tiers = await getTiers();
    const since = new Date(Date.now() - 30 * 864e5);
    const base = (SITE_URL || '').replace(/\/$/, '');
    const clients = await db.client.findMany({ where: { marketingOptIn: true, unsubscribed: false, membership12moPence: { gt: 0 } }, take: 3000 });
    for (const c of clients) {
      if (!canEmail(c)) continue;
      const next = nextTier(tiers, c.membership12moPence);
      if (!next) continue; // already top tier
      const gap = next.minSpendPence - c.membership12moPence;
      if (gap <= 0 || gap > TIER_NUDGE_PENCE) continue;
      const dup = await db.emailEvent.findFirst({ where: { clientId: c.id, kind: 'MEMBERSHIP', status: 'SENT', createdAt: { gte: since }, meta: { path: ['type'], equals: 'nudge' } } });
      if (dup) continue;
      const gbp = `£${Math.ceil(gap / 100).toLocaleString('en-GB')}`;
      const accent = next.color || '#a98a6d';
      const body = `
        <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:${accent};margin:0 0 8px;">K Circle</p>
        <h1 style="margin:0 0 12px;font-size:25px;">You're ${gbp} from ${next.name}</h1>
        <p style="margin:0 0 14px;">Hi ${escapeHtml(c.firstName || 'there')}, you're closer than you think to <strong>${next.name}</strong> — and everything it unlocks: ${next.perks.slice(0, 2).join(', ')}.</p>
        <p style="margin:6px 0 18px;"><a href="${base}/book" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;">Book your next visit</a></p>`;
      const res = await sendEmail({ to: c.email, subject: `You're ${gbp} from ${next.name} — K Circle`, html: emailShell({ body, preheader: `Just ${gbp} more to reach ${next.name}.`, unsubUrl: unsub(c.unsubToken) }) });
      await db.emailEvent.create({ data: { clientId: c.id, kind: 'MEMBERSHIP', to: c.email, subject: `K Circle: ${gbp} from ${next.name}`, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { type: 'nudge' } } }).catch(() => {});
      res.ok ? t.tierNudges++ : t.errors++;
    }
  } catch (e) { t.errors++; console.error('[automations] tier nudges failed:', (e as Error)?.message); }
}

// ── Membership "keep your tier" renewal nudge (opt-in) ──
// Members in a paid tier (Silver+) who are lapsing (last visit ~4–5.5 months
// ago) get a gentle nudge to rebook before their rolling-12-month spend rolls
// off and drops them a tier. Timed before the 6-month win-back so they don't
// overlap. Gated behind membership_renewal_nudge; deduped ~120 days.
async function membershipRenewal(t: Tally) {
  try {
    const { getSetting } = await import('@/lib/settings');
    if (!(await getSetting('membership_renewal_nudge'))) return;
    const { getTiers, tierForSpend } = await import('@/lib/membership');
    const tiers = await getTiers();
    const paidFloor = tiers.find((x) => x.minSpendPence > 0)?.minSpendPence ?? 50000;
    const base = (SITE_URL || '').replace(/\/$/, '');
    const now = Date.now();
    const lo = new Date(now - 165 * 864e5); // ~5.5 months ago
    const hi = new Date(now - 120 * 864e5); // ~4 months ago
    const since = new Date(now - 120 * 864e5);
    const clients = await db.client.findMany({
      where: { marketingOptIn: true, unsubscribed: false, membership12moPence: { gte: paidFloor }, lastVisitAt: { gte: lo, lte: hi } },
      take: 3000,
    });
    for (const c of clients) {
      if (!canEmail(c)) continue;
      const tier = tierForSpend(tiers, c.membership12moPence);
      if (!tier || tier.minSpendPence <= 0) continue; // paid/earned tiers only
      const dup = await db.emailEvent.findFirst({ where: { clientId: c.id, kind: 'MEMBERSHIP', status: 'SENT', createdAt: { gte: since }, meta: { path: ['type'], equals: 'renewal' } } });
      if (dup) continue;
      const accent = tier.color || '#a98a6d';
      const perks = (tier.perks || []).slice(0, 2).join(', ');
      const body = `
        <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:${accent};margin:0 0 8px;">K Circle · ${tier.name}</p>
        <h1 style="margin:0 0 12px;font-size:25px;">Keep your ${tier.name} benefits, ${escapeHtml(c.firstName || 'there')}</h1>
        <p style="margin:0 0 14px;">It's been a little while since your last visit. K Circle tiers are based on your spend over the last 12 months, so a visit soon keeps you in <strong>${tier.name}</strong>${perks ? ` — and everything it unlocks: ${perks}.` : '.'}</p>
        <p style="margin:6px 0 18px;"><a href="${base}/book" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;">Book your next visit</a></p>
        <p style="font-size:14px;color:#91766e;">We'd love to see you again soon.</p>`;
      const res = await sendEmail({ to: c.email, subject: `Keep your K Circle ${tier.name} benefits`, html: emailShell({ body, preheader: `A little nudge to keep your ${tier.name} status.`, unsubUrl: unsub(c.unsubToken) }) });
      await db.emailEvent.create({ data: { clientId: c.id, kind: 'MEMBERSHIP', to: c.email, subject: `K Circle renewal nudge (${tier.name})`, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { type: 'renewal' } } }).catch(() => {});
      res.ok ? t.membershipRenewals++ : t.errors++;
    }
  } catch (e) { t.errors++; console.error('[automations] membership renewal failed:', (e as Error)?.message); }
}

// ── Membership anniversary reward (account anniversary) ──
async function anniversaries(t: Tally) {
  try {
    const today = new Date();
    const since = new Date(Date.now() - 60 * 864e5);
    const base = (SITE_URL || '').replace(/\/$/, '');
    const clients = await db.client.findMany({ where: { marketingOptIn: true, unsubscribed: false }, take: 5000 });
    for (const c of clients) {
      if (!canEmail(c) || !c.createdAt) continue;
      if (c.createdAt.getMonth() !== today.getMonth() || c.createdAt.getDate() !== today.getDate()) continue;
      const years = today.getFullYear() - c.createdAt.getFullYear();
      if (years < 1) continue;
      const dup = await db.emailEvent.findFirst({ where: { clientId: c.id, kind: 'MEMBERSHIP', status: 'SENT', createdAt: { gte: since }, meta: { path: ['type'], equals: 'anniversary' } } });
      if (dup) continue;
      try { const { awardClientPoints } = await import('@/lib/client-loyalty'); await awardClientPoints({ clientId: c.id, points: ANNIVERSARY_POINTS, category: 'MANUAL', reason: `${years}-year membership anniversary gift` }); } catch { /* non-fatal */ }
      const body = `
        <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#a98a6d;margin:0 0 8px;">K Circle</p>
        <h1 style="margin:0 0 12px;font-size:25px;">Thank you for ${years} ${years === 1 ? 'year' : 'years'}</h1>
        <p style="margin:0 0 14px;">Hi ${escapeHtml(c.firstName || 'there')}, it's been ${years} ${years === 1 ? 'year' : 'years'} since you joined us — thank you. As a small thank-you we've added <strong>${ANNIVERSARY_POINTS.toLocaleString('en-GB')} bonus points</strong> to your account.</p>
        <p style="margin:6px 0 18px;"><a href="${base}/account/rewards" style="display:inline-block;background:#a98a6d;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;">See your rewards</a></p>`;
      const res = await sendEmail({ to: c.email, subject: `A little thank-you for ${years} ${years === 1 ? 'year' : 'years'} with us`, html: emailShell({ body, preheader: `${ANNIVERSARY_POINTS} bonus points are waiting in your account.`, unsubUrl: unsub(c.unsubToken) }) });
      await db.emailEvent.create({ data: { clientId: c.id, kind: 'MEMBERSHIP', to: c.email, subject: `K Circle anniversary (${years}y)`, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { type: 'anniversary' } } }).catch(() => {});
      res.ok ? t.anniversaries++ : t.errors++;
    }
  } catch (e) { t.errors++; console.error('[automations] anniversaries failed:', (e as Error)?.message); }
}

// ── Abandoned-booking recovery (opt-in) ──
// A one-time nudge to clients who began a booking but never saved a card, so the
// slot was never held. Gated behind the abandoned_booking_recovery setting.
async function abandonedBookings(t: Tally) {
  try {
    const { getSetting } = await import('@/lib/settings');
    if (!(await getSetting('abandoned_booking_recovery'))) return;
    const base = (SITE_URL || '').replace(/\/$/, '');
    const now = Date.now();
    const rows = await db.booking.findMany({
      where: {
        status: 'PENDING',
        stripePaymentMethodId: null,
        createdAt: { gte: new Date(now - 72 * 3600e3), lte: new Date(now - 2 * 3600e3) },
        startAt: { gt: new Date() },
      },
      include: { client: true },
      take: 500,
    });
    for (const b of rows) {
      const c = b.client;
      if (!c || !canEmailCare(c)) continue;
      // Once per booking only.
      const dup = await db.emailEvent.findFirst({ where: { clientId: c.id, kind: 'ABANDONED_BOOKING', status: 'SENT', meta: { path: ['bookingId'], equals: b.id } } });
      if (dup) continue;
      const resumeUrl = `${base}/book?treatment=${encodeURIComponent(b.treatmentSlug)}`;
      const res = await sendEmail({ to: c.email, subject: `Finish booking your ${b.treatmentTitle}`, html: tmplAbandonedBooking({ firstName: c.firstName, treatment: b.treatmentTitle, resumeUrl }) });
      await db.emailEvent.create({ data: { clientId: c.id, kind: 'ABANDONED_BOOKING', to: c.email, subject: `Finish your ${b.treatmentTitle} booking`, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { bookingId: b.id } } }).catch(() => {});
      res.ok ? t.abandonedBookings++ : t.errors++;
    }
  } catch (e) { t.errors++; console.error('[automations] abandoned bookings failed:', (e as Error)?.message); }
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
    const res = await sendEmail({ to: c.email, subject: `Happy birthday, ${c.firstName} — a gift from KClinics`, html: tmplBirthday(c.firstName, unsub(c.unsubToken)) });
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
      await sendSms(b.client.phone, `KClinics reminder: your ${b.treatmentTitle} is tomorrow, ${when}. Manage: ${manageUrl}`).catch(() => {});
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
