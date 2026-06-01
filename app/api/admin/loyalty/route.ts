import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manager: manually credit or deduct a client's loyalty points. Uses the
// discounts.manage permission (same area as welcome-offer overrides).
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('discounts.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { clientId, points, reason } = await req.json().catch(() => ({}));
  const pts = Number(points);
  if (!clientId || !Number.isFinite(pts) || pts === 0 || !reason?.trim()) {
    return NextResponse.json({ ok: false, error: 'Client, a non-zero amount and a reason are required.' }, { status: 400 });
  }

  const { awardClientPoints } = await import('@/lib/client-loyalty');
  const res = await awardClientPoints({ clientId, points: Math.round(pts), category: 'MANUAL', reason: String(reason), awardedBy: session.email });
  if (!res.ok) return NextResponse.json({ ok: false, error: 'Could not apply the adjustment.' }, { status: 500 });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'POINTS_AWARDED', actor: session.email, actorRole: session.role, clientId, summary: `${pts >= 0 ? 'Credited' : 'Deducted'} ${Math.abs(pts)} loyalty pts · ${reason}` });

  return NextResponse.json({ ok: true });
}
