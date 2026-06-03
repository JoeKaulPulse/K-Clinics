import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public map of active redirects, consumed by the edge middleware (and cached
// there). No secrets — just fromPath → { to, code }.
export async function GET() {
  if (!crmEnabled) return Response.json({});
  try {
    const { db } = await import('@/lib/db');
    const rows = await db.redirect.findMany({ where: { active: true }, select: { fromPath: true, toUrl: true, code: true } });
    const map: Record<string, { to: string; code: number }> = {};
    for (const r of rows) map[r.fromPath] = { to: r.toUrl, code: r.code };
    return Response.json(map, { headers: { 'cache-control': 'public, max-age=60, s-maxage=60' } });
  } catch {
    return Response.json({});
  }
}
