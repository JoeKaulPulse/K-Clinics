import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const CATS = ['PERFORMANCE', 'FRIENDLINESS', 'TEAMWORK', 'MANUAL', 'REDEMPTION'];

// Manager: award or deduct staff points. Requires rewards.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('rewards.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { staffId, points, category, reason } = await req.json().catch(() => ({}));
  if (!staffId || !points || !reason?.trim()) return NextResponse.json({ ok: false, error: 'Staff, points and a reason are required.' }, { status: 400 });
  const cat = CATS.includes(category) ? category : 'MANUAL';

  const { awardPoints } = await import('@/lib/gamification');
  await awardPoints({ staffId, points: Number(points), category: cat as never, reason: String(reason).slice(0, 200), awardedBy: session.email });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'POINTS_AWARDED', actor: session.email, actorRole: session.role, summary: `${Number(points) >= 0 ? 'Awarded' : 'Deducted'} ${Math.abs(Number(points))} pts · ${reason}` });

  return NextResponse.json({ ok: true });
}
