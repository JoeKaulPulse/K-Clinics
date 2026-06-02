// Serves the IndexNow verification key at /indexnow-key.txt so search engines
// can confirm we own the key used when submitting URLs. Returns 404 until the
// INDEXNOW_KEY env var is configured.
export const dynamic = 'force-static';

export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response('Not found', { status: 404 });
  return new Response(key, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
  });
}
