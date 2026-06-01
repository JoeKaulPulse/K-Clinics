import { NextResponse } from 'next/server';
import { clientLoginSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) {
    return NextResponse.json({ ok: false, error: 'Accounts are not enabled in this environment.' }, { status: 503 });
  }
  const raw = await req.json().catch(() => ({}));
  const parsed = clientLoginSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Enter a valid email and password.' }, { status: 422 });
  }
  const email = parsed.data.email.toLowerCase();
  const { loginGate, recordLogin, recordSecurity, verifyTurnstile, turnstileConfigured } = await import('@/lib/security/guard');
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;

  // Brute-force gate + CAPTCHA (shared with the rest of the platform).
  const gate = await loginGate(email, req);
  if (gate.blocked) {
    await recordSecurity('RATE_LIMITED', 'client', email, req);
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }
  if (gate.requireCaptcha && turnstileConfigured) {
    const okCaptcha = await verifyTurnstile(typeof raw.captchaToken === 'string' ? raw.captchaToken : '', req);
    if (!okCaptcha) {
      await recordSecurity('CAPTCHA_FAIL', 'client', email, req);
      return NextResponse.json({ ok: false, error: 'Please complete the security check.', requireCaptcha: true, captchaSiteKey: siteKey }, { status: 401 });
    }
  }

  try {
    const { loginClient } = await import('@/lib/client-auth');
    const result = await loginClient(parsed.data.email, parsed.data.password);
    await recordLogin('client', email, Boolean(result.ok), req);
    const after = result.ok ? null : await loginGate(email, req);
    const res = NextResponse.json(result.ok ? result : { ...result, requireCaptcha: after?.requireCaptcha && turnstileConfigured, captchaSiteKey: siteKey }, { status: result.ok ? 200 : 401 });
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
