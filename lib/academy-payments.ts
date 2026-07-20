import 'server-only';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { getActivePromo } from '@/lib/academy-utils';

// ─────────────────────────────────────────────────────────────────────────────
// BLD-528 — Academy enrolment + payment engine
//
// The journey: a learner applies → staff review and make an OFFER → the learner
// accepts & pays online (full or deposit) or staff set up an in-house instalment
// plan. Paying (full or deposit) flips the enrolment to PAID, which is what
// `studentCanAccess` (lib/lms.ts) checks to unlock course content.
//
// Money model: every payment / scheduled instalment is one EnrolmentPayment row.
// `Enrolment.paidPence` is the running total of PAID rows and stays the single
// source of truth used across the portal and admin. Online card / Klarna /
// Clearpay payments go through Stripe (a PaymentIntent with automatic payment
// methods, so card + BNPL appear when enabled on the account). Balances and
// instalments after the first payment are collected manually by staff, who mark
// each row paid.
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'CARD' | 'BNPL' | 'BANK_TRANSFER' | 'CASH' | 'OTHER';
export type PaymentKind = 'FULL' | 'DEPOSIT' | 'BALANCE' | 'INSTALMENT';
export type PaymentState = 'SCHEDULED' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

/** The effective fee the learner pays: an active promo overrides the captured
 *  list price (honest pricing — never charge above the live promotional price). */
export function effectiveFeePence(enrolment: { pricePence: number }, course: { promoPrice: number | null; promoStartAt: Date | null; promoEndAt: Date | null }): number {
  const promo = getActivePromo(course);
  if (promo != null && promo < enrolment.pricePence) return promo;
  return enrolment.pricePence;
}

export type EnrolmentPaymentRow = {
  id: string; kind: PaymentKind; method: PaymentMethod | null; state: PaymentState;
  amountPence: number; dueAt: string | null; paidAt: string | null; note: string | null; recordedBy: string | null; createdAt: string;
};
export type EnrolmentMoney = {
  feePence: number; paidPence: number; outstandingPence: number; depositPence: number | null;
  hasPlan: boolean; nextDue: { amountPence: number; dueAt: string } | null;
  payments: EnrolmentPaymentRow[];
};

/** Payment view for one enrolment (portal + admin). Pulls the itemised history. */
export async function enrolmentMoney(enrolmentId: string): Promise<EnrolmentMoney | null> {
  const e = await db.enrolment.findUnique({
    where: { id: enrolmentId },
    select: { pricePence: true, paidPence: true, paymentPlan: true, course: { select: { depositPence: true, promoPrice: true, promoStartAt: true, promoEndAt: true } } },
  });
  if (!e) return null;
  const fee = effectiveFeePence(e, e.course);
  const rows = await db.enrolmentPayment.findMany({ where: { enrolmentId }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }] });
  const payments: EnrolmentPaymentRow[] = rows.map((p) => ({
    id: p.id, kind: p.kind as PaymentKind, method: p.method as PaymentMethod | null, state: p.state as PaymentState,
    amountPence: p.amountPence, dueAt: p.dueAt?.toISOString() ?? null, paidAt: p.paidAt?.toISOString() ?? null, note: p.note, recordedBy: p.recordedBy, createdAt: p.createdAt.toISOString(),
  }));
  const upcoming = rows
    .filter((p) => (p.state === 'SCHEDULED' || p.state === 'PENDING') && p.dueAt)
    .sort((a, b) => +(a.dueAt as Date) - +(b.dueAt as Date))[0];
  return {
    feePence: fee, paidPence: e.paidPence, outstandingPence: Math.max(0, fee - e.paidPence), depositPence: e.course.depositPence,
    hasPlan: e.paymentPlan, nextDue: upcoming?.dueAt ? { amountPence: upcoming.amountPence, dueAt: (upcoming.dueAt as Date).toISOString() } : null,
    payments,
  };
}

// ── Manual enrolment (staff add a student to a course) ──────────────────────

