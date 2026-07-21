import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-533: community forum moderation. Requires settings.manage.
//   pinThread / lockThread / hideThread { id, value }
//   deleteThread { id }
//   hidePost { id, value } · deletePost { id }
//   staffReply { threadId, body } · staffCreateThread { category, title, body }
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const { db } = await import('@/lib/db');
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });
  const bad = (e = 'Bad request') => NextResponse.json({ ok: false, error: e }, { status: 400 });
  const staff = { email: session.email, name: str(session.name) };

  switch (b.op) {
    case 'pinThread': { if (!b.id) return bad(); await db.forumThread.update({ where: { id: String(b.id) }, data: { pinned: !!b.value } }); return ok(); }
    case 'lockThread': { if (!b.id) return bad(); await db.forumThread.update({ where: { id: String(b.id) }, data: { locked: !!b.value } }); return ok(); }
    case 'hideThread': { if (!b.id) return bad(); await db.forumThread.update({ where: { id: String(b.id) }, data: { hidden: !!b.value } }); return ok(); }
    case 'deleteThread': { if (!b.id) return bad(); await db.forumThread.delete({ where: { id: String(b.id) } }); return ok(); }
    case 'hidePost': { if (!b.id) return bad(); await db.forumPost.update({ where: { id: String(b.id) }, data: { hidden: !!b.value } }); return ok(); }
    case 'deletePost': {
      if (!b.id) return bad();
      const post = await db.forumPost.findUnique({ where: { id: String(b.id) }, select: { threadId: true } });
      await db.forumPost.delete({ where: { id: String(b.id) } });
      if (post) await db.forumThread.update({ where: { id: post.threadId }, data: { postCount: { decrement: 1 } } }).catch(() => {});
      return ok();
    }
    case 'staffReply': {
      if (!b.threadId) return bad('Missing thread.');
      const { staffReply } = await import('@/lib/forum');
      const res = await staffReply(staff, String(b.threadId), str(b.body));
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }
    case 'staffCreateThread': {
      const { staffCreateThread } = await import('@/lib/forum');
      const res = await staffCreateThread(staff, { category: str(b.category), title: str(b.title), body: str(b.body) });
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }
  }
  return bad('Unknown op');
}
