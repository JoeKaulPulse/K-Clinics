export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public site search (used by the header live-search box). Returns JSON hits.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const { searchSite } = await import('@/lib/search');
  const results = await searchSite(q, 12);
  return Response.json(results, { headers: { 'cache-control': 'public, max-age=30' } });
}
