import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Accounts are not enabled.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Enter your email and password.' }, { status: 422 });
  // Brute-force protection (parity with the client/admin logins, which were
  // throttled while this one wasn't).
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'academy-login', 10, 600, 'academy'))) return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  const { loginStudent } = await import('@/lib/academy-auth');
  const result = await loginStudent(parsed.data.email, parsed.data.password);
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}
