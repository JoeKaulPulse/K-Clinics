import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: begin a passkey (Face ID / Touch ID) sign-in. Discoverable flow — no
// email needed; the browser offers the platform passkeys registered for this
// site. Challenge is stashed in a short-lived httpOnly cookie for verify.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { generateAuthenticationOptions } = await import('@simplewebauthn/server');
  const { rp, LOGIN_CHALLENGE_COOKIE } = await import('@/lib/webauthn');
  const { rpID, secure } = rp(req);

  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  // Prefer the local built-in authenticator (Face ID / Touch ID) over the
  // cross-device "use a passkey from another device" flow.
  options.hints = ['client-device'];
  const res = NextResponse.json({ ok: true, options });
  res.cookies.set(LOGIN_CHALLENGE_COOKIE, options.challenge, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 300 });
  return res;
}
