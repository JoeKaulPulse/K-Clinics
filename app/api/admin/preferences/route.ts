import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { isDashboardView, canSwitchViews } from '@/lib/dashboard-views';

export const runtime = 'nodejs';

// PRJ-63 — persist an OWNER/ADMIN's pinned dashboard view (preferredDashboardView).
// null clears it (back to the role default). Only roles that may switch can set it.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  if (!canSwitchViews(session.role)) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { view } = await req.json().catch(() => ({}));
  if (view !== null && !isDashboardView(view)) return NextResponse.json({ ok: false, error: 'Unknown view.' }, { status: 400 });

  try {
    const { db } = await import('@/lib/db');
    await db.adminUser.update({ where: { id: session.sub }, data: { preferredDashboardView: view } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not save your preference.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, view });
}
