import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Begin passkey registration (OWNER only). Returns WebAuthn creation options and
// stashes the challenge in an httpOnly cookie for the verify step.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session || session.role !== 'OWNER') return NextResponse.json({ ok: false, error: 'Owner access required.' }, { status: 403 });

  const { generateRegistrationOptions } = await import('@simplewebauthn/server');
  const { rp, CHALLENGE_COOKIE } = await import('@/lib/webauthn');
  const { db } = await import('@/lib/db');
  const { rpID, rpName, secure } = rp(req);

  const existing = await db.webAuthnCredential.findMany({ where: { adminUserId: session.sub }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
    rpName, rpID,
    userID: new TextEncoder().encode(session.sub),
    userName: session.email,
    userDisplayName: session.name || session.email,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports as AuthenticatorTransport[] })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required', authenticatorAttachment: 'platform' },
  });

  const res = NextResponse.json({ ok: true, options });
  res.cookies.set(CHALLENGE_COOKIE, options.challenge, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 300 });
  return res;
}
