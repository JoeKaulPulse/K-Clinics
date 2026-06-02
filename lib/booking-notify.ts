import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';

const clinicEmail = () => process.env.CLINIC_NOTIFY_EMAIL || 'info@kclinics.co.uk';
const baseUrl = () => process.env.NEXT_PUBLIC_SITE_URL || site.url;
const money = (p: number) => (p > 0 ? `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}` : 'On consultation');

/**
 * Send booking-confirmation comms once a booking is CONFIRMED: client email
 * (with line items, forms prompt and an arrive-early note for first visits),
 * a clinic notification to info@kclinics.co.uk, and an SMS confirmation when the
 * client has opted into text reminders. Safe to call once per confirmation.
 */
export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { client: true, items: { orderBy: { createdAt: 'asc' } } },
  });
  if (!booking || !booking.client) return;
  const c = booking.client;
  const firstName = c.firstName;
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');

  // First appointment? (this booking plus any other confirmed/completed)
  const priorCount = await db.booking.count({
    where: { clientId: c.id, id: { not: booking.id }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
  });
  const firstVisit = priorCount === 0;

  const lines = booking.items.length
    ? booking.items.map((it) => ({
        label: it.label + (it.sessions > 1 ? ` — course of ${it.sessions}` : '') + (it.isAddon ? ' (add-on)' : ''),
        price: money(Math.max(0, it.pricePence - it.discountPence)),
      }))
    : [{ label: booking.treatmentTitle, price: money(booking.pricePence) }];

  const manageUrl = `${baseUrl()}/booking/manage?t=${booking.manageToken}`;
  const formsUrl = `${baseUrl()}/account/assessments`;

  // Recommended next session (course-based treatments space out over time).
  let nextNote: string | undefined;
  try {
    const { recommendedNext, formatInterval } = await import('@/lib/treatment-intervals');
    const completed = await db.booking.count({ where: { clientId: c.id, treatmentSlug: booking.treatmentSlug, status: 'COMPLETED' } });
    const rec = recommendedNext(booking.treatmentSlug, completed + 1, booking.startAt);
    if (rec) nextNote = `For best results, we recommend your next ${booking.treatmentTitle} session ${formatInterval(rec.weeks)} after this one — around ${rec.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`;
  } catch { /* recommendation is best-effort */ }

  const { sendEmail, tmplBookingConfirmation, tmplBookingNotify } = await import('@/lib/email');

  // Send the client's confirmation first so we can record the true outcome.
  const clientRes = await sendEmail({
    to: c.email,
    subject: `Your booking is confirmed — ${booking.treatmentTitle}`,
    html: tmplBookingConfirmation({ firstName, treatment: booking.treatmentTitle, start: booking.startAt, pricePence: booking.pricePence, manageUrl, formsUrl, arriveEarly: firstVisit, lines, nextNote }),
  });
  if (!clientRes.ok) console.error('[booking-notify] confirmation email failed:', clientRes.error);

  const tasks: Promise<unknown>[] = [
    sendEmail({
      to: clinicEmail(),
      subject: `New booking — ${name}`,
      html: tmplBookingNotify({ name, email: c.email, phone: c.phone || undefined, treatment: booking.treatmentTitle, start: booking.startAt, pricePence: booking.pricePence }),
    }),
  ];

  // SMS confirmation — only when the client opted in and SMS is configured.
  if (c.smsReminders && c.phone) {
    const { smsConfigured, sendSms } = await import('@/lib/sms');
    if (smsConfigured()) {
      const when = booking.startAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const arrive = firstVisit ? ' Please arrive 15 mins early for your first visit.' : '';
      tasks.push(sendSms(c.phone, `KClinics: your ${booking.treatmentTitle} is booked for ${when}.${arrive} Manage: ${manageUrl}`));
    }
  }

  await Promise.allSettled(tasks);

  // Record the REAL outcome so failures are visible in the email log (this used
  // to always log SENT, masking provider/config issues like an unverified domain).
  await db.emailEvent.create({ data: { clientId: c.id, kind: 'MANUAL', to: c.email, subject: 'Booking confirmation', status: clientRes.ok ? 'SENT' : 'FAILED', providerId: clientRes.id, error: clientRes.error } }).catch(() => {});
  await db.interaction.create({
    data: { clientId: c.id, type: 'APPOINTMENT', summary: `Booked ${booking.treatmentTitle}`, detail: booking.startAt.toISOString(), author: 'system' },
  }).catch(() => {});
}
