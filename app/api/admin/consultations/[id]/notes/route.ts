import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mentionTokens(body: string): string[] {
  return Array.from(body.matchAll(/(?:^|\s)@([\w.+-]+@[\w.-]+|[\w.-]{2,})/g)).map((m) => m[1].toLowerCase());
}

async function resolveMentions(body: string, db: import('@prisma/client').PrismaClient): Promise<string[]> {
  const tokens = mentionTokens(body);
  if (!tokens.length) return [];
  const users = await db.adminUser.findMany({ where: { active: true }, select: { email: true, name: true } });
  const hits = new Set<string>();
  for (const t of tokens) {
    for (const u of users) {
      const email = u.email.toLowerCase();
      const local = email.split('@')[0];
      const nameTokens = (u.name || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (t === email || t === local || nameTokens.includes(t)) hits.add(u.email);
    }
  }
  return [...hits];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { getSession, sessionCan } = await import('@/lib/auth');
  const { crmEnabled } = await import('@/lib/crm');
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled.' }, { status: 503 });

  const session = await getSession();
  if (!session || !sessionCan(session, 'consultations.manage')) {
    return NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  }

  const { id } = await params;
  let body = '';
  try { body = ((await req.json()) as { body?: string }).body || ''; } catch { /* empty body */ }
  const trimmed = body.trim().slice(0, 3000);
  if (!trimmed) return NextResponse.json({ ok: false, error: 'Note cannot be empty.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const consult = await db.consultation.findUnique({
    where: { id },
    include: { client: { select: { firstName: true, lastName: true } } },
  });
  if (!consult) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

  const note = await db.consultationNote.create({
    data: { consultationId: id, body: trimmed, author: session.email },
  });

  // Resolve @-mentions and send in-app notifications (best-effort, non-blocking)
  try {
    const mentioned = await resolveMentions(trimmed, db);
    if (mentioned.length) {
      const { notifyStaff } = await import('@/lib/notifications');
      const clientName = [consult.client.firstName, consult.client.lastName].filter(Boolean).join(' ');
      const href = `/admin/consultations/${id}`;
      for (const m of mentioned) {
        await notifyStaff(
          m,
          { kind: 'mention', title: `You were mentioned in a note on ${clientName}'s consultation`, body: trimmed.slice(0, 90), href },
          session.email,
        );
      }
    }
  } catch { /* notifications are non-fatal */ }

  return NextResponse.json({ ok: true, note });
}
