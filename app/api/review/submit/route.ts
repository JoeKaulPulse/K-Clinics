import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Public review submission (token-gated; no auth). Anyone with the unguessable
// link can submit once.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not available.' }, { status: 503 });
  const { token, rating, title, body, consent } = await req.json().catch(() => ({}));
  if (!token || typeof rating !== 'number' || rating < 1 || rating > 5) return NextResponse.json({ ok: false, error: 'Invalid submission.' }, { status: 400 });

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'review-submit', 10, 600))) return NextResponse.json({ ok: false, error: 'Please try again shortly.' }, { status: 429 });

  const { submitReview } = await import('@/lib/review-system');
  const r = await submitReview(String(token), Math.round(rating), String(title || '').slice(0, 150), String(body || '').slice(0, 2000), Boolean(consent));
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
