import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = new Set(['click', 'rage', 'scroll']);

// Store heatmap interaction points (clicks, rage-clicks, scroll depth). Public +
// consent-gated; coarse coordinates only, no personal data.
export async function POST(req: Request) {
  if (!crmEnabled) return Response.json({ ok: false }, { status: 503 });

  // Require analytics consent (fail-closed) and rate-limit — parity with the
  // replay ingest route, so a non-consenting or forged client can't seed the
  // heatmap tables even though the recorder already gates sends client-side.
  const cookie = req.headers.get('cookie') || '';
  if (!/(?:^|;\s*)kc_analytics_consent=1(?:;|$)/.test(cookie)) return Response.json({ ok: false }, { status: 403 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'heatmap-ingest', 240, 600, 'client'))) return Response.json({ ok: false }, { status: 429 });

  try {
    const body = await req.json();
    const path = String(body.path || '/').slice(0, 200);
    const events = Array.isArray(body.events) ? body.events.slice(0, 30) : [];
    const clamp = (n: unknown) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)));
    const rows = events
      .filter((e: { type?: string }) => TYPES.has(String(e.type)))
      .map((e: { type: string; xPct: number; yPct: number; scrollPct: number }) => ({ path, type: e.type, xPct: clamp(e.xPct), yPct: clamp(e.yPct), scrollPct: clamp(e.scrollPct) }));
    if (!rows.length) return Response.json({ ok: false }, { status: 400 });
    const { db } = await import('@/lib/db');
    await db.heatmapEvent.createMany({ data: rows });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
