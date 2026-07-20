import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { guestBookingSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Guest booking (BLD-550): create a passwordless account + session so a first-time
// client can book without choosing a password. The booking flow's consent/medical
// steps still apply. We email a one-time activation link so they can claim the
// account (set a password) later. Mirrors /api/account/signup minus the password.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Accounts are not enabled in this environment.' }, { status: 503 });

  const parsed = guestBookingSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Check your details.' }, { status: 422 });
  }
  if (parsed.data.company) return NextResponse.json({ ok: true, discount: { granted: false, percent: 15 } }); // honeypot

  const { enforceRateLimit, clientIp } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'signup', 10, 600))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  try {
    const { signupClient, createAccountInvite } = await import('@/lib/client-auth');
    const result = await signupClient({ ...parsed.data, guest: true, ip: clientIp(req) });
    if (!result.ok) return NextResponse.json(result, { status: 409 });

    // Email a claim link so the guest can secure the account later. Best-effort —
    // never block the booking on the email (they already have a live session).
    try {
      const { db } = await import('@/lib/db');
      const c = await db.client.findUnique({
        where: { email: parsed.data.email.trim().toLowerCase() },
        select: { id: true, firstName: true, email: true },
      });
      if (c) {
        const token = await createAccountInvite(c.id);
        if (token) {
          const { site } = await import('@/lib/site');
          const base = process.env.NEXT_PUBLIC_SITE_URL || site.url;
          const activateUrl = `${base}/account/activate?token=${token}&id=${c.id}`;
          const { sendEmail, tmplPortalInvite } = await import('@/lib/email');
          await sendEmail({
            to: c.email,
            subject: 'Set up your KClinics account',
            html: tmplPortalInvite(c.firstName, activateUrl),
          });
        }
      }
    } catch (e) {
      console.error('[booking/guest] claim email failed (continuing):', (e as Error)?.message);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[booking/guest] failed:', err);
    Sentry.captureException(err, { tags: { area: 'booking/guest' } });
    return NextResponse.json({ ok: false, error: 'We couldn’t continue as a guest just now. Please try again shortly.' }, { status: 500 });
  }
}
