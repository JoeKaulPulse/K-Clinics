import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Begin a passkey step-up — returns assertion options scoped to the caller's own
// registered passkeys. Most purposes (export, key rotation) are OWNER-only; the
// 'finance' purpose is open to anyone with finance.view so finance staff can use
// a passkey instead of their PIN on the financial-data lock.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const { getSession, sessionCan } = await import('@/lib/auth');
  const { isStepUpPurpose } = await import('@/lib/webauthn');
  const purpose = isStepUpPurpose(body.purpose) ? body.purpose : 'export';
  const session = await getSession();
  const permitted = !!session && (purpose === 'finance' ? sessionCan(session, 'finance.view') : session.role === 'OWNER');
  if (!session || !permitted) return NextResponse.json({ ok: false, error: purpose === 'finance' ? 'Not permitted.' : 'Owner access required.' }, { status: 403 });

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
