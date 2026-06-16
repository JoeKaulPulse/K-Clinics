import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';

const clinicEmail = () => process.env.CLINIC_NOTIFY_EMAIL || 'info@kclinics.co.uk';
const baseUrl = () => process.env.NEXT_PUBLIC_SITE_URL || site.url;
const money = (p: number) => (p > 0 ? `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}` : 'On consultation');

/**
 * BLD-151: email the client their aftercare guide. Sent when aftercare is
 * confirmed (in the live session walkthrough or the older flow). The content is
 * the clinic's audited per-group guide (lib/aftercare), wrapped in the brand
 * email shell. Idempotency is the caller's job (only call when the ack first
 * lands), and it logs the real send outcome.
 */
export async function notifyAftercare(bookingId: string): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { treatmentTitle: true, treatmentSlug: true, client: { select: { id: true, email: true, firstName: true } } },
  });
  if (!booking?.client?.email) return;
  const c = booking.client;

  const { getTreatment } = await import('@/lib/treatments');
  const { guideForGroup, aftercareTitle, aftercareIntro, aftercareText } = await import('@/lib/aftercare');
  const guide = guideForGroup(getTreatment(booking.treatmentSlug)?.group);
  const items = guide.items.map((it) => `<li style="margin:8px 0;line-height:1.55;">${aftercareText(it, 'en')}</li>`).join('');
  const body = `
    <h1 style="font-size:22px;margin:0 0 8px;">${aftercareTitle(guide, 'en')}</h1>
    <p style="margin:0 0 14px;">Hi ${c.firstName || 'there'}, thank you for visiting us today. Here is your aftercare for your <strong>${booking.treatmentTitle}</strong>:</p>
    <p style="margin:0 0 14px;color:#7d6259;">${aftercareIntro(guide, 'en')}</p>
    <ul style="padding-left:20px;margin:0 0 16px;">${items}</ul>
    <p style="margin:0;">You can revisit this any time in your account: <a href="${baseUrl()}/account/aftercare">your aftercare guide</a>. Any questions, just reply — we're always here.</p>
  `;

  const { sendEmail, tmplManual } = await import('@/lib/email');
  const res = await sendEmail({ to: c.email, subject: `Your aftercare — ${booking.treatmentTitle}`, html: tmplManual(body) });
  if (!res.ok) console.error('[aftercare-notify] email failed:', res.error);
  await db.emailEvent.create({ data: { clientId: c.id, kind: 'MANUAL', to: c.email, subject: 'Aftercare instructions', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } }).catch(() => {});
}

/**
 * Send booking-confirmation comms once a booking is CONFIRMED: client email
 * (with line items, forms prompt and an arrive-early note for first visits),
 * a clinic notification to info@kclinics.co.uk, and an SMS confirmation when the
 * client has opted into text reminders. Safe to call once per confirmation.
 *
 * Guaranteed never to throw: the booking is already CONFIRMED before this runs,
 * so a comms failure must never bubble up and 500 the booking response — that
 * used to surface to clients as a misleading "Network error. Please try again."
 * on an appointment that had in fact gone through. Any failure is logged here and
 * (for the client email) recorded as a FAILED EmailEvent for the team to see.
 */
export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
  try {
    await sendBookingConfirmation(bookingId);
  } catch (e) {
    console.error('[booking-notify] notifyBookingConfirmed failed for', bookingId, e);
  }
}

async function sendBookingConfirmation(bookingId: string): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { client: true, items: { orderBy: { createdAt: 'asc' } }, practitioner: { select: { name: true } }, location: true },
  });
  if (!booking || !booking.client) return;
  const c = booking.client;
  const firstName = c.firstName;
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ');

  // Tell the clinic a booking is confirmed: the assigned clinician (if any) plus
  // whoever runs the diary. Front-desk-safe body (name + time, no clinical detail).
  try {
    const { notifyStaffById, notifyStaffByPermission } = await import('@/lib/notifications');
    const when = booking.startAt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const note = { kind: 'status' as const, category: 'bookings' as const, priority: 'high' as const, title: `Booking confirmed: ${booking.treatmentTitle}`, body: `${name || 'A client'} · ${when}`, href: `/admin/bookings/${booking.id}` };
    if (booking.practitionerId) await notifyStaffById(booking.practitionerId, note);
    await notifyStaffByPermission('bookings.view', note); // dedup means the clinician isn't pinged twice
  } catch { /* non-fatal */ }

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

  const { sendEmail, tmplBookingConfirmation, tmplBookingNotify, bookingIcs } = await import('@/lib/email');

  const clinicianName = booking.practitioner?.name || undefined;
  const locationName = booking.location?.name || undefined;
  const locationAddress = booking.location
    ? [booking.location.addressLine, booking.location.city, booking.location.postcode].filter(Boolean).join(', ') || undefined
    : undefined;
  const ics = bookingIcs({ id: booking.id, treatment: booking.treatmentTitle, start: booking.startAt, end: booking.endAt, manageUrl, locationAddress });

  // Send the client's confirmation first so we can record the true outcome.
  const clientRes = await sendEmail({
    to: c.email,
    subject: `Your booking is confirmed — ${booking.treatmentTitle}`,
    html: tmplBookingConfirmation({ firstName, treatment: booking.treatmentTitle, start: booking.startAt, end: booking.endAt, pricePence: booking.pricePence, manageUrl, formsUrl, arriveEarly: firstVisit, lines, nextNote, clinicianName, locationName, locationAddress }),
    attachments: [{ filename: 'appointment.ics', content: ics, contentType: 'text/calendar' }],
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
    if (await smsConfigured()) {
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
