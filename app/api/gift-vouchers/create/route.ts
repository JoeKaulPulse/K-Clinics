import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';
import { VOUCHER_MAX } from '@/lib/gift-vouchers';

export const runtime = 'nodejs';

// BLD-1919: gift cards are always sold at full selected value — this schema
// deliberately has no promo/discount/coupon-code field, and `.strict()` below
// means a request carrying one (or any other unexpected field) is rejected
// outright rather than silently accepted and ignored. Do not add one.
const schema = z.object({
  amountPence: z.number().int().positive().max(VOUCHER_MAX),
  purchaserName: z.string().min(1).max(120),
  purchaserEmail: z.string().email(),
  recipientName: z.string().max(120).optional().or(z.literal('')),
  recipientEmail: z.string().email().optional().or(z.literal('')),
  message: z.string().max(500).optional().or(z.literal('')),
  deliverAt: z.string().optional().or(z.literal('')),
  design: z.string().max(40).optional().or(z.literal('')),
  packageSlug: z.string().max(120).optional().or(z.literal('')),
  physical: z.boolean().optional(),
  marketingOptIn: z.boolean().optional().default(false),
  ship: z.object({
    name: z.string().max(120).optional().or(z.literal('')),
    line1: z.string().max(160).optional().or(z.literal('')),
    line2: z.string().max(160).optional().or(z.literal('')),
    city: z.string().max(80).optional().or(z.literal('')),
    postcode: z.string().max(16).optional().or(z.literal('')),
  }).optional(),
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
}).strict();

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not available.' }, { status: 503 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!await enforceRateLimit(req, 'gift-voucher-create', 5, 600)) {
    return NextResponse.json({ ok: false, error: 'Too many requests — please wait 10 minutes.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Check your details.' }, { status: 422 });
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
    design: parsed.data.design || undefined,
    packageSlug: parsed.data.packageSlug || undefined,
    physical: parsed.data.physical || false,
    ship: parsed.data.ship,
    marketingOptIn: parsed.data.marketingOptIn,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
