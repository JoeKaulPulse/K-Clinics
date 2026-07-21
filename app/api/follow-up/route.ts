import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({ token: z.string().min(1), sentiment: z.enum(['great', 'ok', 'concerned']), comment: z.string().max(1000).optional().or(z.literal('')) });

export async function POST(req: Request) {
  // BLD-710: token-addressed public submission — throttle per IP so the token
  // space can't be brute-forced and the endpoint can't be flooded.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'follow-up', 10, 600))) {
    return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
  }
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Please choose how you’re doing.' }, { status: 422 });
  const { submitFollowUp } = await import('@/lib/followup');
  const res = await submitFollowUp(parsed.data.token, parsed.data.sentiment, parsed.data.comment || undefined);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
