import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Self-service password change from Academy Settings (BLD-547). Token-cookie
// authenticated via the academy session; rate-limited to blunt brute-forcing of
// the current password. The heavy lifting (verify current, reject breached, bump
// epoch, re-issue this session) lives in changeAcademyPassword.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'academy-password', 8, 60))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts — please wait a minute and try again.' }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const currentPassword = typeof b.currentPassword === 'string' ? b.currentPassword : '';
  const newPassword = typeof b.newPassword === 'string' ? b.newPassword : '';

  const { changeAcademyPassword } = await import('@/lib/academy-auth');
  const r = await changeAcademyPassword(currentPassword, newPassword);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
