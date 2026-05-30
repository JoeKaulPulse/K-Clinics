import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().max(80).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  dob: z.string().optional().or(z.literal('')),
  marketingOptIn: z.boolean().optional(),
  // Optional password change
  newPassword: z.string().min(8).max(200).optional(),
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { getClientSession, hashPassword } = await import('@/lib/auth');
  const session = await getClientSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Check your details.' }, { status: 422 });
  const d = parsed.data;

  const { db } = await import('@/lib/db');
  const data: Record<string, unknown> = {};
  if (d.firstName !== undefined) data.firstName = d.firstName;
  if (d.lastName !== undefined) data.lastName = d.lastName || null;
  if (d.phone !== undefined) data.phone = d.phone || null;
  if (d.dob) data.dob = new Date(d.dob);
  if (typeof d.marketingOptIn === 'boolean') data.marketingOptIn = d.marketingOptIn;
  if (d.newPassword) data.passwordHash = await hashPassword(d.newPassword);

  await db.client.update({ where: { id: session.sub }, data });
  return NextResponse.json({ ok: true });
}
