import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: begin a trainee passkey sign-in. Discoverable flow — no email needed;
// the device offers the academy passkeys registered on it (Face ID / Touch ID).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { generateAuthenticationOptions } = await import('@simplewebauthn/server');
  const { rp } = await import('@/lib/webauthn');
  const { rpID, secure } = rp(req);

  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  options.hints = ['client-device']; // prefer the local built-in authenticator
  const res = NextResponse.json({ ok: true, options });
  res.cookies.set('kc_acad_login', options.challenge, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 300 });
  return res;
}
