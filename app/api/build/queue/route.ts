import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { crmEnabled } from '@/lib/crm';

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