const ENROLMENT_STATUSES = ['APPLIED', 'OFFERED', 'PAID', 'ENROLLED', 'COMPLETED', 'CANCELLED'] as const;
type EnrolStatus = (typeof ENROLMENT_STATUSES)[number];

/** Staff add a learner directly onto a course (and optionally a cohort), creating
 *  or reusing their trainee account by email. Defaults to ENROLLED so content
 *  unlocks immediately; can email a one-click portal link. */
export async function enrolStudentManually(input: { courseId: string; cohortId?: string | null; email: string; name?: string; phone?: string; status?: string; pricePence?: number; sendLink?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const email = (input.email || '').trim().toLowerCase();
  if (!email || !/\S+@\S+\.\S+/.test(email)) return { ok: false, error: 'Enter a valid email.' };
  const course = await db.course.findUnique({ where: { id: input.courseId }, select: { id: true, tenantId: true, pricePence: true, title: true } });
  if (!course) return { ok: false, error: 'Course not found.' };
  const status: EnrolStatus = ENROLMENT_STATUSES.includes(input.status as EnrolStatus) ? (input.status as EnrolStatus) : 'ENROLLED';

  const { ensureStudentForOffer } = await import('@/lib/academy-auth');
  const [firstName, ...rest] = (input.name || email.split('@')[0]).trim().split(/\s+/);
  const student = await ensureStudentForOffer({ tenantId: course.tenantId, email, firstName, lastName: rest.join(' ') || null, phone: input.phone || null });

  // Avoid a duplicate enrolment on the same course for the same student.
  const existing = await db.enrolment.findFirst({ where: { studentId: student.id, courseId: course.id, status: { notIn: ['CANCELLED'] } }, select: { id: true } });
  if (existing) return { ok: false, error: 'That student is already enrolled on this course.' };

  await db.enrolment.create({
    data: {
      tenantId: course.tenantId, courseId: course.id, cohortId: input.cohortId || null, studentId: student.id,
      applicantName: input.name?.trim() || student.firstName, applicantEmail: email, applicantPhone: input.phone || null,
      status, pricePence: input.pricePence != null ? Math.max(0, Math.round(input.pricePence)) : course.pricePence,
      ...(status === 'PAID' || status === 'ENROLLED' || status === 'COMPLETED' ? { acceptedAt: new Date() } : {}),
    },
  });
  if (input.sendLink) {
    const { sendAccessLink } = await import('@/lib/academy-auth');
    await sendAccessLink(student.id).catch(() => {});
  }
  return { ok: true };
}

// ── Offer (staff confirm a place) ───────────────────────────────────────────

const siteBase = () => process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://kclinics.co.uk';

/** Make an offer to an applicant: ensure they have a trainee account, link the
 *  enrolment, set status OFFERED, and email a one-click "accept & pay" link that
 *  signs them in and lands them on the pay page. */
export async function makeOffer(enrolmentId: string, opts: { staffEmail?: string; expiresInDays?: number } = {}): Promise<{ ok: boolean; error?: string }> {
  const e = await db.enrolment.findUnique({
    where: { id: enrolmentId },
    select: {
      id: true, tenantId: true, studentId: true, status: true, pricePence: true,
      applicantEmail: true, applicantName: true, applicantPhone: true,
      course: { select: { title: true, slug: true, depositPence: true, promoPrice: true, promoStartAt: true, promoEndAt: true } },
    },
  });
  if (!e) return { ok: false, error: 'Enrolment not found.' };
  if (e.status === 'COMPLETED' || e.status === 'CANCELLED') return { ok: false, error: `Can’t offer a ${e.status.toLowerCase()} enrolment.` };

  const { ensureStudentForOffer, createAcademyInvite } = await import('@/lib/academy-auth');
  // Use the already-linked trainee account if there is one; otherwise find-or-create
  // by the applicant's email. The offer email + activation link target this account.
  let student: { id: string; email: string; firstName: string };
  if (e.studentId) {
    const linked = await db.academyStudent.findUnique({ where: { id: e.studentId }, select: { id: true, email: true, firstName: true } });
    if (linked) student = linked;
    else { const [firstName, ...rest] = (e.applicantName || 'there').trim().split(/\s+/); student = await ensureStudentForOffer({ tenantId: e.tenantId, email: e.applicantEmail, firstName, lastName: rest.join(' ') || null, phone: e.applicantPhone }); }
  } else {
    const [firstName, ...rest] = (e.applicantName || 'there').trim().split(/\s+/);
    student = await ensureStudentForOffer({ tenantId: e.tenantId, email: e.applicantEmail, firstName, lastName: rest.join(' ') || null, phone: e.applicantPhone });
  }

  const offerExpiresAt = opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * 864e5) : null;
  await db.enrolment.update({
    where: { id: e.id },
    data: { status: 'OFFERED', offeredAt: new Date(), offerExpiresAt, ...(e.studentId ? {} : { studentId: student.id }) },
  });

  const token = await createAcademyInvite(student.id);
  const next = encodeURIComponent(`/academy/pay/${e.id}`);
  const acceptUrl = token ? `${siteBase()}/academy/activate?token=${token}&id=${student.id}&next=${next}` : `${siteBase()}/academy/portal`;

  try {
    const { sendEmail, tmplAcademyOffer } = await import('@/lib/email');
    await sendEmail({
      to: student.email,
      subject: `Your place on ${e.course.title} — accept & pay`,
      html: tmplAcademyOffer({ firstName: student.firstName, courseTitle: e.course.title, pricePence: effectiveFeePence(e, e.course), depositPence: e.course.depositPence, acceptUrl, expiresAt: offerExpiresAt }),
    });
  } catch { /* email failure must not fail the offer */ }
  return { ok: true };
}

