import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-1346: the signed-in client's own course/package balances, for the public
// booking flow — so someone who has already paid for a course of six can spend
// a session online instead of being quoted the full single-session price again.
//
// The client-facing counterpart of /api/admin/clients/[id]/packages, scoped to
// the caller's own record: the id comes from the session, never the request, so
// there is nothing to enumerate. Read-only — the booking route re-validates the
// balance before it prices anything (a stale or edited response can't buy a
// free session).
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false, packages: [] }, { status: 503 });
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ ok: false, packages: [] }, { status: 401 });

  const { clientPackages } = await import('@/lib/package-sessions');
  const packages = (await clientPackages(client.id)).filter((p) => p.paid && p.sessionsRemaining > 0);
  return NextResponse.json({ ok: true, packages }, { headers: { 'Cache-Control': 'no-store' } });
}
