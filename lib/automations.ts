import 'server-only';
import { db } from './db';
import { sendEmail, emailShell, tmplBirthday, tmplFollowUp, tmplWinBack, tmplReviewRequest, tmplAppointmentReminder, tmplFormReminder, tmplAbandonedBooking, tmplAftercare, tmplSatisfaction, tmplRebook } from './email';
import { site } from './site';
import { escapeHtml } from './sanitize';
import { marketableClientWhere } from './consent';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || site.url;
const unsub = (token: string) => `${SITE_URL}/api/unsubscribe?t=${token}`;

// Config (days) — tune freely.
const FOLLOW_UP_DAYS = 3;
const REVIEW_DAYS = 7;
// BLD-354: post-booking nurture sequence.
const AFTERCARE_HOURS = 36; // day-0: welcome + aftercare within ~a day of the visit
const SATISFACTION_DAYS = 14; // day-14: satisfaction check-in
const REBOOK_DAYS = 45; // day-45: upsell / re-book prompt
const WIN_BACK_MONTHS = 6;

const TIER_NUDGE_PENCE = 20000;   // nudge clients within £200 of the next tier
const ANNIVERSARY_POINTS = 1000;  // bonus points on a membership anniversary

type Tally = { birthdays: number; followUps: number; winBacks: number; reviews: number; reminders: number; formReminders: number; treatmentFollowUps: number; giftVouchers: number; tierNudges: number; anniversaries: number; abandonedBookings: number; membershipRenewals: number; staffDigests: number; staffNudges: number; reencrypted: number; aftercare: number; satisfaction: number; rebookNudges: number; errors: number };

export async function runDailyAutomations(): Promise<Tally> {
  const t: Tally = { birthdays: 0, followUps: 0, winBacks: 0, reviews: 0, reminders: 0, formReminders: 0, treatmentFollowUps: 0, giftVouchers: 0, tierNudges: 0, anniversaries: 0, abandonedBookings: 0, membershipRenewals: 0, staffDigests: 0, staffNudges: 0, reencrypted: 0, aftercare: 0, satisfaction: 0, rebookNudges: 0, errors: 0 };
  const { staffWeeklyDigest, staffReengagement } = await import('@/lib/staff-emails');
  // BLD-120: allSettled so one failing automation can't abort the rest.
  const results = await Promise.allSettled([birthdays(t), followUps(t), reviews(t), winBacks(t), reminders(t), formReminders(t), treatmentFollowUps(t), scheduledGiftVouchers(t), tierNudges(t), anniversaries(t), abandonedBookings(t), membershipRenewal(t), staffWeeklyDigest(t), staffReengagement(t), keyReencryption(t), aftercare(t), satisfaction(t), rebookNudge(t)]);
  for (const r of results) {
    if (r.status === 'rejected') { t.errors++; console.error('[automations] unhandled automation failure:', r.reason); }
  }
  return t;
}