/** Map a Stripe payment-method type to our enum. */
function methodFromType(type?: string | null): PaymentMethod {
  if (type === 'card') return 'CARD';
  if (type === 'klarna' || type === 'afterpay_clearpay') return 'BNPL';
  return 'OTHER';
}

export type StartResult =
  | { ok: true; clientSecret: string; paymentId: string; amountPence: number }
  | { ok: false; error: string; status?: number };

/** Begin an online payment for an enrolment the learner owns. `mode` is the whole
 *  outstanding balance ('full') or the course deposit ('deposit'). Creates a
 *  PENDING EnrolmentPayment + a Stripe PaymentIntent (card + Klarna/Clearpay via
 *  automatic_payment_methods) and returns the client secret. Server re-prices —
 *  the client never supplies an amount. */
export async function startEnrolmentPayment(studentId: string, enrolmentId: string, mode: 'full' | 'deposit'): Promise<StartResult> {
  const e = await db.enrolment.findUnique({
    where: { id: enrolmentId },
    select: {
      id: true, studentId: true, status: true, pricePence: true, paidPence: true, tenantId: true,
      applicantEmail: true, applicantName: true,
      course: { select: { title: true, depositPence: true, promoPrice: true, promoStartAt: true, promoEndAt: true } },
    },
  });
  if (!e || e.studentId !== studentId) return { ok: false, error: 'Enrolment not found.', status: 404 };
  if (e.status === 'CANCELLED') return { ok: false, error: 'This enrolment has been cancelled.', status: 409 };
  if (e.status === 'APPLIED') return { ok: false, error: 'Your place hasn’t been confirmed yet — we’ll email you when it’s ready to pay.', status: 409 };

  const fee = effectiveFeePence(e, e.course);
  const outstanding = Math.max(0, fee - e.paidPence);
  if (outstanding <= 0) return { ok: false, error: 'This course is already paid in full.', status: 409 };

  let amountPence = outstanding;
  let kind: PaymentKind = e.paidPence > 0 ? 'BALANCE' : 'FULL';
  if (mode === 'deposit') {
    const dep = e.course.depositPence ?? 0;
    if (dep <= 0) return { ok: false, error: 'A deposit isn’t available for this course.', status: 409 };
    amountPence = Math.min(dep, outstanding);
    kind = 'DEPOSIT';
  }

  const { stripe, stripeEnabled } = await import('@/lib/stripe');
  if (!stripeEnabled) return { ok: false, error: 'Payments aren’t available right now.', status: 503 };

  // BLD-762: a double-tap or slow-network retry on "Pay in full" must not mint a
  // second live PaymentIntent for the same course fee. Reuse a still-open PENDING
  // attempt for this exact kind+amount if one already exists.
  const pending = await db.enrolmentPayment.findFirst({
    where: { enrolmentId: e.id, kind, amountPence, state: 'PENDING' },
    select: { id: true, stripePaymentIntentId: true },
    orderBy: { createdAt: 'desc' },
  });
  if (pending?.stripePaymentIntentId) {
    try {
      const existingPi = await stripe().paymentIntents.retrieve(pending.stripePaymentIntentId);
      if (existingPi.client_secret && existingPi.status !== 'canceled' && existingPi.status !== 'succeeded') {
        return { ok: true, clientSecret: existingPi.client_secret, paymentId: pending.id, amountPence };
      }
    } catch { /* Stripe lookup failed — fall through and start a fresh attempt */ }
  }

  const payment = await db.enrolmentPayment.create({
    data: { tenantId: e.tenantId, enrolmentId: e.id, kind, amountPence, state: 'PENDING' },
    select: { id: true },
  });

  try {
    const pi = await stripe().paymentIntents.create(
      {
        amount: amountPence,
        currency: 'gbp',
        // Card + Klarna/Clearpay surface automatically when enabled on the Stripe
        // account and the intent is eligible (GBP, GB customer, amount in range).
        automatic_payment_methods: { enabled: true },
        description: `K Academy — ${e.course.title} (${kind.toLowerCase()})`,
        receipt_email: e.applicantEmail || undefined,
        metadata: { kind: 'enrolment', enrolmentId: e.id, paymentId: payment.id },
      },
      // Stable across concurrent requests for the same kind+amount (unlike the old
      // key derived from the freshly-created row id), so a race that slips past the
      // PENDING check above still collapses to one PaymentIntent at Stripe.
      { idempotencyKey: `enrol-pay-${e.id}-${kind}-${amountPence}` },
    );
    await db.enrolmentPayment.update({ where: { id: payment.id }, data: { stripePaymentIntentId: pi.id } });
    return { ok: true, clientSecret: pi.client_secret as string, paymentId: payment.id, amountPence };
  } catch (err) {
    await db.enrolmentPayment.delete({ where: { id: payment.id } }).catch(() => {});
    return { ok: false, error: (err as Error).message || 'Could not start the payment.', status: 500 };
  }
}

