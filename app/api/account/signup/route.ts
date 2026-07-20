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
    const result = await signupClient({ ...parsed.data, ip: clientIp(req) });
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
