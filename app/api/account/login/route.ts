import { NextResponse } from 'next/server';
import { clientLoginSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) {
    return NextResponse.json({ ok: false, error: 'Accounts are not enabled in this environment.' }, { status: 503 });
  }
  const parsed = clientLoginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Enter a valid email and password.' }, { status: 422 });
  }
  try {
    const { loginClient } = await import('@/lib/client-auth');
    const result = await loginClient(parsed.data.email, parsed.data.password);
    const res = NextResponse.json(result, { status: result.ok ? 200 : 401 });
    if (result.ok && result.locale) {
      // Open the portal in the client's saved language straight away.
      res.cookies.set('kc_clang', result.locale, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
  } catch (err) {
    console.error('[account/login] failed:', err);
    // Surface a safe diagnostic category (which stage threw) without leaking
    // any detail — helps pin down config/schema issues from the UI.
    const stage = (err as Error & { stage?: string })?.stage;
    return NextResponse.json(
      { ok: false, error: `Sign in is temporarily unavailable. Please try again shortly.${stage ? ` (ref: ${stage})` : ''}` },
      { status: 500 },
    );
  }
}
