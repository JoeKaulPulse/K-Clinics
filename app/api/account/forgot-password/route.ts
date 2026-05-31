import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: true }); // never reveal state
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: true }); // no enumeration
  try {
    const { requestPasswordReset } = await import('@/lib/client-auth');
    await requestPasswordReset(parsed.data.email);
  } catch (err) {
    console.error('[forgot-password] failed:', err);
  }
  // Always succeed to avoid leaking which emails are registered.
  return NextResponse.json({ ok: true });
}
