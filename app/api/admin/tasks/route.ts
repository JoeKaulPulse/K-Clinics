import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH'];

// Internal task board. Any signed-in staff member can create, complete and
// reopen tasks; tasks can be assigned to a colleague and linked to a client.
// Every task gets a stable reference ID (TSK-12; sub-tasks branch as TSK-12.1)
// for tracing and search — see lib/task-refs.ts.
//   GET  ?count=mine        → count of my open tasks (nav badge)
//   POST { op: 'create' | 'complete' | 'reopen' | 'delete' | 'assign' }
//        create accepts parentId to add a sub-task under an existing task.
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
    const { title, detail, priority, dueAt, assigneeId, clientId, parentId } = body as {
      title?: string; detail?: string; priority?: string; dueAt?: string; assigneeId?: string; clientId?: string; parentId?: string;
    };
    if (!title?.trim()) return NextResponse.json({ ok: false, error: 'A title is required.' }, { status: 400 });

    // Sub-task: validate the parent and keep ref branches readable (max depth).
    const { assignTaskRef, refDepth, MAX_REF_DEPTH } = await import('@/lib/task-refs');
    let parent: { id: string; ref: string | null; clientId: string | null } | null = null;
    if (parentId) {
      parent = await db.task.findUnique({ where: { id: parentId }, select: { id: true, ref: true, clientId: true } });
      if (!parent) return NextResponse.json({ ok: false, error: 'Parent task not found.' }, { status: 400 });
      if (parent.ref && refDepth(parent.ref) >= MAX_REF_DEPTH) {
        return NextResponse.json({ ok: false, error: 'Sub-tasks can only nest this deep — add it to the top-level task instead.' }, { status: 400 });
      }
    }

    const created = await db.task.create({
      data: {
        title: title.trim().slice(0, 200),
        detail: detail?.trim().slice(0, 2000) || null,
        priority: (PRIORITIES.includes(priority || '') ? priority : 'NORMAL') as never,
        dueAt: dueAt && !isNaN(Date.parse(dueAt)) ? new Date(dueAt) : null,
        assigneeId: assigneeId || null,
        clientId: clientId || parent?.clientId || null, // sub-tasks inherit the parent's client link
        parentId: parent?.id || null,
        createdBy: session.email,
      },
      select: { id: true },
    });
    const ref = await assignTaskRef(created.id).catch(() => null); // task exists even if ref assignment hiccups; backfill self-heals
    // PRJ-63.11: ping the assignee (e.g. admin → contractor) + activity log.
    if (assigneeId && assigneeId !== session.sub) {
      const { notifyStaffById } = await import('@/lib/notifications');
      await notifyStaffById(assigneeId, { kind: 'assigned', title: 'New task assigned to you', body: title.trim().slice(0, 200), href: '/admin/tasks' }, session.sub);
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'TASK_ASSIGNED', actor: session.email, summary: `Assigned task “${title.trim().slice(0, 120)}”`, meta: { taskId: created.id, ref } }).catch(() => {});
    }
    return NextResponse.json({ ok: true, id: created.id, ref });
  }

  if (body.op === 'complete' || body.op === 'reopen') {
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    const done = body.op === 'complete';
    const task = await db.task.findUnique({ where: { id }, select: { title: true, createdBy: true, ref: true } });
    await db.task.update({
      where: { id },
      data: { status: done ? 'DONE' : 'OPEN', completedAt: done ? new Date() : null, completedBy: done ? session.email : null },
    });
    // PRJ-63.11: on completion, ping the task's creator (e.g. contractor done →
    // admin) and log it. Only when someone other than the creator finishes it.
    if (done && task?.createdBy && task.createdBy.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
      const { notifyStaff } = await import('@/lib/notifications');
      await notifyStaff(task.createdBy, { kind: 'status', title: 'A task you created is done', body: task.title.slice(0, 200), href: '/admin/tasks' }, session.email);
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'TASK_COMPLETED', actor: session.email, summary: `Completed task “${task.title.slice(0, 120)}”`, meta: { taskId: id, ref: task.ref } }).catch(() => {});
    }
    // Fire any ON_TASK_COMPLETED automations (e.g. "after a deep clean, schedule the next").
    if (done && task?.title) {
      const { onTaskCompleted } = await import('@/lib/task-automations');
      await onTaskCompleted(id, task.title).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'assign') {
    const { id, assigneeId } = body as { id?: string; assigneeId?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.task.update({ where: { id }, data: { assigneeId: assigneeId || null } });
    // PRJ-63.11: ping the newly-assigned colleague + activity log.
    if (assigneeId && assigneeId !== session.sub) {
      const t = await db.task.findUnique({ where: { id }, select: { title: true, ref: true } });
      const { notifyStaffById } = await import('@/lib/notifications');
      await notifyStaffById(assigneeId, { kind: 'assigned', title: 'A task was assigned to you', body: t?.title?.slice(0, 200), href: '/admin/tasks' }, session.sub);
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'TASK_ASSIGNED', actor: session.email, summary: `Assigned task “${(t?.title || '').slice(0, 120)}”`, meta: { taskId: id, ref: t?.ref } }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'delete') {
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    // Only the creator, the assignee, or a manager may delete a task — stops a
    // low-privilege account hard-deleting colleagues' (client-linked) tasks.
    // Deleting a parent cascades to its sub-tasks (the branch is one unit).
    const { sessionCan } = await import('@/lib/auth');
    const task = await db.task.findUnique({ where: { id }, select: { createdBy: true, assigneeId: true } });
    if (!task) return NextResponse.json({ ok: true });
    const mayDelete = task.createdBy === session.email || task.assigneeId === session.sub || sessionCan(session, 'settings.manage') || sessionCan(session, 'staff.view');
    if (!mayDelete) return NextResponse.json({ ok: false, error: 'You can only delete tasks you created or were assigned.' }, { status: 403 });
    await db.task.deleteMany({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'comments') {
    const { taskId } = body as { taskId?: string };
    if (!taskId) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    const rows = await db.taskComment.findMany({
      where: { taskId }, orderBy: { createdAt: 'asc' }, take: 200,
      include: { task: { select: { id: true } } },
    });
    // Author display names (by id), resolved in one pass.
    const ids = Array.from(new Set(rows.map((r) => r.authorId).filter(Boolean))) as string[];
    const authors = ids.length ? await db.adminUser.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, photoUrl: true } }) : [];
    const byId = new Map(authors.map((a) => [a.id, a]));
    return NextResponse.json({
      ok: true,
      comments: rows.map((r) => ({
        id: r.id, body: r.body, createdAt: r.createdAt.toISOString(),
        authorId: r.authorId, mentionIds: r.mentionIds,
        authorName: (r.authorId && byId.get(r.authorId)?.name) || (r.authorId && byId.get(r.authorId)?.email) || r.authorEmail || 'Unknown',
        authorPhoto: (r.authorId && byId.get(r.authorId)?.photoUrl) || null,
      })),
    });
  }

  if (body.op === 'comment') {
    const { taskId, mentionIds } = body as { taskId?: string; body?: string; mentionIds?: string[] };
    const text = (body.body as string | undefined)?.trim().slice(0, 2000) || '';
    if (!taskId || !text) return NextResponse.json({ ok: false, error: 'Type a comment.' }, { status: 400 });
    const task = await db.task.findUnique({ where: { id: taskId }, select: { id: true, title: true, ref: true, assigneeId: true, createdBy: true } });
    if (!task) return NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404 });
    const mentions = Array.isArray(mentionIds) ? Array.from(new Set(mentionIds.map(String))).filter((x) => x !== session.sub) : [];
    await db.taskComment.create({ data: { taskId, authorId: session.sub, authorEmail: session.email, body: text, mentionIds: mentions } });
    await db.task.update({ where: { id: taskId }, data: { updatedAt: new Date() } }).catch(() => {});

    const { notifyStaffById, notifyStaff } = await import('@/lib/notifications');
    const snippet = text.slice(0, 140);
    // @-mentioned colleagues first (higher priority), then the assignee + creator.
    for (const uid of mentions) {
      await notifyStaffById(uid, { kind: 'mention', category: 'team', priority: 'high', title: `You were mentioned on ${task.ref || 'a task'}`, body: snippet, href: '/admin/tasks' }, session.sub).catch(() => {});
    }
    const notified = new Set(mentions);
    if (task.assigneeId && task.assigneeId !== session.sub && !notified.has(task.assigneeId)) {
      await notifyStaffById(task.assigneeId, { kind: 'comment', category: 'team', title: `New comment on ${task.ref || 'your task'}`, body: snippet, href: '/admin/tasks' }, session.sub).catch(() => {});
      notified.add(task.assigneeId);
    }
    if (task.createdBy && task.createdBy.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
      await notifyStaff(task.createdBy, { kind: 'comment', category: 'team', title: `New comment on ${task.ref || 'a task you created'}`, body: snippet, href: '/admin/tasks' }, session.email).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
