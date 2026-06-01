import 'server-only';
import { db } from '@/lib/db';

// First-party review system. After a treatment we ask the client to leave a
// review via our own page; once submitted and approved, high ratings can be
// pushed/encouraged to Google Business. No third-party review tool is used.
//
// External dependencies (SMS provider, Google Business API) are inert until
// credentials are supplied — every integration degrades to a safe no-op.

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://kclinics.co.uk';

/** Public "leave a review" link for a given review token. */
export function reviewLink(token: string): string {
  return `${siteUrl()}/review/${token}`;
}

/** Direct Google review link (place ID supplied later; inert placeholder now). */
export function googleReviewLink(): string | null {
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!placeId) return null;
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

/** Create (or reuse) a pending review request for a completed booking. */
export async function ensureReviewRequest(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, clientId: true, practitionerId: true, treatmentTitle: true, status: true },
  });
  if (!booking) return null;

  const existing = await db.review.findFirst({ where: { bookingId } });
  if (existing) return existing;

  return db.review.create({
    data: {
      clientId: booking.clientId,
      bookingId: booking.id,
      clinicianId: booking.practitionerId,
      treatmentTitle: booking.treatmentTitle,
      status: 'PENDING',
      requestedAt: new Date(),
    },
  });
}

/** Send the review request (email now; SMS when a provider is configured). */
export async function sendReviewRequest(reviewId: string, channel: 'EMAIL' | 'SMS' = 'EMAIL') {
  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: { client: { select: { firstName: true, email: true, phone: true } } },
  });
  if (!review) return { ok: false, error: 'Not found' };

  const link = reviewLink(review.token);
  const name = review.client.firstName;

  if (channel === 'SMS') {
    const { sendSms } = await import('@/lib/sms');
    const res = await sendSms(review.client.phone, `Hi ${name}, thank you for visiting K Clinics. We'd love your feedback — leave a quick review here: ${link}`);
    await db.review.update({ where: { id: reviewId }, data: { channel: 'SMS', requestedAt: new Date() } });
    return res;
  }

  const { sendEmail, tmplReviewRequest } = await import('@/lib/email');
  const res = await sendEmail({
    to: review.client.email,
    subject: 'How was your visit to K Clinics?',
    html: tmplReviewRequest(name, link, review.treatmentTitle || undefined),
  });
  await db.review.update({ where: { id: reviewId }, data: { channel: 'EMAIL', requestedAt: new Date() } });
  try {
    await db.emailEvent.create({
      data: { clientId: review.clientId, kind: 'REVIEW_REQUEST', to: review.client.email, subject: 'Review request', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error },
    });
  } catch { /* non-fatal */ }
  return res;
}

/** Approved, published reviews for the public marketing site. */
export async function publishedReviews(
  limit = 8,
): Promise<{ name: string; treatment: string; quote: string; location?: string }[]> {
  try {
    const rows = await db.review.findMany({
      where: { status: 'PUBLISHED', body: { not: null }, rating: { gte: 4 } },
      orderBy: { submittedAt: 'desc' },
      take: limit,
      include: { client: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((r) => ({
      name: `${r.client.firstName}${r.client.lastName ? ` ${r.client.lastName[0]}.` : ''}`,
      treatment: r.treatmentTitle || 'Treatment',
      quote: r.body || '',
    }));
  } catch {
    return [];
  }
}

/** Record a client's submitted review (from the public token page). */
export async function submitReview(token: string, rating: number, title: string, body: string) {
  const review = await db.review.findUnique({ where: { token } });
  if (!review) return { ok: false, error: 'Invalid link.' };
  if (review.status !== 'PENDING') return { ok: false, error: 'This review has already been submitted.' };
  const r = Math.min(5, Math.max(1, Math.round(rating)));
  await db.review.update({
    where: { token },
    data: {
      rating: r,
      title: title.trim().slice(0, 120) || null,
      body: body.trim().slice(0, 2000) || null,
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
  });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'REVIEW_RECEIVED', actor: 'client', clientId: review.clientId, bookingId: review.bookingId, summary: `Review submitted · ${r}★` });
  return { ok: true, rating: r };
}