/** Idempotently finalise an online enrolment payment. Called by BOTH the Stripe
 *  webhook and the synchronous confirm endpoint, so a closed tab still completes.
 *  Validates currency + that the captured amount covers the row, claims the row
 *  (state PENDING → PAID) so redeliveries are no-ops, advances paidPence + status
 *  and notifies staff. */
export async function finalizeEnrolmentPayment(piId: string, amountReceivedPence: number, currency: string, methodType?: string | null): Promise<{ ok: boolean; enrolmentId?: string; courseSlug?: string }> {
  const payment = await db.enrolmentPayment.findFirst({
    where: { stripePaymentIntentId: piId },
    select: { id: true, enrolmentId: true, amountPence: true, state: true },
  });
  if (!payment) return { ok: false };
  if (currency !== 'gbp' || amountReceivedPence < payment.amountPence) {
    console.error('[academy-pay] not finalising — amount/currency mismatch:', { piId, received: amountReceivedPence, expected: payment.amountPence, currency });
    return { ok: false };
  }
  // Claim + apply ATOMICALLY (BLD-885): the claim (PENDING → PAID) and the
  // enrolment advance (paidPence/status/acceptedAt) used to be two separate
  // writes — a crash between them left the payment permanently PAID with the
  // student still locked out, and the redelivery branch below treated "already
  // claimed" as "already applied" so it could never self-heal. One transaction
  // means PAID now implies the enrolment advanced.
  const tx = await db.$transaction(async (t) => {
    const claimed = await t.enrolmentPayment.updateMany({
      where: { id: payment.id, state: 'PENDING' },
      data: { state: 'PAID', paidAt: new Date(), method: methodFromType(methodType) },
    });
    if (claimed.count === 0) return { claimed: false as const, updated: null }; // redelivery — nothing to apply
    return { claimed: true as const, updated: await applyPaidPayment(payment.enrolmentId, payment.amountPence, t) };
  });
  const updated = tx.updated;
  if (!tx.claimed) {
    // Already finalised (redelivery). Resolve the slug so the confirm endpoint can redirect.
    const e = await db.enrolment.findUnique({ where: { id: payment.enrolmentId }, select: { course: { select: { slug: true } } } });
    return { ok: true, enrolmentId: payment.enrolmentId, courseSlug: e?.course.slug };
  }
  await notifyPaymentReceived(payment.enrolmentId, payment.amountPence).catch(() => {});
  await sendPaymentReceipt(payment.enrolmentId, payment.amountPence).catch(() => {});
  await logAudit({
    action: 'PAYMENT_CHARGED',
    actor: 'system',
    enrolmentId: payment.enrolmentId,
    summary: `Academy payment £${(payment.amountPence / 100).toFixed(2)} confirmed via Stripe`,
    meta: { amountPence: payment.amountPence, piId, methodType },
  }).catch(() => {});
  return { ok: true, enrolmentId: payment.enrolmentId, courseSlug: updated?.courseSlug };
}

