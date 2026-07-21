import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Unlock financial data with the 6-digit PIN, or set a PIN if none exists.
// Requires finance.view. Rate-limited to blunt PIN guessing.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('finance.view');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const { hasFinancePin, setFinancePin, verifyFinancePin, grantFinanceUnlock } = await import('@/lib/finance-lock');

  // PRJ-939.3: rate-limit BOTH the unlock path and the set/change-PIN path —
  // 'set' also verifies a guessed currentPin and was previously unguarded,
  // letting a session brute-force the 6-digit PIN with no attempt cap.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'finance-unlock', 8, 300, 'admin', { failClosed: true }))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts — wait a few minutes.' }, { status: 429 });
  }

  if (b.op === 'set') {
    // First-time setup (or there's no PIN yet). Changing an existing PIN needs the old one.
    if (await hasFinancePin(session.sub)) {
      if (!(await verifyFinancePin(session.sub, String(b.currentPin || '')))) return NextResponse.json({ ok: false, error: 'Current PIN is incorrect.' }, { status: 400 });
    }
    const r = await setFinancePin(session.sub, String(b.pin || ''));
    if (!r.ok) return NextResponse.json(r, { status: 400 });
    await grantFinanceUnlock(session.sub); // setting it also unlocks this session
    return NextResponse.json({ ok: true });
  }

  // Default: unlock with the PIN.
  if (!(await hasFinancePin(session.sub))) return NextResponse.json({ ok: false, error: 'No PIN set yet.', needsSetup: true }, { status: 400 });
  if (!(await verifyFinancePin(session.sub, String(b.pin || '')))) return NextResponse.json({ ok: false, error: 'Incorrect PIN.' }, { status: 400 });
  await grantFinanceUnlock(session.sub);
  return NextResponse.json({ ok: true });
}
