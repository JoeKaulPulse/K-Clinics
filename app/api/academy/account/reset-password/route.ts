import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ id: z.string().min(1), token: z.string().min(1), password: z.string().min(8) });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Please use at least 8 characters.' }, { status: 422 });
  try {
    const { enforceRateLimit } = await import('@/lib/security/guard');
    if (!(await enforceRateLimit(req, 'academy-reset', 10, 900, 'academy'))) {
      return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
    }
    const { performAcademyPasswordReset } = await import('@/lib/academy-auth');
    const result = await performAcademyPasswordReset(parsed.data.id, parsed.data.token, parsed.data.password);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error('[academy/reset-password] failed:', err);
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
