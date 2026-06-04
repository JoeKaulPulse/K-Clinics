import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('security.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));

  switch (b.op) {
    case 'unlock': {
      const { unlock } = await import('@/lib/security/guard');
      await unlock({ identifier: b.identifier || undefined, ip: b.ip || undefined });
      return NextResponse.json({ ok: true });
    }
    case 'set2faPolicy': {
      const { setRequired2faRoles } = await import('@/lib/security/twofa');
      await setRequired2faRoles(Array.isArray(b.roles) ? b.roles : [], session.email);
      return NextResponse.json({ ok: true });
    }
    case 'generateSecret': {
      // A strong value the owner pastes into the relevant environment variable.
      return NextResponse.json({ ok: true, value: crypto.randomBytes(48).toString('base64url') });
    }
    case 'reencrypt': {
      // Manual key rotation decrypts and re-encrypts all PII, so it requires a
      // fresh passkey step-up (the nightly cron handles the automatic batch).
      const { cookies } = await import('next/headers');
      const { verifyUnlock, unlockCookie } = await import('@/lib/webauthn');
      const unlock = (await cookies()).get(unlockCookie('rotate-keys'))?.value;
      if (!(await verifyUnlock(unlock, session.sub, 'rotate-keys'))) {
        return NextResponse.json({ ok: false, error: 'Passkey verification required.', needPasskey: 'rotate-keys' }, { status: 401 });
      }
      try {
        const { reencryptBatch } = await import('@/lib/key-rotation');
        const res = await reencryptBatch(500);
        return NextResponse.json({ ok: true, ...res });
      } catch (e) {
        return NextResponse.json({ ok: false, error: (e as Error)?.message || 'Re-encryption unavailable.' }, { status: 400 });
      }
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
