import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Tiny endpoint so the public-site edit bar can tell if the visitor is an admin
// without forcing the marketing pages to render dynamically.
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ admin: false });
  try {
    const { getSession, sessionCan } = await import('@/lib/auth');
    const session = await getSession();
    return NextResponse.json({ admin: sessionCan(session, 'settings.manage'), email: session?.email ?? null });
  } catch {
    return NextResponse.json({ admin: false });
  }
}
