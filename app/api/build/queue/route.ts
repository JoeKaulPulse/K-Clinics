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
      const created: { id: string; title: string }[] = [];
      const skipped: string[] = [];
      for (const it of items) {
        const title = String(it?.title || '').trim();
        if (!title) continue;
        // De-dupe against any existing item with the same title (avoids audit spam).
        const dup = await db.buildItem.findFirst({ where: { title }, select: { id: true } }).catch(() => null);
        if (dup) { skipped.push(title); continue; }
        const item = await board.createBuildItem({
          type: TYPES.includes(it?.type) ? it.type : 'TASK',
          title,
          detail: typeof it?.detail === 'string' ? it.detail : undefined,
          urgency: URGENCIES.includes(it?.urgency) ? it.urgency : 'P2',
          value: Number.isFinite(it?.value) ? it.value : undefined,
          effort: Number.isFinite(it?.effort) ? it.effort : undefined,
          assignee: 'claude',
          reportedBy: 'routine',
        }, 'routine');
        created.push({ id: item.id, title: item.title });
      }
      return NextResponse.json({ ok: true, created, skipped, createdCount: created.length });
    }
    if (b.action === 'continue') {
      const r = await board.requestClaudeContinue('routine');
      return NextResponse.json(r);
    }
    return NextResponse.json({ ok: false, error: 'Unknown action. Use "create" or "continue".' }, { status: 400 });
  } catch (e) {
    console.error('[build/queue] write failed', e);
    return NextResponse.json({ ok: false, error: 'Write failed.' }, { status: 500 });
  }
}
