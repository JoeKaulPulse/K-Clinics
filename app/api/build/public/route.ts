import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Public (no auth) endpoint serving items flagged isPublic=true on the build board.
// Used by the /roadmap marketing page.
export async function GET() {
  try {
    const { listPublicItems } = await import('@/lib/build-board');
    const items = await listPublicItems();
    return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ ok: false, items: [] });
  }
}
