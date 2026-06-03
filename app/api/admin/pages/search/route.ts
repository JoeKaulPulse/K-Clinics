import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { asSections } from '@/lib/sections';

export const runtime = 'nodejs';

// Recursively gather all text from a page's sections (titles, headings,
// paragraphs, list/FAQ items, links…) for content search.
function collectText(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectText(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectText(v, out));
}

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ results: [] });
  const { requirePermission } = await import('@/lib/auth');
  if (!(await requirePermission('settings.manage'))) return NextResponse.json({ results: [] }, { status: 403 });

  const q = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { db } = await import('@/lib/db');
  let pages: { id: string; path: string; title: string | null; draft: unknown }[] = [];
  try { pages = await db.page.findMany({ select: { id: true, path: true, title: true, draft: true } }); } catch { return NextResponse.json({ results: [] }); }

  const results: { id: string; path: string; title: string | null; snippet: string }[] = [];
  for (const p of pages) {
    const parts: string[] = [];
    collectText(asSections(p.draft), parts);
    const text = parts.join(' · ');
    const idx = text.toLowerCase().indexOf(q);
    const inMeta = p.path.toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q);
    if (idx < 0 && !inMeta) continue;
    const snippet = idx >= 0 ? ('…' + text.slice(Math.max(0, idx - 40), idx + 80).trim() + '…') : '';
    results.push({ id: p.id, path: p.path, title: p.title, snippet });
  }
  return NextResponse.json({ results: results.slice(0, 30) });
}
