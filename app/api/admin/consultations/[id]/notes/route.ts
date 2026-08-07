import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mentionTokens(body: string): string[] {
  return Array.from(body.matchAll(/(?:^|\s)@([\w.+-]+@[\w.-]+|[\w.-]{2,})/g)).map((m) => m[1].toLowerCase());
}

// BLD-1199 (review): each hit also carries whether THAT recipient holds
// clients.clinical.view. The mention notification quotes the first 90
// characters of the note, and the note body is clinical free-text (BLD-913) —
// so the quote is only included for recipients allowed to read it, otherwise
// gating the page and the POST handler just moves the leak into the
// notification bell (and, for a user who opted the clinical category into
// email, into their inbox).
async function resolveMentions(body: string, db: import('@prisma/client').PrismaClient): Promise<{ email: string; clinical: boolean }[]> {
  const tokens = mentionTokens(body);
  if (!tokens.length) return [];
  const users = await db.adminUser.findMany({ where: { active: true }, select: { email: true, name: true, role: true, permGrant: true, permRevoke: true } });
  const { hasPermission } = await import('@/lib/permissions');
  const hits = new Map<string, boolean>();
  for (const t of tokens) {
    for (const u of users) {
      const email = u.email.toLowerCase();
      const local = email.split('@')[0];
      const nameTokens = (u.name || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (t === email || t === local || nameTokens.includes(t)) hits.set(u.email, hasPermission(u, 'clients.clinical.view'));
    }
  }
  return [...hits].map(([email, clinical]) => ({ email, clinical }));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { getSession, sessionCan } = await import('@/lib/auth');
  const { crmEnabled } = await import('@/lib/crm');
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM disabled.' }, { status: 503 });

  const session = await getSession();
  // BLD-1199: note bodies can hold clinical detail (BLD-913), so authoring one
  // requires clients.clinical.view alongside consultations.manage.
  if (!session || !sessionCan(session, 'consultations.manage') || !sessionCan(session, 'clients.clinical.view')) {
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

  // BLD-913: team notes can hold clinical detail — encrypt at rest like every
  // structurally equivalent field (medicalNotes/allergies/clinicalNoteEnc).
  const { encClinical } = await import('@/lib/clinical-crypto');
  const note = await db.consultationNote.create({
    data: { consultationId: id, body: encClinical(trimmed) as string, author: session.email },
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
          m.email,
          {
            kind: 'mention',
            title: `You were mentioned in a note on ${clientName}'s consultation`,
            // Only quote the note to a recipient who may read clinical notes.
            body: m.clinical ? trimmed.slice(0, 90) : undefined,
            href,
          },
          session.email,
        );
      }
    }
  } catch { /* notifications are non-fatal */ }

  // Return the plaintext body — the cipher is an at-rest concern only.
  return NextResponse.json({ ok: true, note: { ...note, body: trimmed } });
}
