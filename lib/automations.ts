import 'server-only';
import { db } from './db';
import { sendEmail, emailShell, tmplBirthday, tmplFollowUp, tmplWinBack, tmplReviewRequest, tmplAppointmentReminder, tmplFormReminder, tmplAbandonedBooking, tmplAbandonedOrder, tmplAftercare, tmplSatisfaction, tmplRebook, tmplCourseContentReady } from './email';
import { ensureReviewRequest, reviewLink, googleReviewLink } from './review-system';
import { site } from './site';
import { escapeHtml } from './sanitize';
import { marketableClientWhere } from './consent';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || site.url;
const unsub = (token: string) => `${SITE_URL}/api/unsubscribe?t=${token}`;
// BLD-1141: RFC 8058 one-click unsubscribe header, same construction as
// lib/email-campaigns.ts / lib/re-permission.ts / app/api/newsletter/route.ts.
const unsubHeaders = (token: string) => ({ 'List-Unsubscribe': `<${unsub(token)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

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

// BLD-1231: how far back a course's FIRST lesson/quiz can have landed and still
// be worth telling stranded students about. Wide enough that a few missed cron
// runs don't lose the notice, narrow enough that shipping the feature can't
// retro-announce content that has been live for years.
const CONTENT_READY_WINDOW_DAYS = 30;
const CONTENT_READY_MAX_PER_RUN = 500; // sends per daily run; the rest drain tomorrow

type Tally = { birthdays: number; followUps: number; winBacks: number; reviews: number; reminders: number; formReminders: number; treatmentFollowUps: number; giftVouchers: number; tierNudges: number; anniversaries: number; abandonedBookings: number; abandonedOrders: number; bookingIntents: number; membershipRenewals: number; staffDigests: number; staffNudges: number; reencrypted: number; aftercare: number; satisfaction: number; rebookNudges: number; npsPromoters: number; npsDetractors: number; liveClassReminders: number; courseContentReady: number; errors: number };

export async function runDailyAutomations(): Promise<Tally> {
  const t: Tally = { birthdays: 0, followUps: 0, winBacks: 0, reviews: 0, reminders: 0, formReminders: 0, treatmentFollowUps: 0, giftVouchers: 0, tierNudges: 0, anniversaries: 0, abandonedBookings: 0, abandonedOrders: 0, bookingIntents: 0, membershipRenewals: 0, staffDigests: 0, staffNudges: 0, reencrypted: 0, aftercare: 0, satisfaction: 0, rebookNudges: 0, npsPromoters: 0, npsDetractors: 0, liveClassReminders: 0, courseContentReady: 0, errors: 0 };
  const { staffWeeklyDigest, staffReengagement } = await import('@/lib/staff-emails');
  // BLD-120: allSettled so one failing automation can't abort the rest.
  const results = await Promise.allSettled([birthdays(t), followUps(t), reviews(t), winBacks(t), reminders(t), formReminders(t), treatmentFollowUps(t), scheduledGiftVouchers(t), tierNudges(t), anniversaries(t), abandonedBookings(t), abandonedOrders(t), bookingIntentRecovery(t), membershipRenewal(t), staffWeeklyDigest(t), staffReengagement(t), keyReencryption(t), aftercare(t), satisfaction(t), rebookNudge(t), promoterFollowUp(t), detractorFollowUp(t), liveClassReminders(t), courseContentReady(t)]);
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
      const res = await sendEmail({ to: c.email, subject: `You're ${gbp} from ${next.name} — K Circle`, html: emailShell({ body, preheader: `Just ${gbp} more to reach ${next.name}.`, unsubUrl: unsub(c.unsubToken) }), headers: unsubHeaders(c.unsubToken) });
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
      const res = await sendEmail({ to: c.email, subject: `Keep your K Circle ${tier.name} benefits`, html: emailShell({ body, preheader: `A little nudge to keep your ${tier.name} status.`, unsubUrl: unsub(c.unsubToken) }), headers: unsubHeaders(c.unsubToken) });
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
      const res = await sendEmail({ to: c.email, subject: `A little thank-you for ${years} ${years === 1 ? 'year' : 'years'} with us`, html: emailShell({ body, preheader: `${ANNIVERSARY_POINTS} bonus points are waiting in your account.`, unsubUrl: unsub(c.unsubToken) }), headers: unsubHeaders(c.unsubToken) });
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

// ── Abandoned-order recovery (opt-in) ──
// BLD-1204: a one-time nudge to shoppers who reached checkout (Order created
// PENDING with their email already captured) but never completed payment.
// Mirrors abandonedBookings() above: same 2–72h timing window, same
// EmailEvent dedupe pattern, same email-sending mechanism. Gated behind the
// abandoned_order_recovery setting.
async function abandonedOrders(t: Tally) {
  try {
    const { getSetting } = await import('@/lib/settings');
    if (!(await getSetting('abandoned_order_recovery'))) return;
    const base = (SITE_URL || '').replace(/\/$/, '');
    const now = Date.now();
    const rows = await db.order.findMany({
      where: {
        status: 'PENDING',
        // BLD-1204 (review): ONLINE shop checkouts only. app/api/admin/pos
        // creates Order rows too, and an abandoned over-the-counter sale is
        // left PENDING with a customer email that is often blank (the till
        // defaults the name to 'In-store sale' and the email field is
        // optional) and nothing to "finish" in the web cart — so without these
        // two filters the automation emails in-clinic till customers a
        // nonsensical /shop/cart link, and a blank-email row sends to '' and
        // writes a FAILED EmailEvent that the SENT-only dedupe below never
        // suppresses, so it retries on every daily run.
        //
        // app/api/shop/checkout sets stripePaymentIntentId the moment the
        // PaymentIntent is created (and deletes the order outright if that
        // fails), while POS card sales go through a Checkout Session and only
        // receive a PI id from the webhook — by which point they are already
        // PAID. So "PENDING with a PI id" is exactly the set of abandoned web
        // checkouts.
        stripePaymentIntentId: { not: null },
        email: { not: '' },
        createdAt: { gte: new Date(now - 72 * 3600e3), lte: new Date(now - 2 * 3600e3) },
      },
      take: 500,
    });
    for (const o of rows) {
      // Honour a hard unsubscribe if this email maps to a known client — this is
      // a one-time transactional nudge (not marketing), same stance as
      // bookingIntentRecovery below.
      const client = o.clientId
        ? await db.client.findUnique({ where: { id: o.clientId }, select: { unsubscribed: true } }).catch(() => null)
        : await db.client.findFirst({ where: { email: { equals: o.email, mode: 'insensitive' } }, select: { unsubscribed: true } }).catch(() => null);
      if (client?.unsubscribed) continue;
      // Once per order only.
      const dup = await db.emailEvent.findFirst({ where: { kind: 'ABANDONED_ORDER', status: 'SENT', meta: { path: ['orderId'], equals: o.id } } });
      if (dup) continue;
      const resumeUrl = `${base}/shop/cart`;
      const res = await sendEmail({ to: o.email, subject: 'Finish your order', html: tmplAbandonedOrder({ firstName: o.name.split(/\s+/)[0] || 'there', resumeUrl }) });
      await db.emailEvent.create({ data: { clientId: o.clientId ?? null, kind: 'ABANDONED_ORDER', to: o.email, subject: 'Finish your order', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { orderId: o.id } } }).catch(() => {});
      res.ok ? t.abandonedOrders++ : t.errors++;
    }
  } catch (e) { t.errors++; console.error('[automations] abandoned orders failed:', (e as Error)?.message); }
}

// ── Course-content-ready notification (always on) ──
// BLD-1231: a paid/enrolled academy student on a course with zero lessons and
// no quiz hit a portal dead end (courseProgress() → hasContent:false, so the
// only action shown was a generic "contact us" link). Once staff add the
// course's first lesson or quiz, notify every enrolment that was actually
// stuck, exactly once.
//
// "Actually stuck" is the load-bearing part (BLD-1231 review): the audience is
// NOT "everyone on a course that has content" — that is every paying student
// the academy has ever had, all of whom would be mass-mailed "your course is
// ready" on the first run after deploy, including people who are half way
// through. An enrolment only qualifies when the course's FIRST lesson/quiz was
// created after that enrolment took its place (acceptedAt, else createdAt) —
// i.e. there was a window in which the student had paid and had nothing to
// study. A course that already had content when they enrolled never stranded
// them, so it never notifies.
//
// The same reasoning bounds it in time: only content that first landed inside
// CONTENT_READY_WINDOW_DAYS counts, so courses filled years ago do not fire a
// retrospective "it's ready!" today, and the feature cannot reach back over
// historical data when it ships.
//
// The audience also mirrors the portal exactly — the dead end is a portal
// screen, and the portal lists enrolments by studentId (not by email), while
// /academy/learn/<slug> resolves access through studentCanAccess(studentId).
// So an enrolment with no linked AcademyStudent never saw the dead end and
// could not open the link we would send it; requiring studentId keeps the
// email and the portal talking about the same set of people.
//
// Idempotency: contentReadyNotifiedAt is claimed with a conditional updateMany
// BEFORE the send, so two overlapping cron runs cannot both take the same row;
// a failed send releases the claim so it retries on the next run.
async function courseContentReady(t: Tally) {
  try {
    const base = (SITE_URL || '').replace(/\/$/, '');
    const cutoff = new Date(Date.now() - CONTENT_READY_WINDOW_DAYS * 864e5);
    // When did each course stop being empty? Earliest lesson/quiz per course.
    // Matches courseProgress()'s hasContent definition (lib/lms.ts): a course
    // has content iff it has at least one lesson or one quiz, in any module.
    const modules = await db.courseModule.findMany({
      where: { OR: [{ lessons: { some: {} } }, { quiz: { isNot: null } }] },
      select: {
        courseId: true,
        lessons: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        quiz: { select: { createdAt: true } },
      },
    });
    const firstContentAt = new Map<string, Date>();
    for (const m of modules) {
      for (const at of [m.lessons[0]?.createdAt, m.quiz?.createdAt]) {
        if (!at) continue;
        const seen = firstContentAt.get(m.courseId);
        if (!seen || at < seen) firstContentAt.set(m.courseId, at);
      }
    }
    let budget = CONTENT_READY_MAX_PER_RUN;
    for (const [courseId, contentAt] of firstContentAt) {
      if (budget <= 0) break;
      if (contentAt < cutoff) continue; // filled long before this ran — not news
      const rows = await db.enrolment.findMany({
        where: {
          courseId,
          status: { in: ['PAID', 'ENROLLED'] },
          contentReadyNotifiedAt: null,
          studentId: { not: null },
          applicantEmail: { not: '' },
          // Their place predates the content → they were stranded.
          OR: [{ acceptedAt: { lt: contentAt } }, { acceptedAt: null, createdAt: { lt: contentAt } }],
        },
        select: { id: true, studentId: true, applicantEmail: true, applicantName: true, course: { select: { title: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
        take: budget,
      });
      const notified = new Set<string>();
      for (const e of rows) {
        budget--;
        // Claim first: a conditional update is the concurrency gate, so two
        // overlapping runs can't both send. count 0 = someone else has it.
        const claim = await db.enrolment.updateMany({ where: { id: e.id, contentReadyNotifiedAt: null }, data: { contentReadyNotifiedAt: new Date() } });
        if (claim.count !== 1) continue;
        // A student with two live enrolments on one course (e.g. a re-sit) gets
        // one email, not two — the duplicate is stamped, not sent, so it stops
        // being re-queried every run.
        if (e.studentId && notified.has(e.studentId)) continue;
        const firstName = (e.applicantName || 'there').trim().split(/\s+/)[0] || 'there';
        const learnUrl = `${base}/academy/learn/${e.course.slug}`;
        const subject = `${e.course.title} is ready to start`;
        const res = await sendEmail({ to: e.applicantEmail, subject, html: tmplCourseContentReady({ firstName, courseTitle: e.course.title, learnUrl }) });
        await db.emailEvent.create({ data: { kind: 'COURSE_CONTENT_READY', to: e.applicantEmail, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { enrolmentId: e.id, courseId } } }).catch(() => {});
        if (res.ok) {
          if (e.studentId) notified.add(e.studentId);
          t.courseContentReady++;
        } else {
          t.errors++;
          // Release the claim so a transient send failure retries next run. If
          // the release itself fails the row stays stamped — fails closed (a
          // missed nudge), never into a duplicate send.
          await db.enrolment.updateMany({ where: { id: e.id }, data: { contentReadyNotifiedAt: null } }).catch(() => {});
        }
      }
    }
  } catch (e) { t.errors++; console.error('[automations] course content ready failed:', (e as Error)?.message); }
}

// BLD-1253: app/api/shop/checkout creates a plain Stripe PaymentIntent (not a
// Checkout Session, which auto-expires) and reserves any applied gift-card
// balance up front via reserveVoucher(). If the customer never confirms
// payment, no payment_intent.canceled event is ever fired (there's nothing
// for Stripe to expire), so the Order sits PENDING forever and the reserved
// gift-card balance is stranded — never spendable, never released. Mirrors
// releaseAbandonedPendingBookings() (lib/booking-actions.ts): a frequent,
// unconditional sweep (not gated behind the abandoned_order_recovery setting
// above, which only controls the reminder EMAIL) that cancels the order and
// credits back any reserved balance via the same undoVoucherReservation() the
// POS cancel path uses (app/api/admin/pos/route.ts).
//
// Cutoff is deliberately longer than a booking's 45-minute window: the
// abandonedOrders() reminder above emails the shopper anywhere from 2h to 72h
// after checkout, and a cancelled order can't be "finished" by clicking that
// link — so releasing before the reminder has had its full window to convert
// would undercut it. ORDER_ABANDON_MS clears that 72h window with a few days'
// margin for the shopper to act on the nudge before we give up on the sale.
const ORDER_ABANDON_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function releaseAbandonedPendingOrders(): Promise<{ released: number }> {
  const cutoff = new Date(Date.now() - ORDER_ABANDON_MS);
  const candidates = await db.order.findMany({
    where: {
      status: 'PENDING',
      stripePaymentIntentId: { not: null },
      createdAt: { lt: cutoff },
    },
    select: { id: true, number: true, stripePaymentIntentId: true, giftCardCode: true, giftCardPence: true },
    take: 200,
  });
  if (!candidates.length) return { released: 0 };

  const { stripeEnabled, stripe } = await import('@/lib/stripe');
  const { undoVoucherReservation } = await import('@/lib/gift-vouchers');

  let released = 0;
  for (const o of candidates) {
    // Re-confirm the live PaymentIntent before cancelling — a payment that
    // succeeded (or is mid-confirmation) moments before this sweep ran, whose
    // webhook hasn't landed yet, must never be cancelled out from under the
    // customer. Mirrors the same care app/api/admin/pos/route.ts takes before
    // cancelling a sale: don't touch anything we can't confirm is dead.
    if (stripeEnabled && o.stripePaymentIntentId) {
      try {
        const pi = await stripe().paymentIntents.retrieve(o.stripePaymentIntentId);
        if (pi.status === 'succeeded' || pi.status === 'processing' || pi.status === 'requires_capture') continue;
      } catch (e) {
        console.error(`[automations] abandoned order ${o.number}: couldn't confirm PaymentIntent state — skipping`, (e as Error)?.message);
        continue;
      }
    }
    // Atomic claim (mirrors the PENDING→CANCELLED guard used throughout the
    // webhook and POS cancel paths) so a concurrent finalize/cancel can't
    // double-credit the voucher.
    const claimed = await db.order.updateMany({ where: { id: o.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (claimed.count === 0) continue;
    if (o.giftCardCode && o.giftCardPence > 0) {
      await undoVoucherReservation(o.giftCardCode, o.giftCardPence);
    }
    // Best-effort: also cancel the PaymentIntent itself so a much-later
    // confirmation attempt can't succeed against an order we've already given
    // up on (finalizeOrder's CANCELLED guard, BLD-761, would catch and flag it
    // for staff review either way — this just prevents it happening at all).
    if (stripeEnabled && o.stripePaymentIntentId) {
      try { await stripe().paymentIntents.cancel(o.stripePaymentIntentId); } catch { /* already terminal / non-cancellable — fine */ }
    }
    released++;
  }
  return { released };
}

// ── Booking-funnel intent recovery (opt-in) ──
// BLD-838 / BLD-853: a one-time nudge to visitors who left their email in the
// public funnel ("email me my selection") but never completed a booking. The
// rows are anonymous — we match to a Client by email only to honour a hard
// unsubscribe; there is NO marketing enrolment. A single transactional "finish
// your booking" message under legitimate interest, gated behind
// booking_intent_recovery, sent 2–72h after capture, at most once per row.
async function bookingIntentRecovery(t: Tally) {
  try {
    const { getSetting } = await import('@/lib/settings');
    if (!(await getSetting('booking_intent_recovery'))) return;
    const base = (SITE_URL || '').replace(/\/$/, '');
    const now = Date.now();
    const rows = await db.bookingIntent.findMany({
      where: {
        emailedAt: null,
        recoveredAt: null,
        createdAt: { gte: new Date(now - 72 * 3600e3), lte: new Date(now - 2 * 3600e3) },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    for (const intent of rows) {
      // Best-effort: if this email already has a live/booked booking for this
      // treatment, they've re-engaged — don't nudge. Stamp recoveredAt so the row
      // drops out of future scans.
      const already = await db.booking.findFirst({
        where: {
          treatmentSlug: intent.treatmentSlug,
          status: { in: ['REQUESTED', 'PENDING', 'CONFIRMED', 'COMPLETED'] },
          client: { email: { equals: intent.email, mode: 'insensitive' } },
        },
        select: { id: true },
      }).catch(() => null);
      if (already) {
        await db.bookingIntent.update({ where: { id: intent.id }, data: { recoveredAt: new Date() } }).catch(() => {});
        continue;
      }
      // Consent: honour a hard unsubscribe if the email maps to a known client.
      const client = await db.client.findFirst({
        where: { email: { equals: intent.email, mode: 'insensitive' } },
        select: { id: true, email: true, firstName: true, unsubscribed: true },
      }).catch(() => null);
      if (client && !canEmailCare(client)) {
        // Suppressed for a hard unsubscribe — stamp so we don't re-check every run.
        await db.bookingIntent.update({ where: { id: intent.id }, data: { emailedAt: new Date() } }).catch(() => {});
        continue;
      }
      // Belt-and-braces dedup alongside the emailedAt stamp (mirrors the
      // abandoned-booking pattern): one BOOKING_INTENT EmailEvent per row.
      const dup = await db.emailEvent.findFirst({ where: { kind: 'BOOKING_INTENT', to: intent.email, meta: { path: ['intentId'], equals: intent.id } } });
      if (dup) { await db.bookingIntent.update({ where: { id: intent.id }, data: { emailedAt: new Date() } }).catch(() => {}); continue; }
      const resumeUrl = `${base}/book?treatment=${encodeURIComponent(intent.treatmentSlug)}`;
      const res = await sendEmail({ to: intent.email, subject: `Finish booking your ${intent.treatmentTitle}`, html: tmplAbandonedBooking({ firstName: client?.firstName || 'there', treatment: intent.treatmentTitle, resumeUrl }) });
      await db.emailEvent.create({ data: { clientId: client?.id ?? null, kind: 'BOOKING_INTENT', to: intent.email, subject: `Finish your ${intent.treatmentTitle} booking`, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { intentId: intent.id } } }).catch(() => {});
      // At-most-once: stamp emailedAt on every resolved attempt (success or fail),
      // so a soft revenue nudge is never sent twice or hammered on a bad address.
      await db.bookingIntent.update({ where: { id: intent.id }, data: { emailedAt: new Date() } }).catch(() => {});
      res.ok ? t.bookingIntents++ : t.errors++;
    }
  } catch (e) { t.errors++; console.error('[automations] booking-intent recovery failed:', (e as Error)?.message); }
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
  const month = today.getMonth() + 1;
  const day = today.getDate();
  // BLD-1043.12: filter month/day in SQL — the previous findMany({dob: {not:
  // null}}) loaded every client with any DOB into memory to filter in JS, when
  // only ~1/365th of rows actually match.
  const matches = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Client"
    WHERE dob IS NOT NULL AND EXTRACT(MONTH FROM dob) = ${month} AND EXTRACT(DAY FROM dob) = ${day}
  `;
  if (matches.length === 0) return;
  const clients = await db.client.findMany({ where: { id: { in: matches.map((m) => m.id) } } });
  for (const c of clients) {
    if (!c.dob || !canEmail(c)) continue;
    if (await sentRecently(c.id, 'BIRTHDAY', 350)) continue;
    const res = await sendEmail({ to: c.email, subject: `Happy birthday, ${c.firstName} — a gift from KClinics`, html: tmplBirthday(c.firstName, unsub(c.unsubToken)), headers: unsubHeaders(c.unsubToken) });
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
    const res = await sendEmail({ to: a.client.email, subject: `How are you after your ${a.treatmentTitle}?`, html: tmplFollowUp(a.client.firstName, a.treatmentTitle, unsub(a.client.unsubToken)), headers: unsubHeaders(a.client.unsubToken) });
    await logEvent(a.clientId, 'FOLLOW_UP', a.client.email, 'Post-treatment follow-up', res);
    res.ok ? t.followUps++ : t.errors++;
  }
}

async function reviews(t: Tally) {
  const target = new Date(Date.now() - REVIEW_DAYS * 864e5);
  const start = new Date(target); start.setHours(0, 0, 0, 0);
  const end = new Date(target); end.setHours(23, 59, 59, 999);
  const googleUrl = await googleReviewLink();
  // Deduplicate via emailEvent (Booking has no reviewSent flag; Appointment is the legacy model).
  const bookings = await db.booking.findMany({
    where: { status: 'COMPLETED', startAt: { gte: start, lte: end } },
    include: { client: true },
  });
  for (const a of bookings) {
    if (!canEmail(a.client)) continue;
    const already = await db.emailEvent.findFirst({ where: { clientId: a.clientId, kind: 'REVIEW_REQUEST', status: 'SENT', createdAt: { gte: start } } });
    if (already) continue;
    const review = await ensureReviewRequest(a.id);
    if (!review) continue;
    const res = await sendEmail({ to: a.client.email, subject: "We'd love your thoughts", html: tmplReviewRequest(a.client.firstName, reviewLink(review.token), a.treatmentTitle || undefined, googleUrl || undefined) });
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
    const res = await sendEmail({ to: b.client.email, subject: `Your aftercare for ${b.treatmentTitle}`, html: tmplAftercare(b.client.firstName, b.treatmentTitle, unsub(b.client.unsubToken)), headers: unsubHeaders(b.client.unsubToken) });
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
    const res = await sendEmail({ to: b.client.email, subject: `How are your results, ${b.client.firstName}?`, html: tmplSatisfaction(b.client.firstName, b.treatmentTitle, unsub(b.client.unsubToken)), headers: unsubHeaders(b.client.unsubToken) });
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
    const res = await sendEmail({ to: b.client.email, subject: 'Time to top up your results?', html: tmplRebook(b.client.firstName, b.treatmentTitle, unsub(b.client.unsubToken)), headers: unsubHeaders(b.client.unsubToken) });
    await db.emailEvent.create({ data: { clientId: b.clientId, kind: 'REBOOK_NUDGE', to: b.client.email, subject: 'Re-book nudge', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { bookingId: b.id } } }).catch(() => {});
    res.ok ? t.rebookNudges++ : t.errors++;
  }
}

async function winBacks(t: Tally) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - WIN_BACK_MONTHS);
  // BLD-1043.12: bounded per run, with every skip condition applied in SQL —
  // which is what makes the bound safe. `lastVisitAt` doesn't change when a
  // win-back is sent, so the oldest-lapsed-first ordering is STABLE: any client
  // fetched into the 500 and then skipped in JS (already win-backed, no
  // marketing consent, unsubscribed) would sit at the head of the list on every
  // future run and permanently starve everyone behind it. Filtering in the
  // `where` clause instead means each run picks 500 genuinely sendable clients
  // and real progress is made. The relation filter also replaces the per-row
  // sentRecently() query (N+1). canEmail() below stays as defence-in-depth.
  const since = new Date(Date.now() - 90 * 864e5);
  const clients = await db.client.findMany({
    where: {
      lastVisitAt: { not: null, lte: cutoff },
      marketingOptIn: true,
      unsubscribed: false,
      marketingConsentAt: { not: null },
      emails: { none: { kind: 'WIN_BACK', status: 'SENT', createdAt: { gte: since } } },
    },
    orderBy: { lastVisitAt: 'asc' },
    take: 500,
  });
  for (const c of clients) {
    if (!canEmail(c)) continue;
    const res = await sendEmail({ to: c.email, subject: `We've missed you, ${c.firstName}`, html: tmplWinBack(c.firstName, unsub(c.unsubToken)), headers: unsubHeaders(c.unsubToken) });
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
      const manageUrl = `${SITE_URL}/booking/manage?t=${b.manageToken}`;
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
        const sms = await sendSms(b.client.phone, `KClinics reminder: your ${b.treatmentTitle} is ${label}, ${when}. Manage: ${manageUrl}`)
          .catch((e) => ({ ok: false, error: e instanceof Error ? e.message : 'send failed' }));
        // BLD-1156: this used to only set a boolean on success — a failing SMS
        // provider was invisible next to the email branch above, which logs and
        // counts every failure. Mirror that here so SMS outages show up too.
        if (sms.ok) { delivered = true; } else { t.errors++; console.error(`[automations] SMS reminder (${label}) failed for booking ${b.id}:`, sms.error); }
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

// BLD-653: NPS promoters (score 9-10) get a thank-you email ~24h after responding,
// inviting them to leave a Google review and/or rebook. Gated on nps_survey setting
// and marketing consent (same gate as the weekly review-request automation).
async function promoterFollowUp(t: Tally) {
  try {
    const { getSetting } = await import('@/lib/settings');
    if (!(await getSetting('nps_survey'))) return;
    const now = Date.now();
    // 3-day overlapping lookback. The per-npsId dedup prevents double-send;
    // the generous window ensures a late or skipped cron run doesn't permanently
    // miss a promoter (unlike a tight [now-2d, now-1d] window that has no recovery).
    const from = new Date(now - 3 * 864e5);
    const responses = await db.npsResponse.findMany({
      where: { score: { gte: 9 }, respondedAt: { gte: from, lte: new Date(now) }, clientId: { not: null } },
      include: { client: { select: { id: true, email: true, firstName: true, unsubscribed: true, marketingOptIn: true, marketingConsentAt: true, unsubToken: true } } },
      take: 200,
    });
    const googleUrl = await googleReviewLink();
    const base = (SITE_URL || '').replace(/\/$/, '');
    for (const r of responses) {
      const c = r.client;
      if (!c || !canEmail(c)) continue;
      const dup = await db.emailEvent.findFirst({ where: { clientId: c.id, kind: 'NPS_PROMOTER', status: 'SENT', meta: { path: ['npsId'], equals: r.id } } });
      if (dup) continue;
      const googleCta = googleUrl
        ? `<p style="margin:6px 0 10px;"><a href="${googleUrl}" style="display:inline-block;background:#a98a6d;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;">Leave a Google review</a></p>`
        : '';
      const body = `
        <h1 style="margin:0 0 12px;font-size:25px;">Thank you, ${escapeHtml(c.firstName || 'there')} — you've made our day</h1>
        <p style="margin:0 0 14px;">We're so glad to hear you had a great experience with us. Reviews like yours help other people find us — if you have a moment, we'd love you to share your thoughts.</p>
        ${googleCta}
        <p style="margin:14px 0 6px;font-size:14px;color:#91766e;">Or, <a href="${base}/book" style="color:#a98a6d;">book your next visit</a> whenever you're ready — we look forward to seeing you again.</p>`;
      const res = await sendEmail({ to: c.email, subject: `Thank you, ${c.firstName || 'there'} — you've made our day`, html: emailShell({ body, preheader: `We'd love you to share your experience.`, unsubUrl: unsub(c.unsubToken) }), headers: unsubHeaders(c.unsubToken) });
      await db.emailEvent.create({ data: { clientId: c.id, kind: 'NPS_PROMOTER', to: c.email, subject: 'NPS promoter follow-up', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { npsId: r.id } } }).catch(() => {});
      res.ok ? t.npsPromoters++ : t.errors++;
    }
  } catch (e) { t.errors++; console.error('[automations] NPS promoter follow-up failed:', (e as Error)?.message); }
}

// BLD-800: NPS detractors (score 0-6) get a same-tone service-recovery email ~24h
// after responding — an apology and a direct way to reach the clinic, mirroring the
// care shown to promoters but with no review/rebook ask. Care-class (canEmailCare),
// not gated on marketing consent — this is service recovery, not marketing.
async function detractorFollowUp(t: Tally) {
  try {
    const { getSetting } = await import('@/lib/settings');
    if (!(await getSetting('nps_survey'))) return;
    const now = Date.now();
    const from = new Date(now - 3 * 864e5);
    const responses = await db.npsResponse.findMany({
      where: { score: { lte: 6 }, respondedAt: { gte: from, lte: new Date(now) }, clientId: { not: null } },
      include: { client: { select: { id: true, email: true, firstName: true, unsubscribed: true } } },
      take: 200,
    });
    for (const r of responses) {
      const c = r.client;
      if (!c || !canEmailCare(c)) continue;
      const dup = await db.emailEvent.findFirst({ where: { clientId: c.id, kind: 'NPS_DETRACTOR', status: 'SENT', meta: { path: ['npsId'], equals: r.id } } });
      if (dup) continue;
      const body = `
        <h1 style="margin:0 0 12px;font-size:25px;">${escapeHtml(c.firstName || 'Hello')}, we&rsquo;re sorry we fell short</h1>
        <p style="margin:0 0 14px;">Thank you for the honest feedback — it matters, and we&rsquo;d like the chance to put things right. Please reply to this email or call us on 020 8050 0750 and we&rsquo;ll do everything we can to help.</p>`;
      const res = await sendEmail({ to: c.email, subject: `${c.firstName || 'Hello'}, we'd like to make this right`, html: emailShell({ body, preheader: `We'd like the chance to put things right.` }) });
      await db.emailEvent.create({ data: { clientId: c.id, kind: 'NPS_DETRACTOR', to: c.email, subject: 'NPS detractor follow-up', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error, meta: { npsId: r.id } } }).catch(() => {});
      res.ok ? t.npsDetractors++ : t.errors++;
    }
  } catch (e) { t.errors++; console.error('[automations] NPS detractor follow-up failed:', (e as Error)?.message); }
}

// BLD-1034: same-day reminder for enrolled students on a live class starting
// today. The class-lookup + email/dedup work lives in lib/academy-live-class.ts
// (also used by the create/reschedule/cancel notices), so this job is a thin
// wrapper that folds its tally into the shared daily-automations run.
async function liveClassReminders(t: Tally) {
  try {
    const { sendLiveClassSameDayReminders } = await import('@/lib/academy-live-class');
    const res = await sendLiveClassSameDayReminders();
    t.liveClassReminders += res.sent;
    t.errors += res.errors;
  } catch (e) { t.errors++; console.error('[automations] live-class reminders failed:', (e as Error)?.message); }
}

async function logEvent(clientId: string, kind: 'BIRTHDAY' | 'FOLLOW_UP' | 'WIN_BACK' | 'REVIEW_REQUEST' | 'APPOINTMENT_REMINDER' | 'FORM_REMINDER', to: string, subject: string, res: { ok: boolean; id?: string; error?: string }) {
  await db.emailEvent.create({
    data: { clientId, kind, to, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error },
  });
  if (res.ok) await db.interaction.create({ data: { clientId, type: 'EMAIL', summary: `Automated email: ${subject}`, author: 'system' } });
}
