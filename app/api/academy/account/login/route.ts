import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Accounts are not enabled.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Enter your email and password.' }, { status: 422 });
  const { loginStudent } = await import('@/lib/academy-auth');
  const result = await loginStudent(parsed.data.email, parsed.data.password);
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}
