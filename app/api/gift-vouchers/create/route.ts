import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({
  amountPence: z.number().int().positive(),
  purchaserName: z.string().min(1).max(120),
  purchaserEmail: z.string().email(),
  recipientName: z.string().max(120).optional().or(z.literal('')),
  recipientEmail: z.string().email().optional().or(z.literal('')),
  message: z.string().max(500).optional().or(z.literal('')),
  deliverAt: z.string().optional().or(z.literal('')),
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not available.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Check your details.' }, { status: 422 });
  if (parsed.data.company) return NextResponse.json({ ok: true });

  const { createVoucherIntent } = await import('@/lib/gift-vouchers');
  const res = await createVoucherIntent({
    amountPence: parsed.data.amountPence,
    purchaserName: parsed.data.purchaserName,
    purchaserEmail: parsed.data.purchaserEmail,
    recipientName: parsed.data.recipientName || undefined,
    recipientEmail: parsed.data.recipientEmail || undefined,
    message: parsed.data.message || undefined,
    deliverAt: parsed.data.deliverAt || null,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
