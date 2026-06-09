import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Build & Issues board API. GET lists items; POST handles create (any staff can
// report), update/github (managers), comment (any staff).
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('build.view');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  try {
    const { listBuildItems, githubConfigured, githubRepo, backlogSyncState, buildActivity } = await import('@/lib/build-board');
    const [items, github, repo, sync, activity] = await Promise.all([listBuildItems(), githubConfigured(), githubRepo(), backlogSyncState(), buildActivity()]);
    return NextResponse.json({ ok: true, items, github, githubRepo: repo, sync, activity });
  } catch (e) {
    console.error('[build] list failed', e);
    return NextResponse.json({ ok: false, error: 'Could not load the board.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission, sessionIsAdmin } = await import('@/lib/auth');
  const session = await requirePermission('build.view');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const manage = async () => !!(await requirePermission('build.manage'));
  try {
    const board = await import('@/lib/build-board');
    switch (b.op) {
      case 'create': {
        const title = String(b.title || '').trim();
        if (!title) return NextResponse.json({ ok: false, error: 'A short title is required.' }, { status: 400 });
        const item = await board.createBuildItem({
          type: b.type, title, detail: b.detail, urgency: b.urgency, assignee: b.assignee,
          reportedBy: session.email, pageUrl: b.pageUrl, screenshots: Array.isArray(b.screenshots) ? b.screenshots : [],
          value: b.value, effort: b.effort,
        }, session.email);
        return NextResponse.json({ ok: true, item });
      }
      case 'comment': {
        const body = String(b.body || '').trim();
        if (!b.id || !body) return NextResponse.json({ ok: false, error: 'Empty comment.' }, { status: 400 });
        const item = await board.addBuildComment(String(b.id), body, session.email);
        return NextResponse.json({ ok: true, item });
      }
      case 'update': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Managing the board needs permission.' }, { status: 403 });
        if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
        const item = await board.updateBuildItem(String(b.id), {
          status: b.status, urgency: b.urgency, assignee: b.assignee, blocker: b.blocker,
          value: b.value, effort: b.effort, estCompleteAt: b.estCompleteAt, estTokens: b.estTokens, actualTokens: b.actualTokens,
        }, session.email);
        return NextResponse.json({ ok: true, item });
      }
      case 'subtask-add': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Needs permission.' }, { status: 403 });
        if (!b.id || !String(b.title || '').trim()) return NextResponse.json({ ok: false, error: 'A subtask title is required.' }, { status: 400 });
        const item = await board.addSubtask(String(b.id), String(b.title), { assignee: b.assignee, ownerInput: !!b.ownerInput }, session.email);
        return NextResponse.json({ ok: true, item });
      }
      case 'subtask-update': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Needs permission.' }, { status: 403 });
        if (!b.subtaskId) return NextResponse.json({ ok: false, error: 'Missing subtask id.' }, { status: 400 });
        const item = await board.updateSubtask(String(b.subtaskId), { status: b.status, title: b.title, assignee: b.assignee }, session.email);
        return NextResponse.json({ ok: true, item });
      }
      case 'signoff': {
        // Final sign-off / close — admins (OWNER/ADMIN) only.
        if (!sessionIsAdmin(session)) return NextResponse.json({ ok: false, error: 'Only an admin can sign off and close a task.' }, { status: 403 });
        if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
        const item = await board.signoffItem(String(b.id), session.email);
        return NextResponse.json({ ok: true, item });
      }
      case 'reopen': {
        if (!sessionIsAdmin(session)) return NextResponse.json({ ok: false, error: 'Only an admin can reopen a task.' }, { status: 403 });
        if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
        const item = await board.reopenItem(String(b.id), b.reason, session.email);
        return NextResponse.json({ ok: true, item });
      }
      case 'continue': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Needs permission.' }, { status: 403 });
        const r = await board.requestClaudeContinue(session.email);
        return NextResponse.json(r);
      }
      case 'github': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Needs permission.' }, { status: 403 });
        if (!(await board.githubConfigured())) return NextResponse.json({ ok: false, error: 'GitHub isn’t connected yet.' }, { status: 400 });
        const item = await board.pushToGithub(String(b.id), session.email);
        return NextResponse.json({ ok: true, item });
      }
      case 'github-connect': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Needs permission.' }, { status: 403 });
        const repo = String(b.repo || '').trim();
        const token = String(b.token || '').trim();
        if (!repo || !token) return NextResponse.json({ ok: false, error: 'Enter the repo (owner/name) and a token.' }, { status: 400 });
        const r = await board.connectGithub(token, repo);
        return NextResponse.json(r, { status: r.ok ? 200 : 400 });
      }
      case 'github-disconnect': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Needs permission.' }, { status: 403 });
        await board.disconnectGithub();
        return NextResponse.json({ ok: true });
      }
      case 'seed-backlog': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Needs permission.' }, { status: 403 });
        const r = await board.rebuildBacklog(); // full sync: create missing + reconcile statuses + reassign
        return NextResponse.json({ ok: true, ...r });
      }
      case 'github-sync-all': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Needs permission.' }, { status: 403 });
        if (!(await board.githubConfigured())) return NextResponse.json({ ok: false, error: 'Connect GitHub first.' }, { status: 400 });
        const r = await board.syncAllToGithub(session.email);
        return NextResponse.json({ ok: true, ...r });
      }
    }
    return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
  } catch (e) {
    console.error('[build] op failed', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong — please retry.' }, { status: 500 });
  }
}
