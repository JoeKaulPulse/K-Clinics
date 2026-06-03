import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage retail orders (status + fulfilment). Requires finance.view.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = (await requirePermission('finance.view')) || (await requirePermission('settings.manage'));
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ ok: false }, { status: 400 });
  const { db } = await import('@/lib/db');
  const data: Record<string, unknown> = {};
  if (body.status && ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED'].includes(body.status)) data.status = body.status;
  if (body.fulfillment && ['unfulfilled', 'shipped', 'collected'].includes(body.fulfillment)) data.fulfillment = body.fulfillment;
  if (body.trackingNote !== undefined) data.trackingNote = body.trackingNote ? String(body.trackingNote).slice(0, 300) : null;
  await db.order.update({ where: { id: body.id }, data });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Updated order ${body.id}` });
  revalidatePath('/admin/orders');
  return NextResponse.json({ ok: true });
}