/** Email the learner a payment confirmation with any outstanding balance. Best-effort. */
async function sendPaymentReceipt(enrolmentId: string, amountPence: number): Promise<void> {
  const e = await db.enrolment.findUnique({
    where: { id: enrolmentId },
    select: { applicantEmail: true, applicantName: true, pricePence: true, paidPence: true, course: { select: { title: true, promoPrice: true, promoStartAt: true, promoEndAt: true } } },
  });
  if (!e?.applicantEmail) return;
  const fee = effectiveFeePence(e, e.course);
  const { sendEmail, tmplAcademyPaymentReceipt } = await import('@/lib/email');
  await sendEmail({
    to: e.applicantEmail,
    subject: `Payment received — ${e.course.title}`,
    html: tmplAcademyPaymentReceipt({ firstName: (e.applicantName || 'there').split(/\s+/)[0], courseTitle: e.course.title, amountPence, outstandingPence: Math.max(0, fee - e.paidPence), portalUrl: `${siteBase()}/academy/portal` }),
  });
}

/** Advance an enrolment after a payment is marked PAID: bump paidPence, set
 *  acceptedAt, and move APPLIED/OFFERED → PAID (never downgrade ENROLLED/COMPLETED). */
// Accepts a transaction client so finalizeEnrolmentPayment can run the claim
// and this advance atomically (BLD-885); defaults to the plain client for the
// staff-action call sites that have their own idempotency.
async function applyPaidPayment(enrolmentId: string, amountPence: number, client: Pick<typeof db, 'enrolment'> = db): Promise<{ courseSlug?: string } | null> {
  const e = await client.enrolment.findUnique({ where: { id: enrolmentId }, select: { status: true, acceptedAt: true, course: { select: { slug: true } } } });
  if (!e) return null;
  const advance = e.status === 'APPLIED' || e.status === 'OFFERED';
  await client.enrolment.update({
    where: { id: enrolmentId },
    data: {
      paidPence: { increment: amountPence },
      ...(advance ? { status: 'PAID' } : {}),
      ...(e.acceptedAt ? {} : { acceptedAt: new Date() }),
    },
  });
  return { courseSlug: e.course.slug };
}

