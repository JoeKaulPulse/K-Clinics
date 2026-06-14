import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: verify a trainee passkey assertion and, on success, create an academy
// session. A verified platform passkey is biometric-backed and phishing-
// resistant, so it stands in for the password. Password sign-in always remains.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'academy-passkey', 12, 300, 'academy'))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait and try again.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
  const { rp } = await import('@/lib/webauthn');
  const { db } = await import('@/lib/db');
  const { rpID, origins } = rp(req);

  const expectedChallenge = (await cookies()).get('kc_acad_login')?.value;
  if (!expectedChallenge || !body.response?.id) return NextResponse.json({ ok: false, error: 'Sign-in expired — please try again.' }, { status: 400 });

  const cred = await db.studentPasskey.findUnique({ where: { credentialId: String(body.response.id) }, include: { student: { select: { id: true, email: true, firstName: true, portalActive: true, sessionEpoch: true } } } });
  if (!cred || !cred.student) return NextResponse.json({ ok: false, error: 'Unrecognised passkey.' }, { status: 400 });
  if (cred.student.portalActive === false) return NextResponse.json({ ok: false, error: 'This account is suspended.' }, { status: 403 });

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

  await db.studentPasskey.update({ where: { id: cred.id }, data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() } });
  await db.academyStudent.update({ where: { id: cred.student.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  const { createAcademySession } = await import('@/lib/auth');
  await createAcademySession({ sub: cred.student.id, email: cred.student.email, firstName: cred.student.firstName, epoch: cred.student.sessionEpoch });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('kc_acad_login', '', { path: '/', maxAge: 0 });
  return res;
}
