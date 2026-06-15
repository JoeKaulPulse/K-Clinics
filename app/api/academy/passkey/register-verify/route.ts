import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Verify a trainee passkey registration and store the credential.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { verifyRegistrationResponse } = await import('@simplewebauthn/server');
  const { rp } = await import('@/lib/webauthn');
  const { db } = await import('@/lib/db');
  const { rpID, origins } = rp(req);
  const expectedChallenge = (await cookies()).get('kc_acad_chal')?.value;
  if (!expectedChallenge) return NextResponse.json({ ok: false, error: 'Registration expired — please try again.' }, { status: 400 });

  let verification;
  try {
    verification = await verifyRegistrationResponse({ response: body.response, expectedChallenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Could not verify passkey.' }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) return NextResponse.json({ ok: false, error: 'Passkey not verified.' }, { status: 400 });

  const { credential } = verification.registrationInfo;
  await db.studentPasskey.create({
    data: {
      studentId: student.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceName: String(body.deviceName || '').slice(0, 60) || 'This device',
    },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('kc_acad_chal', '', { path: '/', maxAge: 0 });
  return res;
}
