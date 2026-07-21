import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-533: trainee community forum (student actions).
//   POST { op:'createThread', category, title, body } → open a thread
//   POST { op:'reply', threadId, body }               → reply to a thread
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const forum = await import('@/lib/forum');

  if (b.op === 'createThread') {
    const res = await forum.createThread(student, { category: str(b.category), title: str(b.title), body: str(b.body) });
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }
  if (b.op === 'reply') {
    if (!b.threadId) return NextResponse.json({ ok: false, error: 'Missing thread.' }, { status: 400 });
    const res = await forum.replyToThread(student, String(b.threadId), str(b.body));
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}
