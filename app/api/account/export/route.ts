import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Client self-service data export (GDPR Art. 15 subject access). Returns the
// signed-in client's own record as JSON. Sensitive encrypted payloads (health
// assessment answers, before-photos, signed consent bodies) are excluded —
// those are shared by the clinic on a verified identity request. This export is
// brought into parity with the Art. 17 erasure list so every category that can
// be erased is also disclosed under Art. 15 (BLD-315).
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
  const clientId = session.sub;

  // Fetch client first so we have the email for legacy order matching
  const c = await db.client.findUnique({ where: { id: clientId } });
  if (!c) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

  const [
    bookings, assessments, discountClaims, emails, callRecords, waitlist,
    aiAnalyses, signedConsents, beforePhotos, reviews, npsResponses,
    followUps, referrals, chats, orders,
  ] = await Promise.all([
    db.booking.findMany({
      where: { clientId },
      orderBy: { startAt: 'desc' },
      select: { id: true, treatmentTitle: true, startAt: true, status: true, chargedPence: true, chargedAt: true, refundedPence: true },
    }),
    db.healthAssessment.findMany({
      where: { clientId },
      orderBy: { submittedAt: 'desc' },
      select: { type: true, version: true, submittedAt: true, sourceLocale: true },
    }),
    db.discountClaim.findMany({ where: { clientId }, select: { code: true, percent: true, status: true, createdAt: true } }),
    db.emailEvent.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { kind: true, subject: true, status: true, createdAt: true },
    }),
    // callRecords: safe metadata only (no recordingUrl, transcript, raw phone numbers)
    db.callRecord.findMany({
      where: { matchedClientId: clientId },
      select: { startedAt: true, direction: true, durationSec: true, status: true },
      orderBy: { startedAt: 'desc' },
    }),
    db.waitlistEntry.findMany({
      where: { clientId },
      select: { treatmentSlug: true, treatmentTitle: true, fromDate: true, toDate: true, status: true, createdAt: true, notifiedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    // AI skin analyses — metadata only
    db.aiAnalysis.findMany({ where: { clientId }, select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    // Signed consents — metadata only; encrypted body/signature excluded
    db.signedConsent.findMany({
      where: { clientId },
      select: { id: true, title: true, templateKey: true, kind: true, declined: true, signedAt: true },
      orderBy: { signedAt: 'desc' },
    }),
    // Before-photos — presence confirmed; encrypted image provided on verified request
    db.beforePhoto.findMany({ where: { clientId }, select: { id: true, area: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    db.review.findMany({
      where: { clientId },
      select: { rating: true, body: true, treatmentTitle: true, createdAt: true, status: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.npsResponse.findMany({
      where: { clientId },
      select: { score: true, comment: true, sentAt: true, respondedAt: true },
      orderBy: { sentAt: 'desc' },
    }),
    db.followUp.findMany({
      where: { clientId },
      select: { treatmentTitle: true, sentAt: true, respondedAt: true, sentiment: true, comment: true },
      orderBy: { sentAt: 'desc' },
    }),
    db.referral.findMany({
      where: { referrerId: clientId },
      select: { createdAt: true, status: true, qualifiedAt: true, rewardedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    // ChatConversation has no Prisma relation on Client; query by clientId directly
    db.chatConversation.findMany({
      where: { clientId },
      select: {
        id: true, createdAt: true, status: true,
        messages: { select: { sender: true, body: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // Orders: match by email (clientId FK may be absent on legacy orders)
    db.order.findMany({
      where: { email: c.email },
      select: { number: true, createdAt: true, totalPence: true, status: true, fulfillment: true, items: { select: { name: true, qty: true, unitPence: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const out = {
    exportedAt: new Date().toISOString(),
    account: {
      firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
      dateOfBirth: c.dob, preferredLanguage: c.locale, marketingOptIn: c.marketingOptIn,
      memberSince: c.createdAt, lastVisit: c.lastVisitAt,
    },
    appointments: bookings,
    healthForms: assessments,
    consents: signedConsents,
    beforePhotos,
    aiAnalyses,
    reviews,
    npsResponses,
    followUps,
    referrals,
    chats,
    offers: discountClaims,
    orders,
    waitlist,
    callRecords,
    emails,
  };

  const name = [c.firstName, c.lastName].filter(Boolean).join('-').toLowerCase() || 'account';
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="kclinics-my-data-${name}.json"`,
    },
  });
}
