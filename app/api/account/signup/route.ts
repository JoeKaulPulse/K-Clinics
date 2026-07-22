import { NextResponse } from 'next/server';
import { clientSignupSchema, kVisionSignupSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) {
    return NextResponse.json({ ok: false, error: 'Accounts are not enabled in this environment.' }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  // BLD-928: the K Vision flow sends a deliberately smaller shape (no surname/
  // phone/dob — optional in SignupInput; terms line in its UI). Every one of its
  // signups 422'd against the full portal schema, making the "Get my plan"
  // account gate unpassable for new visitors.
  const isKVision = (body as { source?: string })?.source === 'kvision';
  const parsed = (isKVision ? kVisionSignupSchema : clientSignupSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Check your details.' }, { status: 422 });
  }
  if (parsed.data.company) return NextResponse.json({ ok: true, discount: { granted: false, percent: 15 } }); // honeypot

  const { enforceRateLimit, clientIp } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'signup', 10, 600))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  try {
    const { signupClient } = await import('@/lib/client-auth');
    // BLD-734 (owner, 20 Jul): the K Vision signup is passwordless — the account
    // is created as a guest so the plan reveals on a live session with no
    // password invented on the spot; a sign-in link is emailed below for later.
    const result = await signupClient({ ...parsed.data, ...(isKVision ? { guest: true } : {}), ip: clientIp(req) });
    // BLD-870: the K Vision "Get my plan" flow is a lead-gen mechanic — fire the
    // server-side Lead (GA4 + Meta CAPI) like /api/consult does, deduped with
    // the browser pixel via the shared eventId. No hashed email: this signup
    // carries no marketing opt-in. Best-effort, never blocks the account.
    if (result.ok && isKVision) {
      try {
        const { sendLead } = await import('@/lib/conversions');
        const eventId = (parsed.data as { eventId?: string }).eventId || globalThis.crypto.randomUUID();
        await sendLead({ eventId, email: null, sourceUrl: req.headers.get('referer') });
      } catch { /* best-effort */ }
      // BLD-734: email the passwordless account a one-tap sign-in link so they
      // can return without a password (same claim path as guest bookings,
      // BLD-550). Best-effort — the plan is already visible on the live session.
      // PRJ-1034.1: only for a genuinely new signup. A pre-existing Client row
      // never got a live session above (signupClient) and already received its
      // own claim-confirmation email — sending this one too would duplicate it
      // and imply the plan is visible before ownership is verified.
      if (result.isNewAccount) {
        try {
          const { db } = await import('@/lib/db');
          const { createAccountInvite } = await import('@/lib/client-auth');
          const c = await db.client.findUnique({ where: { email: parsed.data.email.trim().toLowerCase() }, select: { id: true, firstName: true, email: true } });
          if (c) {
            const token = await createAccountInvite(c.id);
            if (token) {
              const { site } = await import('@/lib/site');
              const base = process.env.NEXT_PUBLIC_SITE_URL || site.url;
              const activateUrl = `${base}/account/activate?token=${token}&id=${c.id}`;
              const { sendEmail, tmplPortalInvite } = await import('@/lib/email');
              await sendEmail({ to: c.email, subject: 'Your KClinics plan & account link', html: tmplPortalInvite(c.firstName, activateUrl) });
            }
          }
        } catch (e) { console.error('[account/signup] kvision invite email failed (continuing):', (e as Error)?.message); }
      }
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (err) {
    console.error('[account/signup] failed:', err);
    // Surface the underlying cause off-production to make issues diagnosable.
    const detail = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production'
      ? ` (${(err as Error)?.message?.slice(0, 160)})`
      : '';
    return NextResponse.json(
      { ok: false, error: `We couldn’t create your account just now. Please try again shortly.${detail}` },
      { status: 500 },
    );
  }
}
