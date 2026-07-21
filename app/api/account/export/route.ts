import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Client self-service data export (GDPR subject access). Returns the signed-in
// client's own record as JSON. Secrets are never included; clinical answers are
// summarised (the encrypted detail is shared by the clinic on request, with
// identity checks) — this gives the client their account + booking history.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getClientSession } = await import('@/lib/auth');
  const session = await getClientSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'export', 5, 3600))) {
    return NextResponse.json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const { db } = await import('@/lib/db');
  // PRJ-1032.21: a complete Art. 15/20 response covers every category of the
  // subject's own personal data, not just account + bookings. All the non-
  // clinical records are included here; clinical/special-category detail
  // (consultation notes, health-form answers, before/after photos, call
  // transcripts) stays on the verified subject-access request, exactly as the
  // healthForms line already did — only its metadata is self-served. Every
  // select below lists non-encrypted columns only, so no ciphertext is touched.
  const c = await db.client.findUnique({
    where: { id: session.sub },
    include: {
      bookings: { orderBy: { startAt: 'desc' }, select: { treatmentTitle: true, startAt: true, status: true, chargedPence: true, chargedAt: true } },
      assessments: { orderBy: { submittedAt: 'desc' }, select: { type: true, version: true, submittedAt: true, sourceLocale: true } },
      discountClaims: { select: { code: true, percent: true, status: true, createdAt: true } },
      emails: { orderBy: { createdAt: 'desc' }, take: 50, select: { kind: true, subject: true, status: true, createdAt: true } },
      // Enquiries — metadata only (the message / concerns / medical notes are
      // clinical free-text, encrypted at rest, and stay on the verified request).
      consultations: { orderBy: { createdAt: 'desc' }, select: { category: true, treatments: true, status: true, createdAt: true } },
      reviews: { orderBy: { createdAt: 'desc' }, select: { rating: true, title: true, body: true, treatmentTitle: true, displayConsent: true, status: true, submittedAt: true, createdAt: true } },
      points: { orderBy: { createdAt: 'desc' }, select: { points: true, category: true, reason: true, expiresAt: true, createdAt: true } },
      npsResponses: { orderBy: { sentAt: 'desc' }, select: { score: true, comment: true, treatment: true, sentAt: true, respondedAt: true } },
      waitlist: { orderBy: { createdAt: 'desc' }, select: { treatmentTitle: true, fromDate: true, toDate: true, status: true, createdAt: true } },
      // PRJ-1033.5: no referredEmail here — that is the referred person's email
      // (a third party's PII), and this login-only export must return only the
      // signed-in subject's own data. Status + dates are the subject's own.
      referralsMade: { orderBy: { createdAt: 'desc' }, select: { status: true, qualifiedAt: true, rewardedAt: true, createdAt: true } },
    },
  });
  if (!c) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

  // Shop orders relate to the client by clientId, not a named relation.
  const orders = await db.order.findMany({
    where: { clientId: c.id },
    orderBy: { createdAt: 'desc' },
    select: { number: true, status: true, totalPence: true, createdAt: true, paidAt: true, items: { select: { name: true, qty: true, unitPence: true } } },
  });

  const out = {
    exportedAt: new Date().toISOString(),
    account: {
      firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
      dateOfBirth: c.dob, preferredLanguage: c.locale, marketingOptIn: c.marketingOptIn,
      memberSince: c.createdAt, lastVisit: c.lastVisitAt,
      membershipTier: c.membershipTier, membershipSpend12moPence: c.membership12moPence,
      referralCode: c.referralCode,
    },
    appointments: c.bookings,
    healthForms: c.assessments, // metadata only; encrypted detail provided on verified request
    consultations: c.consultations, // metadata only; clinical detail provided on verified request
    offers: c.discountClaims,
    orders,
    reviews: c.reviews,
    loyaltyPoints: c.points,
    referrals: c.referralsMade,
    feedback: c.npsResponses,
    waitlist: c.waitlist,
    emails: c.emails,
    note: 'Clinical and special-category health detail (consultation notes, health-form answers, before/after photos, call transcripts) is not included in this self-service file. Request it through a verified subject-access request and we will provide it with an identity check.',
  };

  const name = [c.firstName, c.lastName].filter(Boolean).join('-').toLowerCase() || 'account';
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="kclinics-my-data-${name}.json"`,
    },
  });
}
