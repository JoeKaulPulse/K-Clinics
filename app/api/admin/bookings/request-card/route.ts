import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { crmEnabled } from '@/lib/crm';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';

// Staff send the client a secure link to save a card to an offline booking
// (phone / walk-in), so it gets the same no-show / late-cancel protection as an
// online booking. No charge is taken — the link only stores the card.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });
  if (!stripeEnabled) return NextResponse.json({ ok: false, error: 'Payments are not configured.' }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('bookings.charge');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { bookingId, channel } = (await req.json().catch(() => ({}))) as { bookingId?: string; channel?: 'email' | 'sms' | 'both' };
  if (!bookingId) return NextResponse.json({ ok: false, error: 'Missing booking.' }, { status: 400 });

  // BLD-482: the whole send is wrapped so an unexpected error returns a readable
  // JSON message instead of a 500 (which the UI could only show as a detail-less
  // "Send failed"). Every failure now surfaces a reason staff can act on.
  try {
    const { db } = await import('@/lib/db');
    const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, passwordHash: true, smsReminders: true, stripeCustomerId: true } } } });
    if (!booking) return NextResponse.json({ ok: false, error: 'Booking not found.' }, { status: 404 });
    if (booking.stripePaymentMethodId) return NextResponse.json({ ok: false, error: 'A card is already saved for this booking.' }, { status: 409 });
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
      return NextResponse.json({ ok: false, error: 'This booking is closed.' }, { status: 409 });
    }
    if (!booking.client.email && (channel ?? 'email') !== 'sms') {
      return NextResponse.json({ ok: false, error: 'This client has no email address on file — add one, or send by text.' }, { status: 400 });
    }

    // Ensure a Stripe customer exists for the client and is linked to the booking.
    // Wrapped so a Stripe outage never blocks the email/SMS send (BLD-482).
    try {
      const { ensureCustomer } = await import('@/lib/stripe');
      const customerId = await ensureCustomer(booking.client);
      if (!booking.stripeCustomerId) {
        await db.booking.update({ where: { id: booking.id }, data: { stripeCustomerId: customerId } });
      }
    } catch (stripeErr) {
      console.error('[request-card] Stripe customer sync failed (non-blocking):', (stripeErr as Error)?.message);
      Sentry.captureException(stripeErr, { tags: { area: 'admin/bookings/request-card', stage: 'stripe-customer-sync' } });
    }

    const base = (process.env.NEXT_PUBLIC_SITE_URL || (await import('@/lib/site')).site.url).replace(/\/$/, '');
    const cardUrl = `${base}/booking/card?t=${booking.manageToken}`;
    const want = channel || 'email';

    // A migrated / manually-booked client has no password and so no way into the
    // portal — the plain card link lets them save a card but never signs them in.
    // For these clients send ONE combined welcome email with a passwordless
    // activation link that signs them in and lands them on this same card step.
    // Clients who already have an account get the standard card request unchanged.
    const noAccount = !booking.client.passwordHash;
    let actionUrl = cardUrl;
    if (noAccount) {
      // BLD-482: guarded — a failure to mint the invite token must NOT 500 the
      // whole send (this runs only for new/passwordless clients, which is exactly
      // when the onboarding email was reported failing). Fall back to the plain
      // card link, which still lets the client save a card.
      try {
        const { createAccountInvite } = await import('@/lib/client-auth');
        const inviteToken = await createAccountInvite(booking.clientId);
        if (inviteToken) actionUrl = `${base}/account/activate?token=${inviteToken}&id=${booking.clientId}`;
      } catch (inviteErr) {
        console.error('[request-card] account invite failed (falling back to card link):', (inviteErr as Error)?.message);
      }
    }

    const sent: string[] = [];
    const sendErrors: string[] = [];
    if (want === 'email' || want === 'both') {
      const { sendEmail, tmplCardRequest, tmplAccountInvite } = await import('@/lib/email');
      const html = noAccount
        ? tmplAccountInvite({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, start: booking.startAt, activateUrl: actionUrl })
        : tmplCardRequest({ firstName: booking.client.firstName, treatment: booking.treatmentTitle, start: booking.startAt, url: cardUrl });
      const r = await sendEmail({
        to: booking.client.email,
        subject: noAccount ? 'Your KClinics account is ready — confirm your appointment' : 'Save a card to confirm your appointment — KClinics',
        html,
      });
      if (r.ok) sent.push('email');
      else sendErrors.push(`email: ${r.error || 'unknown error'}`);
    }
    if (want === 'sms' || want === 'both') {
      if (booking.client.smsReminders === false) {
        // BLD-1797: previously fell straight through to the generic "check the
        // client has an email/phone" message with no mention of the real
        // reason — staff had no way to tell an opt-out apart from a delivery
        // failure. Say so explicitly.
        sendErrors.push('sms: this client has opted out of SMS (Text messages are off in their profile)');
      } else {
        const { sendSms } = await import('@/lib/sms');
        const msg = noAccount
          ? `KClinics: welcome to our new site — open your account and save a card to confirm your appointment (no payment now): ${actionUrl}`
          : `KClinics: please save a card to confirm your appointment (no payment taken now): ${cardUrl}`;
        const r = await sendSms(booking.client.phone, msg);
        // BLD-1797 (root cause): sendSms() returns { ok: true, dummy: true }
        // when Twilio isn't configured — a deliberate "don't break callers"
        // fallback (BLD-583), but this route treated `ok` alone as "sent",
        // so staff saw "Sent by sms ✓" and believed the client had it while
        // NOTHING was actually transmitted, and nothing was ever logged. That
        // false-positive is the confirmed root cause of clients not receiving
        // the card-on-file link over SMS. Dummy sends must not count as sent,
        // and — unlike the generic sms-test dummy case — this specific flow is
        // client-facing and P0, so surface it to Sentry as well as the UI.
        if (r.ok && !r.dummy) {
          sent.push('sms');
        } else if (r.dummy) {
          sendErrors.push('sms: SMS is not configured (Twilio credentials missing) — add them in Settings → Integrations, or use the email link');
          Sentry.captureMessage('[request-card] SMS requested but Twilio is not configured — link NOT sent', { level: 'warning', tags: { area: 'admin/bookings/request-card' } });
        } else {
          sendErrors.push(`sms: ${r.error || 'unknown error'}`);
        }
      }
    }

    if (sent.length === 0) {
      const detail = sendErrors.length ? ` (${sendErrors.join('; ')})` : ' (check the client has an email/phone)';
      return NextResponse.json({ ok: false, error: `Could not send the link${detail}`, url: actionUrl }, { status: 400 });
    }

    const logLabel = noAccount ? 'Account invite + card link sent' : 'Card-on-file link sent';
    await db.interaction.create({ data: { clientId: booking.clientId, type: 'APPOINTMENT', summary: `${logLabel} (${sent.join(', ')}) for ${booking.treatmentTitle}`, author: session.email } }).catch(() => {});

    // BLD-1797: a "both" request that half-fails (e.g. email sends, SMS is
    // dummy/errors) used to report unqualified success — staff saw "Sent by
    // email ✓" with no sign the SMS half never went out. Surface the partial
    // failure alongside the success so it isn't silent.
    return NextResponse.json({ ok: true, sent, warnings: sendErrors.length ? sendErrors : undefined, url: actionUrl, invited: noAccount });
  } catch (e) {
    console.error('[request-card] unexpected failure:', (e as Error)?.message);
    Sentry.captureException(e, { tags: { area: 'admin/bookings/request-card' } });
    return NextResponse.json({ ok: false, error: `Could not send the link: ${(e as Error)?.message || 'unexpected error'}` }, { status: 500 });
  }
}
