import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { crmEnabled } from '@/lib/crm';
import { LOGIN_CHALLENGE_COOKIE } from '@/lib/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: verify a passkey assertion and, on success, create a full admin
// session. A verified platform passkey is phishing-resistant and biometric-
// backed, so it stands in for password + 2FA.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'passkey-login', 12, 300, 'admin'))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait and try again.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
  const { rp } = await import('@/lib/webauthn');
  const { db } = await import('@/lib/db');
  const { rpID, origins } = rp(req);

  const expectedChallenge = (await cookies()).get(LOGIN_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge || !body.response?.id) {
    return NextResponse.json({ ok: false, error: 'Sign-in expired — please try again.' }, { status: 400 });
  }

  const cred = await db.webAuthnCredential.findUnique({ where: { credentialId: String(body.response.id) }, include: { adminUser: true } });
  if (!cred) return NextResponse.json({ ok: false, error: 'Unrecognised passkey.' }, { status: 400 });
  const user = cred.adminUser;
  if (!user.active) return NextResponse.json({ ok: false, error: 'This account is disabled.' }, { status: 403 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response, expectedChallenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: cred.credentialId, publicKey: new Uint8Array(cred.publicKey), counter: cred.counter, transports: cred.transports as AuthenticatorTransport[] },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Could not verify passkey.' }, { status: 400 });
  }
  if (!verification.verified) return NextResponse.json({ ok: false, error: 'Passkey not verified.' }, { status: 400 });

  await db.webAuthnCredential.update({ where: { id: cred.id }, data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() } });

  const { createSession } = await import('@/lib/auth');
  await createSession({ sub: user.id, email: user.email, name: user.name || undefined, role: user.role, grant: user.permGrant ?? [], revoke: user.permRevoke ?? [], epoch: user.sessionEpoch ?? 0 });

  try {
    const { recordSecurity } = await import('@/lib/security/guard');
    await recordSecurity('LOGIN_OK', 'admin', user.email, req, { method: 'passkey' });
  } catch { /* non-fatal */ }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOGIN_CHALLENGE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