/** In-app staff notification when an academy payment lands. Best-effort. */
async function notifyPaymentReceived(enrolmentId: string, amountPence: number): Promise<void> {
  const e = await db.enrolment.findUnique({ where: { id: enrolmentId }, select: { applicantName: true, course: { select: { title: true } } } });
  if (!e) return;
  const { notifyStaffByPermission } = await import('@/lib/notifications');
  await notifyStaffByPermission('settings.manage', {
    kind: 'status', category: 'academy', priority: 'high',
    title: 'Academy payment received',
    body: `£${(amountPence / 100).toLocaleString('en-GB')} from ${e.applicantName} — ${e.course.title}`,
    href: '/admin/academy/enrolments',
    groupKey: `academy-pay-${enrolmentId}`,
  });
}

// ── Staff (admin) money actions ─────────────────────────────────────────────

/** Record a payment collected offline (cash / transfer / manual card / a paid
 *  instalment taken by phone). Creates a PAID row and advances the enrolment. */
export async function recordManualPayment(enrolmentId: string, input: { amountPence: number; kind: PaymentKind; method: PaymentMethod; note?: string; staffEmail?: string }): Promise<{ ok: boolean; error?: string }> {
  const amount = Math.round(input.amountPence);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
  const e = await db.enrolment.findUnique({ where: { id: enrolmentId }, select: { tenantId: true } });
  if (!e) return { ok: false, error: 'Enrolment not found.' };
  await db.enrolmentPayment.create({
    data: { tenantId: e.tenantId, enrolmentId, kind: input.kind, method: input.method, state: 'PAID', amountPence: amount, paidAt: new Date(), note: input.note?.slice(0, 300) || null, recordedBy: input.staffEmail || null },
  });
  await applyPaidPayment(enrolmentId, amount);
  return { ok: true };
}

/** Mark a scheduled / pending instalment (or any non-paid row) as collected. */
export async function markPaymentPaid(paymentId: string, method: PaymentMethod, staffEmail?: string): Promise<{ ok: boolean; error?: string }> {
  const p = await db.enrolmentPayment.findUnique({ where: { id: paymentId }, select: { id: true, enrolmentId: true, amountPence: true, state: true } });
  if (!p) return { ok: false, error: 'Payment not found.' };
  const claimed = await db.enrolmentPayment.updateMany({
    where: { id: p.id, state: { in: ['SCHEDULED', 'PENDING', 'FAILED'] } },
    data: { state: 'PAID', paidAt: new Date(), method, recordedBy: staffEmail || null },
  });
  if (claimed.count === 0) return { ok: false, error: 'That payment is already settled.' };
  await applyPaidPayment(p.enrolmentId, p.amountPence);
  return { ok: true };
}

/** Set up an in-house instalment plan: split the outstanding balance into `count`
 *  monthly SCHEDULED rows from `startDate`. Staff mark each paid as it's collected. */
