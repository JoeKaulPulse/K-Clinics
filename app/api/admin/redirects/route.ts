import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { site } from '@/lib/site';

export const runtime = 'nodejs';

// Manage URL redirects (single + bulk). Requires settings.manage.
function normFrom(input: string): string {
  let p = String(input || '').trim();
  // Accept a full old URL and reduce it to a site-relative path.
  try { if (/^https?:\/\//i.test(p)) p = new URL(p).pathname; } catch { /* keep as-is */ }
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\s+/g, '');
  if (p.length > 1) p = p.replace(/\/+$/, ''); // drop trailing slash (except root)
  return p.slice(0, 512);
}
const normTo = (input: string) => {
  const t = String(input || '').trim();
  if (/^https?:\/\//i.test(t)) return t.slice(0, 1000);
  // Strip our own origin if pasted, keep relative.
  try { const u = new URL(t); if (u.origin === site.url.replace(/\/$/, '')) return (u.pathname + u.search).slice(0, 1000); } catch { /* relative */ }
  return (t.startsWith('/') ? t : `/${t}`).slice(0, 1000);
};

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { logAudit } = await import('@/lib/audit');
  const ok = () => NextResponse.json({ ok: true });
  const bad = (error = 'Bad request') => NextResponse.json({ ok: false, error }, { status: 400 });
  const done = async (summary: string) => { await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary }); revalidatePath('/admin/redirects'); };

  switch (body.op) {
    case 'create': {
      const fromPath = normFrom(body.fromPath);
      const toUrl = normTo(body.toUrl);
      if (!fromPath || fromPath === '/' || !toUrl) return bad('A from-path and destination are required.');
      const code = body.code === 302 ? 302 : 301;
      if (await db.redirect.findUnique({ where: { fromPath } })) return bad('A redirect for that path already exists.');
      await db.redirect.create({ data: { fromPath, toUrl, code, note: body.note ? String(body.note).slice(0, 200) : null, createdBy: session.email } });
      await done(`Created redirect ${fromPath} → ${toUrl}`);
      return ok();
    }
    case 'update': {
      if (!body.id) return bad();
      const existing = await db.redirect.findUnique({ where: { id: body.id } });
      if (!existing) return bad('Not found');
      const data: Record<string, unknown> = {};
      if (body.fromPath !== undefined) {
        const fromPath = normFrom(body.fromPath);
        if (fromPath !== existing.fromPath && (await db.redirect.findUnique({ where: { fromPath } }))) return bad('Another redirect already uses that path.');
        data.fromPath = fromPath;
      }
      if (body.toUrl !== undefined) data.toUrl = normTo(body.toUrl);
      if (body.code !== undefined) data.code = body.code === 302 ? 302 : 301;
      if (typeof body.active === 'boolean') data.active = body.active;
      if (body.note !== undefined) data.note = body.note ? String(body.note).slice(0, 200) : null;
      await db.redirect.update({ where: { id: body.id }, data });
      await done(`Updated redirect ${existing.fromPath}`);
      return ok();
    }
    case 'remove': {
      if (!body.id) return bad();
      const existing = await db.redirect.findUnique({ where: { id: body.id } });
      if (!existing) return bad('Not found');
      await db.redirect.delete({ where: { id: body.id } });
      await done(`Deleted redirect ${existing.fromPath}`);
      return ok();
    }
    case 'bulk': {
      // Paste lines: "from , to" / "from -> to" / "from <tab> to".
      const lines = String(body.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
      let created = 0, skipped = 0;
      for (const line of lines) {
        const parts = line.split(/\s*(?:,|=>|->|\t|\s→\s)\s*/).filter(Boolean);
        if (parts.length < 2) { skipped++; continue; }
        const fromPath = normFrom(parts[0]);
        const toUrl = normTo(parts[1]);
        if (!fromPath || fromPath === '/' || !toUrl) { skipped++; continue; }
        try {
          await db.redirect.upsert({ where: { fromPath }, create: { fromPath, toUrl, code: 301, createdBy: session.email }, update: { toUrl } });
          created++;
        } catch { skipped++; }
      }
      await done(`Bulk redirects: ${created} added/updated, ${skipped} skipped`);
      return NextResponse.json({ ok: true, created, skipped });
    }
    default:
      return bad('Unknown operation');
  }
}
