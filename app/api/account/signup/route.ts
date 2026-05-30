import { NextResponse } from 'next/server';
import { clientSignupSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  return xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip');
}

export async function POST(req: Request) {
  if (!crmEnabled) {
    return NextResponse.json({ ok: false, error: 'Accounts are not enabled in this environment.' }, { status: 503 });
  }
  const parsed = clientSignupSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Check your details.' }, { status: 422 });
  }
  if (parsed.data.company) return NextResponse.json({ ok: true, discount: { granted: false, percent: 15 } }); // honeypot

  const { signupClient } = await import('@/lib/client-auth');
  const result = await signupClient({ ...parsed.data, ip: clientIp(req) });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
