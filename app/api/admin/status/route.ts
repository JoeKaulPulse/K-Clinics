import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Maintenance-window management for the Owner/Admin status page. Owner/Admin only.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session || !['OWNER', 'ADMIN'].includes(session.role)) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  try {
    const m = await import('@/lib/maintenance');
    switch (b.op) {
      case 'create': {
        const title = String(b.title || '').trim();
        if (!title) return NextResponse.json({ ok: false, error: 'A title is required.' }, { status: 400 });
        const start = new Date(b.startAt); const end = new Date(b.endAt);
        if (isNaN(+start) || isNaN(+end) || end <= start) return NextResponse.json({ ok: false, error: 'Give a valid start and end (end after start).' }, { status: 400 });
        const w = await m.scheduleMaintenance({
          title, detail: b.detail, startAt: start, endAt: end,
          services: Array.isArray(b.services) ? b.services.map(String) : [],
          impact: b.impact, createdBy: session.email,
        });
        return NextResponse.json({ ok: true, id: w.id });
      }
      case 'cancel': {
        if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
        await m.cancelMaintenance(String(b.id));
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
  } catch (e) {
    console.error('[status] maintenance op failed', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong — please retry.' }, { status: 500 });
  }
}
