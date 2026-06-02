import { NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM is not enabled in this environment.' }, { status: 503 });

  const raw = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Enter a valid email and password.' }, { status: 422 });
  const email = parsed.data.email.toLowerCase();
  const code = typeof raw.code === 'string' ? raw.code : '';
  const captchaToken = typeof raw.captchaToken === 'string' ? raw.captchaToken : '';

  const { loginGate, recordLogin, recordSecurity, verifyTurnstile, turnstileConfigured } = await import('@/lib/security/guard');

  // 1) Brute-force gate (before touching the password).
  const gate = await loginGate(email, req);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
  if (gate.blocked) {
    await recordSecurity('RATE_LIMITED', 'admin', email, req);
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  // 2) CAPTCHA once enough failures have accumulated.
  if (gate.requireCaptcha && turnstileConfigured) {
    const okCaptcha = await verifyTurnstile(captchaToken, req);
    if (!okCaptcha) {
      await recordSecurity('CAPTCHA_FAIL', 'admin', email, req);
      return NextResponse.json({ ok: false, error: 'Please complete the security check.', requireCaptcha: true, captchaSiteKey: siteKey }, { status: 401 });
    }
  }

  const { db } = await import('@/lib/db');
  const { verifyPassword, createSession } = await import('@/lib/auth');
  const user = await db.adminUser.findUnique({ where: { email } });

  // 3) Password — generic failure message to avoid account enumeration.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    await recordLogin('admin', email, false, req);
    const after = await loginGate(email, req);
    return NextResponse.json({ ok: false, error: 'Invalid email or password.', requireCaptcha: after.requireCaptcha && turnstileConfigured, captchaSiteKey: siteKey }, { status: 401 });
  }
  if (user.active === false) {
    await recordSecurity('LOGIN_FAIL', 'admin', email, req, { reason: 'deactivated' });
    return NextResponse.json({ ok: false, error: 'This account has been deactivated.' }, { status: 403 });
  }

  const { is2faRequiredForRole, verifySecondFactor } = await import('@/lib/security/twofa');

  // 4) Two-factor (if enabled, or required by policy for this role).
  if (user.totpEnabledAt) {
    if (!code) return NextResponse.json({ ok: false, twoFactor: true }, { status: 401 });
    const v = await verifySecondFactor({ id: user.id, totpSecret: user.totpSecret, totpEnabledAt: user.totpEnabledAt, recoveryCodes: user.recoveryCodes }, code);
    if (!v.ok) {
      await recordSecurity('TWOFA_FAIL', 'admin', email, req);
      await recordLogin('admin', email, false, req, { stage: '2fa' });
      return NextResponse.json({ ok: false, twoFactor: true, error: 'Incorrect authentication code.' }, { status: 401 });
    }
    await recordSecurity('TWOFA_OK', 'admin', email, req, v.usedRecovery ? { recovery: true } : undefined);
  } else if (await is2faRequiredForRole(user.role)) {
    // Policy requires 2FA for this role but it isn't set up yet. Grant a
    // setup-only session (middleware confines it to the profile page) so they
    // can enrol, then re-authenticate with their new second factor.
    await createSession({ sub: user.id, email: user.email, name: user.name || undefined, role: user.role, grant: user.permGrant ?? [], revoke: user.permRevoke ?? [], needsSetup: true });
    await recordSecurity('LOGIN_OK', 'admin', email, req, { setup: true });
    return NextResponse.json({ ok: true, setup: true });
  }

  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({ sub: user.id, email: user.email, name: user.name || undefined, role: user.role, grant: user.permGrant ?? [], revoke: user.permRevoke ?? [] });
  await recordLogin('admin', email, true, req);

  const res = NextResponse.json({ ok: true });
  const locale = user.locale === 'uk' ? 'uk' : 'en';
  res.cookies.set('kc_lang', locale, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
