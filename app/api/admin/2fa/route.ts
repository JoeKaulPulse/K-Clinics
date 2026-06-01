import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Self-service 2FA enrolment for the signed-in staff member.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { beginEnrolment, confirmEnrolment, disable2fa } = await import('@/lib/security/twofa');
  const { totpUri } = await import('@/lib/security/totp');
  const { recordSecurity } = await import('@/lib/security/guard');

  switch (body.op) {
    case 'begin': {
      const secret = await beginEnrolment(session.sub);
      return NextResponse.json({ ok: true, secret, uri: totpUri(secret, session.email) });
    }
    case 'confirm': {
      const res = await confirmEnrolment(session.sub, String(body.code || ''));
      if (res.ok) await recordSecurity('TWOFA_ENABLED', 'admin', session.email, req);
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }
    case 'disable': {
      await disable2fa(session.sub);
      await recordSecurity('TWOFA_DISABLED', 'admin', session.email, req);
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
