import { NextResponse } from 'next/server';
import { clientLoginSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) {
    return NextResponse.json({ ok: false, error: 'Accounts are not enabled in this environment.' }, { status: 503 });
  }
  const parsed = clientLoginSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Enter a valid email and password.' }, { status: 422 });
  }
  const { loginClient } = await import('@/lib/client-auth');
  const result = await loginClient(parsed.data.email, parsed.data.password);
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}
