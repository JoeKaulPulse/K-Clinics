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
      const uri = totpUri(secret, session.email);
      // Render a scannable QR for the otpauth URI (not just the manual key).
      let qr: string | null = null;
      try {
        const QR = await import('qrcode');
        qr = await QR.toDataURL(uri, { margin: 1, width: 220, color: { dark: '#2a2420', light: '#ffffffff' } });
      } catch { /* fall back to the manual key + link */ }
      return NextResponse.json({ ok: true, secret, uri, qr });
    }
    case 'confirm': {
      const res = await confirmEnrolment(session.sub, String(body.code || ''));
      if (res.ok) {
        await recordSecurity('TWOFA_ENABLED', 'admin', session.email, req);
        // Re-issue a full session so the setup-only gate (needsSetup) is cleared.
        const { db } = await import('@/lib/db');
        const { createSession } = await import('@/lib/auth');
        const u = await db.adminUser.findUnique({ where: { id: session.sub }, select: { id: true, email: true, name: true, role: true, permGrant: true, permRevoke: true, sessionEpoch: true } });
        if (u) await createSession({ sub: u.id, email: u.email, name: u.name || undefined, role: u.role, grant: u.permGrant ?? [], revoke: u.permRevoke ?? [], epoch: u.sessionEpoch ?? 0 });
      }
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }
    case 'disable': {
      const { db } = await import('@/lib/db');
      const { verifySecondFactor } = await import('@/lib/security/twofa');
      const u = await db.adminUser.findUnique({ where: { id: session.sub }, select: { id: true, totpSecret: true, totpEnabledAt: true, recoveryCodes: true } });
      if (u?.totpEnabledAt) {
        const code = String(body.code || '').trim();
        if (!code) return NextResponse.json({ ok: false, error: 'Enter your current authenticator code to confirm.' }, { status: 400 });
        const check = await verifySecondFactor(u, code);
        if (!check.ok) return NextResponse.json({ ok: false, error: "That code didn't match. Check your authenticator." }, { status: 403 });
      }
      await disable2fa(session.sub);
      await recordSecurity('TWOFA_DISABLED', 'admin', session.email, req);
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
