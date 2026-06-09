import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// People who can be @-mentioned in admin comments, plus Claude. The @-mention
// feature is for staff only: only admin users and clinicians/consultants get the
// picker (canMention), and it's never exposed to clients. Mentionable targets are
// all active team members (so anyone can be nudged).
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionIsAdmin } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { db } = await import('@/lib/db');
  let me: { isClinician: boolean } | null = null;
  try { me = await db.adminUser.findUnique({ where: { id: session.sub }, select: { isClinician: true } }); } catch { /* fall through */ }
  const canMention = sessionIsAdmin(session) || !!me?.isClinician;
  if (!canMention) return NextResponse.json({ ok: true, canMention: false, people: [] });

  let users: { email: string; name: string | null; role: string; isClinician: boolean }[] = [];
  try {
    users = await db.adminUser.findMany({ where: { active: true }, select: { email: true, name: true, role: true, isClinician: true }, orderBy: { name: 'asc' } });
  } catch { /* best-effort */ }

  const people = [
    { handle: 'claude', name: 'Claude', email: null as string | null, role: 'AI', isClinician: false },
    ...users.map((u) => ({ handle: u.email.split('@')[0], name: u.name || u.email.split('@')[0], email: u.email, role: u.role, isClinician: u.isClinician })),
  ];
  return NextResponse.json({ ok: true, canMention: true, people });
}
