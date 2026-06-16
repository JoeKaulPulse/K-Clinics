import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Accounts are not enabled.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Enter your email and password.' }, { status: 422 });
  const email = parsed.data.email.toLowerCase();
  // Per-IP burst limiting + per-email account lockout (matching admin/client pattern).
  const { enforceRateLimit, loginGate, recordLogin } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'academy-login', 10, 600, 'academy'))) return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  const gate = await loginGate(email, req);
  if (gate.blocked) return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  const { loginStudent } = await import('@/lib/academy-auth');
  const result = await loginStudent(email, parsed.data.password);
  await recordLogin('academy', email, Boolean(result.ok), req);
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}
