import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Save / delete reusable marketing-email templates. Requires campaigns.send.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('campaigns.send');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'delete') {
    if (!body.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
    await db.emailTemplate.deleteMany({ where: { id: String(body.id) } });
    return NextResponse.json({ ok: true });
  }

  // Default op: save a new template from the current composer state.
  const name = String(body.name || '').trim().slice(0, 80);
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  if (!name) return NextResponse.json({ ok: false, error: 'Give the template a name.' }, { status: 400 });
  if (blocks.length === 0) return NextResponse.json({ ok: false, error: 'Add some content first.' }, { status: 400 });

  const t = await db.emailTemplate.create({
    data: {
      name,
      subject: String(body.subject || '').slice(0, 200) || null,
      preheader: String(body.preheader || '').slice(0, 160) || null,
      fromName: String(body.fromName || '').slice(0, 80) || null,
      body: JSON.stringify(blocks),
      createdBy: session.email,
    },
  });
  return NextResponse.json({ ok: true, id: t.id });
}
