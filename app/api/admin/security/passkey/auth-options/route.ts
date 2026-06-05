import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Begin a passkey step-up (OWNER only) — returns assertion options scoped to the
// owner's registered passkeys.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session || session.role !== 'OWNER') return NextResponse.json({ ok: false, error: 'Owner access required.' }, { status: 403 });

  const { generateAuthenticationOptions } = await import('@simplewebauthn/server');
  const { rp, CHALLENGE_COOKIE } = await import('@/lib/webauthn');
  const { db } = await import('@/lib/db');
  const { rpID, secure } = rp(req);

  const creds = await db.webAuthnCredential.findMany({ where: { adminUserId: session.sub }, select: { credentialId: true, transports: true } });
  if (creds.length === 0) return NextResponse.json({ ok: false, error: 'No passkey registered. Set one up first.' }, { status: 400 });

  const options = await generateAuthenticationOptions({
    rpID, userVerification: 'required',
    allowCredentials: creds.map((c) => ({ id: c.credentialId, transports: c.transports as AuthenticatorTransport[] })),
  });
  // Prefer the local built-in authenticator (Face ID / Touch ID) over the
  // cross-device "use a passkey from another device" flow.
  options.hints = ['client-device'];

  const res = NextResponse.json({ ok: true, options });
  res.cookies.set(CHALLENGE_COOKIE, options.challenge, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 300 });
  return res;
}
