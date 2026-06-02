import { NextResponse } from 'next/server';
import { clientSignupSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  return xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip');
}

export async function POST(req: Request) {
  if (!crmEnabled) {
    return NextResponse.json({ ok: false, error: 'Accounts are not enabled in this environment.' }, { status: 503 });
  }
  const parsed = clientSignupSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Check your details.' }, { status: 422 });
  }
  if (parsed.data.company) return NextResponse.json({ ok: true, discount: { granted: false, percent: 15 } }); // honeypot

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'signup', 10, 600))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  try {
    const { signupClient } = await import('@/lib/client-auth');
    const result = await signupClient({ ...parsed.data, ip: clientIp(req) });
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
