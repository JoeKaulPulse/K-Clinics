import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-1014: a client's package (course) balances, for the staff booking modal —
// so reception can see at a glance whether the visit is already paid for and
// book it as a package session instead of charging again.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { id } = await params;
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'bookings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const { clientPackages } = await import('@/lib/package-sessions');
  const packages = await clientPackages(id);
  return NextResponse.json({ ok: true, packages }, { headers: { 'Cache-Control': 'no-store' } });
}
