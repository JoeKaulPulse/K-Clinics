import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Begin registering a trainee passkey (Face ID / Touch ID / fingerprint). The
// trainee must already be signed in; the challenge is stashed in an httpOnly
// cookie for the verify step. Mirrors the admin passkey flow (lib/webauthn).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in first.' }, { status: 401 });

  const { generateRegistrationOptions } = await import('@simplewebauthn/server');
  const { rp } = await import('@/lib/webauthn');
  const { db } = await import('@/lib/db');
  const { rpID, rpName, secure } = rp(req);

  const existing = await db.studentPasskey.findMany({ where: { studentId: student.id }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
    rpName, rpID,
    userID: new TextEncoder().encode(student.id),
    userName: student.email,
    userDisplayName: student.firstName || student.email,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports as AuthenticatorTransport[] })),
    preferredAuthenticatorType: 'localDevice',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });

  const res = NextResponse.json({ ok: true, options });
  res.cookies.set('kc_acad_chal', options.challenge, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 300 });
  return res;
}
