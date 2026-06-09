import { NextResponse } from 'next/server';
import { claimKioskDiscount } from '@/lib/kiosk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public. After sharing, a kiosk visitor creates an account and claims their
// single-use discount code. Share-gated + idempotent in claimKioskDiscount.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await claimKioskDiscount(id, String(body?.email || ''), String(body?.firstName || ''));
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
