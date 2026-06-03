import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage journal/blog posts. Requires settings.manage (owner/admin/manager).
const slugify = (s: string) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
const toList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : [];

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'delete') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'No id.' }, { status: 400 });
    await db.post.delete({ where: { id: body.id } }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const title = String(body.title || '').trim();
  if (!title) return NextResponse.json({ ok: false, error: 'Title is required.' }, { status: 400 });
  const status = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

  // Blocks are the source of truth; render to HTML for the public page + SEO.
  // (Older posts may still arrive as a raw `content` string — keep that path.)
  const { asBlocks, blocksToHtml, blocksToText } = await import('@/lib/blocks');
  const blocks = asBlocks(body.blocks);
  const content = blocks ? blocksToHtml(blocks) : String(body.content || '');
  const plain = blocks ? blocksToText(blocks) : content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const autoExcerpt = plain ? (plain.length > 200 ? plain.slice(0, 200).replace(/\s+\S*$/, '') + '…' : plain) : '';

  const data = {
    title: title.slice(0, 200),
    slug: slugify(body.slug || title),
    excerpt: (body.excerpt ? String(body.excerpt) : autoExcerpt).slice(0, 400) || null,
    metaDescription: body.metaDescription ? String(body.metaDescription).slice(0, 320) : null,
    content,
    blocks: blocks ?? undefined,
    category: body.category ? String(body.category).slice(0, 40) : null,
    coverImage: body.coverImage ? String(body.coverImage).slice(0, 500) : null,
    readMinutes: Math.max(1, Math.min(90, Number(body.readMinutes) || 5)),
    keywords: toList(body.keywords),
    related: toList(body.related),
    status: status as 'DRAFT' | 'PUBLISHED',
  };

  try {
    if (body.id) {
      const existing = await db.post.findUnique({ where: { id: body.id }, select: { publishedAt: true } });
      const post = await db.post.update({
        where: { id: body.id },
        data: { ...data, publishedAt: status === 'PUBLISHED' ? (existing?.publishedAt ?? new Date()) : null },
      });
      return NextResponse.json({ ok: true, id: post.id, slug: post.slug });
    }
    const post = await db.post.create({ data: { ...data, source: 'admin', publishedAt: status === 'PUBLISHED' ? new Date() : null } });
    return NextResponse.json({ ok: true, id: post.id, slug: post.slug });
  } catch (e) {
    const msg = (e as Error)?.message || '';
    const friendly = /Unique constraint|slug/i.test(msg) ? 'That URL slug is already used by another post.' : 'Could not save the post.';
    return NextResponse.json({ ok: false, error: friendly }, { status: 400 });
  }
}
