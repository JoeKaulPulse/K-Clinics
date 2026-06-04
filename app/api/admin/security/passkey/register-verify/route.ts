import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Verify a passkey registration and store the credential (OWNER only).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session || session.role !== 'OWNER') return NextResponse.json({ ok: false, error: 'Owner access required.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { verifyRegistrationResponse } = await import('@simplewebauthn/server');
  const { rp, CHALLENGE_COOKIE } = await import('@/lib/webauthn');
  const { db } = await import('@/lib/db');
  const { rpID, origin } = rp(req);
  const expectedChallenge = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) return NextResponse.json({ ok: false, error: 'Registration expired — please try again.' }, { status: 400 });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Could not verify passkey.' }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) return NextResponse.json({ ok: false, error: 'Passkey not verified.' }, { status: 400 });

  const { credential } = verification.registrationInfo;
  await db.webAuthnCredential.create({
    data: {
      adminUserId: session.sub,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceName: String(body.deviceName || '').slice(0, 60) || 'Passkey',
    },
  });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: 'Registered an export passkey' }).catch(() => {});

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CHALLENGE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
