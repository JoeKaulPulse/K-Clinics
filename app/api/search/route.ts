export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public site search (used by the header live-search box). Returns JSON hits.
export async function GET(req: Request) {
  // BLD-1172: every distinct ?q= is its own CDN cache key, so without a limit
  // this was a direct path to sustained DB load — the one public route missing
  // enforceRateLimit. 60/min comfortably covers a human typing in the box.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'search', 60, 60))) {
    return Response.json({ query: '', hits: [], total: 0 }, { status: 429 });
  }
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const { searchSite } = await import('@/lib/search');
  const results = await searchSite(q, 12);
  return Response.json(results, { headers: { 'cache-control': 'public, max-age=30' } });
}
