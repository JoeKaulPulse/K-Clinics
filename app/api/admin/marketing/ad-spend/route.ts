import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Pull ad spend from connected platforms into campaign ROI. Requires
// campaigns.send (or settings.manage). Safe to call any time — fault-tolerant.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = (await requirePermission('campaigns.send')) || (await requirePermission('settings.manage'));
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const days = body.days === 7 ? 7 : 30;
  const { syncAdSpend } = await import('@/lib/ad-spend');
  const result = await syncAdSpend(days);
  return NextResponse.json(result);
}
