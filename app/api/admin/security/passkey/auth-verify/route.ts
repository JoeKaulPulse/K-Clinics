import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Verify a passkey assertion; on success issue a short-lived step-up unlock token
// for the requested purpose. Most purposes are OWNER-only; 'finance' is open to
// anyone with finance.view (passkey alternative to the financial-data PIN) and
// mints a 30-minute unlock to match the PIN path.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const { getSession, sessionCan } = await import('@/lib/auth');
  const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
  const { rp, CHALLENGE_COOKIE, unlockCookie, signUnlock, isStepUpPurpose } = await import('@/lib/webauthn');
  const { db } = await import('@/lib/db');
  const { rpID, origins, secure } = rp(req);
  const purpose = isStepUpPurpose(body.purpose) ? body.purpose : 'export';

  const session = await getSession();
  const permitted = !!session && (purpose === 'finance' ? sessionCan(session, 'finance.view') : session.role === 'OWNER');
  if (!session || !permitted) return NextResponse.json({ ok: false, error: purpose === 'finance' ? 'Not permitted.' : 'Owner access required.' }, { status: 403 });

  const expectedChallenge = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge || !body.response?.id) return NextResponse.json({ ok: false, error: 'Verification expired — please try again.' }, { status: 400 });

  const cred = await db.webAuthnCredential.findUnique({ where: { credentialId: String(body.response.id) } });
  if (!cred || cred.adminUserId !== session.sub) return NextResponse.json({ ok: false, error: 'Unknown passkey.' }, { status: 400 });

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

  const res = NextResponse.json({ ok: true });
  // Financial viewing gets a 30-min window (matching the PIN unlock); tighter for the rest.
  const maxAge = purpose === 'finance' ? 30 * 60 : 180;
  res.cookies.set(unlockCookie(purpose), await signUnlock(session.sub, purpose), { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge });
  res.cookies.set(CHALLENGE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