// ── Membership: "£X from the next tier" nudge ──
async function tierNudges(t: Tally) {
  try {
    const { getTiers, nextTier } = await import('@/lib/membership');
    const tiers = await getTiers();
    const since = new Date(Date.now() - 30 * 864e5);
    const base = (SITE_URL || '').replace(/\/$/, '');
    const clients = await db.client.findMany({ where: { ...marketableClientWhere(), membership12moPence: { gt: 0 } }, take: 3000 });
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
      where: { ...marketableClientWhere(), membership12moPence: { gte: paidFloor }, lastVisitAt: { gte: lo, lte: hi } },
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
    const clients = await db.client.findMany({ where: marketableClientWhere(), take: 5000 });
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

function canEmail(c: { email: string; marketingOptIn: boolean; unsubscribed: boolean; marketingConsentAt?: Date | null }) {
  // BLD-242: a lawful marketing send needs recorded consent evidence, not just
  // the boolean — legacy opt-ins with no `marketingConsentAt` are suppressed
  // until re-permissioned (UK GDPR Art.7). Defence-in-depth alongside the query.
  return Boolean(c.email) && c.marketingOptIn && !c.unsubscribed && !!c.marketingConsentAt;
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
  // Deduplicate via emailEvent (Booking has no followUpSent flag; Appointment is the legacy model).
  const bookings = await db.booking.findMany({
    where: { status: 'COMPLETED', startAt: { gte: start, lte: end } },
    include: { client: true },
  });
  for (const a of bookings) {
    if (!canEmail(a.client)) continue;
    const already = await db.emailEvent.findFirst({ where: { clientId: a.clientId, kind: 'FOLLOW_UP', status: 'SENT', createdAt: { gte: start } } });
    if (already) continue;
    const res = await sendEmail({ to: a.client.email, subject: `How are you after your ${a.treatmentTitle}?`, html: tmplFollowUp(a.client.firstName, a.treatmentTitle, unsub(a.client.unsubToken)) });
    await logEvent(a.clientId, 'FOLLOW_UP', a.client.email, 'Post-treatment follow-up', res);
    res.ok ? t.followUps++ : t.errors++;
  }
}

async function reviews(t: Tally) {
  const target = new Date(Date.now() - REVIEW_DAYS * 864e5);
  const start = new Date(target); start.setHours(0, 0, 0, 0);
  const end = new Date(target); end.setHours(23, 59, 59, 999);
  // Deduplicate via emailEvent (Booking has no reviewSent flag; Appointment is the legacy model).
  const bookings = await db.booking.findMany({
    where: { status: 'COMPLETED', startAt: { gte: start, lte: end } },
    include: { client: true },
  });
  for (const a of bookings) {
    if (!canEmail(a.client)) continue;
    const already = await db.emailEvent.findFirst({ where: { clientId: a.clientId, kind: 'REVIEW_REQUEST', status: 'SENT', createdAt: { gte: start } } });
    if (already) continue;
    const res = await sendEmail({ to: a.client.email, subject: "We'd love your thoughts", html: tmplReviewRequest(a.client.firstName, unsub(a.client.unsubToken)) });
    await logEvent(a.clientId, 'REVIEW_REQUEST', a.client.email, 'Review request', res);
    res.ok ? t.reviews++ : t.errors++;
  }
}

// BLD-354: post-booking nurture — day-0 welcome + aftercare (a service message,
// so care-class consent), within ~36h of a completed visit. Deduped per booking.
async function aftercare(t: Tally) {
  const since = new Date(Date.now() - AFTERCARE_HOURS * 36e5);
  const bookings = await db.booking.findMany({ where: { status: 'COMPLETED', startAt: { gte: since, lte: new Date() } }, include: { client: true } });
  for (const b of bookings) {
    if (!canEmailCare(b.client)) continue;
    const dup = await db.emailEvent.findFirst({ where: { clientId: b.clientId, kind: 'AFTERCARE', status: 'SENT', meta: { path: ['bookingId'], equals: b.id } } });
    if (dup) continue;
    const res = await sendEmail({ to: b.client.email, subject: `Your aftercare for ${b.treatmentTitle}`, html: tmplAftercare(b.client.firstName, b.treatmentTitle, unsub(b.client.unsubToken)) });
    await db.emailEvent.create({ data: { clientId: b.clientId, kind: 'AFTERCARE', to: b.client.email, subject: 'Aftercare', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { bookingId: b.id } } }).catch(() => {});
    res.ok ? t.aftercare++ : t.errors++;
  }
}

// BLD-354: day-14 satisfaction check-in (marketing-gated). Deduped per booking.
async function satisfaction(t: Tally) {
  const target = new Date(Date.now() - SATISFACTION_DAYS * 864e5);
  const start = new Date(target); start.setHours(0, 0, 0, 0);
  const end = new Date(target); end.setHours(23, 59, 59, 999);
  const bookings = await db.booking.findMany({ where: { status: 'COMPLETED', startAt: { gte: start, lte: end } }, include: { client: true } });
  for (const b of bookings) {
    if (!canEmail(b.client)) continue;
    const dup = await db.emailEvent.findFirst({ where: { clientId: b.clientId, kind: 'SATISFACTION', status: 'SENT', meta: { path: ['bookingId'], equals: b.id } } });
    if (dup) continue;
    const res = await sendEmail({ to: b.client.email, subject: `How are your results, ${b.client.firstName}?`, html: tmplSatisfaction(b.client.firstName, b.treatmentTitle, unsub(b.client.unsubToken)) });
    await db.emailEvent.create({ data: { clientId: b.clientId, kind: 'SATISFACTION', to: b.client.email, subject: 'Satisfaction check', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { bookingId: b.id } } }).catch(() => {});
    res.ok ? t.satisfaction++ : t.errors++;
  }
}

// BLD-354: day-45 upsell / re-book prompt (marketing-gated). Deduped per booking.
async function rebookNudge(t: Tally) {
  const target = new Date(Date.now() - REBOOK_DAYS * 864e5);
  const start = new Date(target); start.setHours(0, 0, 0, 0);
  const end = new Date(target); end.setHours(23, 59, 59, 999);
  const bookings = await db.booking.findMany({ where: { status: 'COMPLETED', startAt: { gte: start, lte: end } }, include: { client: true } });
  for (const b of bookings) {
    if (!canEmail(b.client)) continue;
    const dup = await db.emailEvent.findFirst({ where: { clientId: b.clientId, kind: 'REBOOK_NUDGE', status: 'SENT', meta: { path: ['bookingId'], equals: b.id } } });
    if (dup) continue;
    const res = await sendEmail({ to: b.client.email, subject: 'Time to top up your results?', html: tmplRebook(b.client.firstName, b.treatmentTitle, unsub(b.client.unsubToken)) });
    await db.emailEvent.create({ data: { clientId: b.clientId, kind: 'REBOOK_NUDGE', to: b.client.email, subject: 'Re-book nudge', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { bookingId: b.id } } }).catch(() => {});
    res.ok ? t.rebookNudges++ : t.errors++;
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
    const res = await sendEmail({ to: c.email, subject: `We've missed you, ${c.firstName}`, html: tmplWinBack(c.firstName, unsub(c.unsubToken)) });
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

// BLD-126: Multi-window appointment reminders (72h / 48h / 24h).
// 24h is always on; 72h and 48h are behind the reminder_72h / reminder_48h
// settings so the owner can enable them progressively.
async function reminders(t: Tally) {
  const { smsConfigured, sendSms } = await import('@/lib/sms');
  const smsOn = await smsConfigured();
  const { getSetting } = await import('@/lib/settings');
  const [r72, r48] = await Promise.all([getSetting('reminder_72h'), getSetting('reminder_48h')]);
  const { clinicDateISO, clinicDayBounds } = await import('@/lib/clinic-time');

  async function sendWindow(daysAhead: number, sentFlag: 'reminder72hSent' | 'reminder48hSent' | 'remindersSent', label: string) {
    // Window bounds in clinic-local (Europe/London) time, not the server's TZ: on a
    // UTC host, setHours(0,…) lands on UTC midnight, so the day boundary is an hour
    // off and near-midnight appointments get reminded a day early/late.
    const [yy, mm, dd] = clinicDateISO(new Date()).split('-').map(Number);
    const targetISO = clinicDateISO(new Date(Date.UTC(yy, mm - 1, dd + daysAhead, 12)));
    const { dayStart: start, dayEnd: end } = clinicDayBounds(targetISO);
    const bookings = await db.booking.findMany({
      where: { status: 'CONFIRMED', [sentFlag]: false, startAt: { gte: start, lte: end } },
      include: { client: true },
    });
    for (const b of bookings) {
      const manageUrl = `${SITE_URL}/booking/manage?token=${b.manageToken}`;
      const emailApplicable = canEmailCare(b.client);
      const smsApplicable = Boolean(smsOn && b.client.smsReminders && b.client.phone);
      let delivered = false;
      if (emailApplicable) {
        const res = await sendEmail({
          to: b.client.email,
          subject: `Reminder: your ${b.treatmentTitle} is ${label}`,
          html: tmplAppointmentReminder({ firstName: b.client.firstName, treatment: b.treatmentTitle, start: b.startAt, manageUrl }),
        });
        await logEvent(b.clientId, 'APPOINTMENT_REMINDER', b.client.email, `Appointment reminder (${label})`, res);
        if (res.ok) { t.reminders++; delivered = true; } else { t.errors++; }
      }
      if (smsApplicable) {
        const when = b.startAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
        const sms = await sendSms(b.client.phone, `KClinics reminder: your ${b.treatmentTitle} is ${label}, ${when}. Manage: ${manageUrl}`).catch(() => null);
        if (sms?.ok) delivered = true;
      }
      // Latch the per-window flag only when a channel actually delivered, or when
      // the client has no contactable channel at all (nothing to retry). A
      // transient email/SMS failure leaves it unset so the next run retries,
      // instead of silently burning the reminder window.
      if (delivered || (!emailApplicable && !smsApplicable)) {
        await db.booking.update({ where: { id: b.id }, data: { [sentFlag]: true } });
      }
    }
  }

  if (r72) await sendWindow(3, 'reminder72hSent', 'in 3 days');
  if (r48) await sendWindow(2, 'reminder48hSent', 'in 2 days');
  await sendWindow(1, 'remindersSent', 'tomorrow');
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
