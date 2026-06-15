import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-242 — staff-triggered re-permission send to legacy marketing opt-ins.
// GET returns how many are pending; POST sends a bounded batch. Requires the
// campaigns send permission (same gate as a campaign broadcast).
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.send')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const { repermissionStats } = await import('@/lib/re-permission');
  return NextResponse.json({ ok: true, ...(await repermissionStats()) });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.send')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const { sendRepermissionBatch } = await import('@/lib/re-permission');
  const result = await sendRepermissionBatch({ limit: body.limit });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'EMAIL_SENT', actor: session!.email, summary: `Re-permission batch: ${result.sent} sent, ${result.failed} failed, ${result.remaining} remaining` }).catch(() => {});
  return NextResponse.json({ ok: true, ...result });
}