export async function createInstalmentPlan(enrolmentId: string, input: { count: number; startDate: string; staffEmail?: string }): Promise<{ ok: boolean; error?: string }> {
  const count = Math.max(2, Math.min(36, Math.round(input.count)));
  const start = new Date(input.startDate);
  if (Number.isNaN(+start)) return { ok: false, error: 'Enter a valid start date.' };
  const e = await db.enrolment.findUnique({
    where: { id: enrolmentId },
    select: { tenantId: true, pricePence: true, paidPence: true, course: { select: { promoPrice: true, promoStartAt: true, promoEndAt: true } } },
  });
  if (!e) return { ok: false, error: 'Enrolment not found.' };
  const fee = effectiveFeePence(e, e.course);
  const outstanding = Math.max(0, fee - e.paidPence);
  if (outstanding <= 0) return { ok: false, error: 'There’s nothing left to schedule — this course is paid in full.' };
  // Clear any existing unpaid schedule first so re-planning is clean.
  await db.enrolmentPayment.deleteMany({ where: { enrolmentId, state: { in: ['SCHEDULED'] } } });
  const per = Math.floor(outstanding / count);
  const rows = Array.from({ length: count }, (_, i) => {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    const amount = i === count - 1 ? outstanding - per * (count - 1) : per;
    return { tenantId: e.tenantId, enrolmentId, kind: 'INSTALMENT' as const, state: 'SCHEDULED' as const, amountPence: amount, dueAt: due };
  });
  await db.enrolmentPayment.createMany({ data: rows });
  // Agreeing a plan secures the place — unlock access (APPLIED/OFFERED → PAID), so
  // the learner can start their theory while paying the balance off. acceptedAt
  // marks when they committed.
  const cur = await db.enrolment.findUnique({ where: { id: enrolmentId }, select: { status: true, acceptedAt: true } });
  const advance = cur?.status === 'APPLIED' || cur?.status === 'OFFERED';
  await db.enrolment.update({
    where: { id: enrolmentId },
    data: { paymentPlan: true, ...(advance ? { status: 'PAID' } : {}), ...(cur?.acceptedAt ? {} : { acceptedAt: new Date() }) },
  });
  return { ok: true };
}

