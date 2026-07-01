import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { crmEnabled } from '@/lib/crm';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Token-authed, read-only work queue for unattended Claude Code routine sessions.
// A routine has no admin login cookie, so it authenticates with a shared secret
// (BOARD_QUEUE_TOKEN, set in Vercel + in the routine's environment). This lets a
// routine see live, DB-only board items (e.g. reported bugs) — not just the
// backlog in code — and act on the highest-priority unblocked work.
function tokenOk(req: Request): boolean {
  const secret = process.env.BOARD_QUEUE_TOKEN;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '').trim();
  if (!provided || provided.length !== secret.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret)); } catch { return false; }
}

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });
  if (!process.env.BOARD_QUEUE_TOKEN) return NextResponse.json({ ok: false, error: 'Queue token not configured. Set BOARD_QUEUE_TOKEN.' }, { status: 503 });
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  try {
    const { routineQueue } = await import('@/lib/build-board');
    return NextResponse.json({ ok: true, ...(await routineQueue()) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[build/queue] failed', e);
    return NextResponse.json({ ok: false, error: 'Could not load the queue.' }, { status: 500 });
  }
}

const TYPES = ['ERROR', 'TASK', 'IDEA', 'REVIEW', 'AUDIT'];
const URGENCIES = ['P0', 'P1', 'P2', 'P3'];

// Token-authed writes for routine sessions (e.g. the End-of-Day Audit):
//  { action: 'create', items: [{ type, title, detail, urgency, value, effort }] }
//  { action: 'update', id|ref, comment?, status? } → progress/annotate an item
//    (status limited to working states — CLOSED stays an admin sign-off)
//  { action: 'continue' }  → fire the night fix routine (subject to the daily cap)
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled' }, { status: 503 });
  if (!process.env.BOARD_QUEUE_TOKEN) return NextResponse.json({ ok: false, error: 'Queue token not configured.' }, { status: 503 });
  if (!tokenOk(req)) return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const board = await import('@/lib/build-board');
  try {
    if (b.action === 'create') {
      const items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
      if (!items.length) return NextResponse.json({ ok: false, error: 'No items.' }, { status: 400 });
      // Optional: file every created item under one Project (e.g. a security
      // audit). Find-or-create it once, then link each new item to it.
      let projectId: string | undefined;
      let projectRef: string | null = null;
      if (b.project && typeof b.project === 'string') {
        const proj = await board.ensureProject(b.project, typeof b.projectSummary === 'string' ? b.projectSummary : undefined);
        if (proj) { projectId = proj.id; projectRef = proj.ref; }
      }
      const created: { id: string; title: string }[] = [];
      const skipped: string[] = [];
      for (const it of items) {
        const title = String(it?.title || '').trim();
        if (!title) continue;
        // De-dupe against any existing item with the same title (avoids audit spam).
        const dup = await db.buildItem.findFirst({ where: { title }, select: { id: true, projectId: true } }).catch(() => null);
        if (dup) {
          // Back-fill the project link on a pre-existing item so a re-run still
          // groups it correctly, but don't otherwise touch it.
          if (projectId && !dup.projectId) await db.buildItem.update({ where: { id: dup.id }, data: { projectId } }).catch(() => {});
          skipped.push(title);
          continue;
        }
        const item = await board.createBuildItem({
          type: TYPES.includes(it?.type) ? it.type : 'TASK',
          title,
          detail: typeof it?.detail === 'string' ? it.detail : undefined,
          urgency: URGENCIES.includes(it?.urgency) ? it.urgency : 'P2',
          value: Number.isFinite(it?.value) ? it.value : undefined,
          effort: Number.isFinite(it?.effort) ? it.effort : undefined,
          assignee: 'claude',
          reportedBy: 'routine',
          projectId,
        }, 'routine');
        created.push({ id: item.id, title: item.title });
      }
      return NextResponse.json({ ok: true, created, skipped, createdCount: created.length, projectRef });
    }
    if (b.action === 'update') {
      // Look up by DB id or by reference ID (e.g. BLD-12) — refs are the
      // traceable handle routine sessions already cite in commits/PRs.
      let item = b.id ? await db.buildItem.findUnique({ where: { id: String(b.id) }, select: { id: true, status: true } }).catch(() => null) : null;
      if (!item && b.ref) item = await db.buildItem.findFirst({ where: { ref: String(b.ref) }, select: { id: true, status: true } }).catch(() => null);
      if (!item) return NextResponse.json({ ok: false, error: 'Item not found (pass id or ref).' }, { status: 404 });
      const comment = typeof b.comment === 'string' ? b.comment.trim() : '';
      if (comment) await board.addBuildComment(item.id, comment, 'routine');
      // Working states only: sign-off (CLOSED) and CANCELLED remain human calls.
      const ROUTINE_STATUSES = ['TRIAGE', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'SHIPPED'];
      let updated = null;
      if (b.status) {
        if (!ROUTINE_STATUSES.includes(b.status)) return NextResponse.json({ ok: false, error: `Status must be one of ${ROUTINE_STATUSES.join(', ')}.` }, { status: 400 });
        updated = await board.updateBuildItem(item.id, { status: b.status }, 'routine');
      }
      return NextResponse.json({ ok: true, id: item.id, status: updated?.status ?? item.status, commented: Boolean(comment) });
    }
    if (b.action === 'continue') {
      const r = await board.requestClaudeContinue('routine');
      return NextResponse.json(r);
    }
    return NextResponse.json({ ok: false, error: 'Unknown action. Use "create", "update" or "continue".' }, { status: 400 });
  } catch (e) {
    console.error('[build/queue] write failed', e);
    return NextResponse.json({ ok: false, error: 'Write failed.' }, { status: 500 });
  }
}
