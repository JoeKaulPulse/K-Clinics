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
    const { listBuildItems, githubConfigured } = await import('@/lib/build-board');
    const items = await listBuildItems();
    return NextResponse.json({ ok: true, items, github: githubConfigured() });
  } catch (e) {
    console.error('[build] list failed', e);
    return NextResponse.json({ ok: false, error: 'Could not load the board.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
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
        const item = await board.updateBuildItem(String(b.id), { status: b.status, urgency: b.urgency, assignee: b.assignee, blocker: b.blocker }, session.email);
        return NextResponse.json({ ok: true, item });
      }
      case 'github': {
        if (!(await manage())) return NextResponse.json({ ok: false, error: 'Needs permission.' }, { status: 403 });
        if (!board.githubConfigured()) return NextResponse.json({ ok: false, error: 'GitHub isn’t connected (set GITHUB_TOKEN + GITHUB_REPO).' }, { status: 400 });
        const item = await board.pushToGithub(String(b.id), session.email);
        return NextResponse.json({ ok: true, item });
      }
    }
    return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
  } catch (e) {
    console.error('[build] op failed', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong — please retry.' }, { status: 500 });
  }
}
