import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Public, token-gated NPS capture (no auth). Records a 0–10 score and/or comment.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'nps', 20, 60))) return NextResponse.json({ ok: false, error: 'Please slow down a moment.' }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const token = String(b.token || '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });

  const { recordNps } = await import('@/lib/nps');
  const score = typeof b.score === 'number' ? b.score : undefined;
  const comment = typeof b.comment === 'string' ? b.comment : undefined;
  const r = await recordNps(token, { score, comment });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
