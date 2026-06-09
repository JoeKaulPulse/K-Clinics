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
  const { setConfigNumber, setSetting } = await import('@/lib/settings');
  const { logAudit } = await import('@/lib/audit');

  if (b.op === 'refundWindow') {
    const days = Math.round(Number(b.days));
    if (!Number.isFinite(days) || days < 1 || days > 180) return NextResponse.json({ ok: false, error: 'Choose a window between 1 and 180 days (Stripe’s maximum).' }, { status: 400 });
    await setConfigNumber('refund_window_days', days, session.email);
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Refund window set to ${days} days` }).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (b.op === 'margin') {
    const pct = Math.round(Number(b.minMarginPct));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return NextResponse.json({ ok: false, error: 'Minimum margin must be 0–100%.' }, { status: 400 });
    await setConfigNumber('min_margin_pct', pct, session.email);
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Minimum margin target set to ${pct}%` }).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (b.op === 'vat') {
    const rate = Math.round(Number(b.defaultRatePct));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return NextResponse.json({ ok: false, error: 'VAT rate must be between 0 and 100%.' }, { status: 400 });
    await Promise.all([
      setSetting('vat_registered', !!b.registered, session.email),
      setSetting('prices_vat_inclusive', !!b.inclusive, session.email),
      setConfigNumber('vat_default_rate_pct', rate, session.email),
    ]);
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `VAT: ${b.registered ? 'registered' : 'not registered'}, ${b.inclusive ? 'inclusive' : 'exclusive'}, ${rate}%` }).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
