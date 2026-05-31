import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lightweight identity probe for the marketing header: is a client signed in?
// Returns only their first name (from the JWT) — no DB hit, no sensitive data.
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ signedIn: false });
  try {
    const { getClientSession } = await import('@/lib/auth');
    const session = await getClientSession();
    if (!session) return NextResponse.json({ signedIn: false });
    return NextResponse.json({ signedIn: true, firstName: session.firstName });
  } catch {
    return NextResponse.json({ signedIn: false });
  }
}