/** Issue a Stripe refund for a PAID online academy payment and mark it REFUNDED. */
export async function refundEnrolmentPayment(paymentId: string, staffEmail?: string): Promise<{ ok: boolean; error?: string }> {
  const p = await db.enrolmentPayment.findUnique({
    where: { id: paymentId },
    select: { id: true, enrolmentId: true, amountPence: true, state: true, stripePaymentIntentId: true },
  });
  if (!p) return { ok: false, error: 'Payment not found.' };
  if (p.state !== 'PAID') return { ok: false, error: 'Only PAID payments can be refunded.' };
  if (!p.stripePaymentIntentId) return { ok: false, error: 'No Stripe charge on this payment — use Remove to correct it instead.' };
  const { stripe, stripeEnabled } = await import('@/lib/stripe');
  if (!stripeEnabled) return { ok: false, error: 'Stripe is not configured.' };
  try {
    await stripe().refunds.create(
      { payment_intent: p.stripePaymentIntentId, metadata: { paymentId, enrolmentId: p.enrolmentId } },
      { idempotencyKey: `academy-refund-${p.id}` },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Refund failed at Stripe.' };
  }
  // BLD-869: stamp the refundedPence watermark here too, so the webhook's
  // charge.refunded echo of THIS refund computes a zero delta instead of
  // decrementing paidPence a second time (its metadata carries paymentId, not
  // bookingId/orderId, so the originatedInApp skip doesn't catch it).
  const claimed = await db.enrolmentPayment.updateMany({ where: { id: p.id, state: 'PAID' }, data: { state: 'REFUNDED', refundedPence: p.amountPence } });
  if (claimed.count === 0) return { ok: true };
  await db.enrolment.update({ where: { id: p.enrolmentId }, data: { paidPence: { decrement: p.amountPence } } }).catch(() => {});
  await logAudit({
    action: 'PAYMENT_REFUNDED',
    actor: staffEmail || 'admin',
    enrolmentId: p.enrolmentId,
    summary: `Academy payment £${(p.amountPence / 100).toFixed(2)} refunded via Stripe`,
    meta: { paymentId, amountPence: p.amountPence },
  }).catch(() => {});
  return { ok: true };
}

/** PRJ-918.12: reconcile an academy payment refunded directly in the Stripe
 *  dashboard (out-of-band — bypasses refundEnrolmentPayment above). Mirrors
 *  that function's DB-side effects (payment row → REFUNDED, Enrolment.paidPence
 *  rolled back, audit log) without re-issuing the Stripe refund (already done)
 *  or requiring a staff actor — this runs from the webhook, which has no
 *  request/admin context, so the audit entry is attributed to the webhook
 *  itself. Idempotent via the PAID → REFUNDED CAS: a redelivered webhook event,
 *  or one that arrives after an in-app refund already completed, is a no-op. */
export async function reconcileEnrolmentPaymentRefund(piId: string, totalRefundedPence?: number): Promise<void> {
  // BLD-869: delta-aware — a partial dashboard refund used to be dropped
  // entirely (the webhook only called this once a charge was FULLY refunded),
  // and a full one reversed the whole amountPence in one shot with no
  // watermark. Now Stripe's cumulative amount_refunded is CAS-tracked on
  // refundedPence (mirroring Booking/GiftVoucher), each call reconciles only
  // the unrecorded delta, and the row flips to REFUNDED only once the whole
  // payment is back. Legacy callers that pass no amount reconcile in full.
  for (let attempt = 0; attempt < 3; attempt++) {
    const payment = await db.enrolmentPayment.findFirst({
      where: { stripePaymentIntentId: piId, state: { in: ['PAID', 'REFUNDED'] } },
      select: { id: true, enrolmentId: true, amountPence: true, refundedPence: true, state: true },
    });
    if (!payment) return;
    // Legacy guard: rows refunded before the watermark existed are REFUNDED
    // with refundedPence=0 and already had paidPence fully reversed — a late
    // webhook redelivery must not reverse them again.
    if (payment.state === 'REFUNDED' && (payment.refundedPence ?? 0) === 0) return;
    const target = Math.min(payment.amountPence, totalRefundedPence ?? payment.amountPence);
    const delta = target - (payment.refundedPence ?? 0);
    if (delta <= 0) return; // already reconciled to (or past) this watermark
    const fully = target >= payment.amountPence;
    const claimed = await db.enrolmentPayment.updateMany({
      where: { id: payment.id, refundedPence: payment.refundedPence },
      data: { refundedPence: target, ...(fully ? { state: 'REFUNDED' } : {}) },
    });
    if (claimed.count === 0) continue; // lost the race — re-read and retry
    await db.enrolment.update({ where: { id: payment.enrolmentId }, data: { paidPence: { decrement: delta } } }).catch(() => {});
    await logAudit({
      action: 'PAYMENT_REFUNDED',
      actor: 'stripe-webhook',
      enrolmentId: payment.enrolmentId,
      summary: `Academy payment refund £${(delta / 100).toFixed(2)}${fully ? ' (full)' : ' (partial)'} reconciled from Stripe`,
      meta: { paymentId: payment.id, deltaPence: delta, totalRefundedPence: target, piId },
    }).catch(() => {});
    return;
  }
  throw new Error(`enrolment refund CAS conflict persisted for PI ${piId} — deferring to Stripe redelivery`);
}

/** Delete a payment/instalment row. If it was PAID, roll back paidPence so the
 *  ledger stays correct (for corrections). Blocked for a row that was actually
 *  charged via Stripe — removing it would leave the customer charged with no
 *  ledger record of it; Refund (which reverses the Stripe charge) must be used
 *  first. */
export async function removePayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
  const p = await db.enrolmentPayment.findUnique({ where: { id: paymentId }, select: { id: true, enrolmentId: true, amountPence: true, state: true, stripePaymentIntentId: true } });
  if (!p) return { ok: true };
  if (p.state === 'PAID' && p.stripePaymentIntentId) {
    return { ok: false, error: 'This payment was charged via Stripe — use Refund first, then remove the row.' };
  }
  await db.enrolmentPayment.delete({ where: { id: p.id } });
  if (p.state === 'PAID') {
    await db.enrolment.update({ where: { id: p.enrolmentId }, data: { paidPence: { decrement: p.amountPence } } }).catch(() => {});
  }
  // If no scheduled rows remain, the plan is no longer active.
  const remaining = await db.enrolmentPayment.count({ where: { enrolmentId: p.enrolmentId, state: 'SCHEDULED' } });
  if (remaining === 0) await db.enrolment.update({ where: { id: p.enrolmentId }, data: { paymentPlan: false } }).catch(() => {});
  return { ok: true };
}
