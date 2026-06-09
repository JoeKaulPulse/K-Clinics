import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Financial controls (Finance → Financial controls). Requires finance.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('finance.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const { setConfigNumber } = await import('@/lib/settings');

  if (b.op === 'refundWindow') {
    const days = Math.round(Number(b.days));
    if (!Number.isFinite(days) || days < 1 || days > 180) return NextResponse.json({ ok: false, error: 'Choose a window between 1 and 180 days (Stripe’s maximum).' }, { status: 400 });
    await setConfigNumber('refund_window_days', days, session.email);
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Refund window set to ${days} days` }).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
