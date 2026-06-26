import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-561: tag obvious test/junk client records so the list can hide them — or
// clear the tag from a record confirmed to be genuine. Reversible (tags only,
// never deletes). Gated on clients.edit (the "update details, notes and tags"
// permission). { op: 'scan' } | { op: 'untag', id }.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'clients.edit')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const op = body?.op === 'untag' ? 'untag' : 'scan';
  const { scanAndTagTestClients, untagTestClient } = await import('@/lib/test-clients');
  const { logAudit } = await import('@/lib/audit');

  if (op === 'untag') {
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ ok: false, error: 'Missing client id.' }, { status: 400 });
    await untagTestClient(id);
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session!.email, actorRole: session!.role, clientId: id, summary: 'Cleared likely-test tag (confirmed genuine)' }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const res = await scanAndTagTestClients();
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session!.email, actorRole: session!.role, summary: `Scanned for test/junk clients — tagged ${res.tagged} of ${res.scanned} inert records` }).catch(() => {});
  return NextResponse.json({ ok: true, ...res });
}
