import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({ voucherId: z.string().min(1) });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 422 });
  const { confirmVoucher } = await import('@/lib/gift-vouchers');
  const res = await confirmVoucher(parsed.data.voucherId);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
