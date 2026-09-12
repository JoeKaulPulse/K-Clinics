import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-1646 — the waitlist admin page was read-only: no way to notify a client
// a slot's available (staff already agreed one by phone), or remove someone
// who calls to cancel their spot. Both act on one entry, gated the same as
// every other booking-adjacent admin action (bookings.manage).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled.' }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('bookings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = typeof body.action === 'string' ? body.action : '';

  try {
    if (action === 'notify') {
      const slotStart = typeof body.slotStart === 'string' && body.slotStart ? new Date(body.slotStart) : undefined;
      if (slotStart && Number.isNaN(+slotStart)) return NextResponse.json({ ok: false, error: 'Bad slot date.' }, { status: 400 });
      const { notifyWaitlistEntryManually } = await import('@/lib/waitlist');
      const r = await notifyWaitlistEntryManually(id, slotStart);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    if (action === 'remove') {
      const { cancelWaitlistEntry } = await import('@/lib/waitlist');
      const r = await cancelWaitlistEntry(id);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    Sentry.captureException(e, { tags: { area: 'admin/waitlist/id' } });
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
