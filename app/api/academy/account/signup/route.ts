import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional().or(z.literal('')),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal('')),
  password: z.string().min(8).max(200),
  company: z.string().max(0).optional().or(z.literal('')),
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Accounts are not enabled.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Check your details.' }, { status: 422 });
  if (parsed.data.company) return NextResponse.json({ ok: true });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'academy-signup', 10, 600, 'academy'))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }
  if (await (await import('@/lib/security/breached-password')).isBreachedPassword(parsed.data.password)) {
    return NextResponse.json({ ok: false, error: 'That password has appeared in a known data breach. Please choose a different one.' }, { status: 400 });
  }
  const { signupStudent } = await import('@/lib/academy-auth');
  const result = await signupStudent(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
