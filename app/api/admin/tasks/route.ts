import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH'];

// Internal task board. Any signed-in staff member can create, complete and
// reopen tasks; tasks can be assigned to a colleague and linked to a client.
//   GET  ?count=mine        → count of my open tasks (nav badge)
//   POST { op: 'create' | 'complete' | 'reopen' | 'delete' | 'assign' }
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  if (new URL(req.url).searchParams.get('count') === 'mine') {
    const { db } = await import('@/lib/db');
    const open = await db.task.count({ where: { assigneeId: session.sub, status: 'OPEN' } });
    return NextResponse.json({ ok: true, open });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'create') {
    const { title, detail, priority, dueAt, assigneeId, clientId } = body as {
      title?: string; detail?: string; priority?: string; dueAt?: string; assigneeId?: string; clientId?: string;
    };
    if (!title?.trim()) return NextResponse.json({ ok: false, error: 'A title is required.' }, { status: 400 });
    await db.task.create({
      data: {
        title: title.trim().slice(0, 200),
        detail: detail?.trim().slice(0, 2000) || null,
        priority: (PRIORITIES.includes(priority || '') ? priority : 'NORMAL') as never,
        dueAt: dueAt && !isNaN(Date.parse(dueAt)) ? new Date(dueAt) : null,
        assigneeId: assigneeId || null,
        clientId: clientId || null,
        createdBy: session.email,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'complete' || body.op === 'reopen') {
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    const done = body.op === 'complete';
    await db.task.update({
      where: { id },
      data: { status: done ? 'DONE' : 'OPEN', completedAt: done ? new Date() : null, completedBy: done ? session.email : null },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'assign') {
    const { id, assigneeId } = body as { id?: string; assigneeId?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.task.update({ where: { id }, data: { assigneeId: assigneeId || null } });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'delete') {
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    // Only the creator, the assignee, or a manager may delete a task — stops a
    // low-privilege account hard-deleting colleagues' (client-linked) tasks.
    const { sessionCan } = await import('@/lib/auth');
    const task = await db.task.findUnique({ where: { id }, select: { createdBy: true, assigneeId: true } });
    if (!task) return NextResponse.json({ ok: true });
    const mayDelete = task.createdBy === session.email || task.assigneeId === session.sub || sessionCan(session, 'settings.manage') || sessionCan(session, 'staff.view');
    if (!mayDelete) return NextResponse.json({ ok: false, error: 'You can only delete tasks you created or were assigned.' }, { status: 403 });
    await db.task.deleteMany({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
