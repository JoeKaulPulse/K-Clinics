import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Read a consent request's content for rendering, authed by the same unguessable
// request token used to sign it (POST /api/consent/sign). Lets the client's live
// phone companion present the form inline to read/tick/sign without leaving the
// page — the same content the public /sign/[token] page renders server-side.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { token } = await params;
  const { db } = await import('@/lib/db');
  const reqRow = await db.consentRequest.findUnique({ where: { token } });
  if (!reqRow) return NextResponse.json({ ok: false, status: 'notfound' }, { status: 404 });

  const template = await db.consentTemplate.findUnique({ where: { key: reqRow.templateKey } });
  const expired = reqRow.status === 'EXPIRED' || (reqRow.expiresAt != null && reqRow.expiresAt < new Date());
  const status = reqRow.status === 'SIGNED' ? 'signed' : expired ? 'expired' : (!template || !template.active) ? 'unavailable' : 'open';
  if (status !== 'open' || !template) {
    return NextResponse.json({ ok: true, status }, { headers: { 'cache-control': 'no-store' } });
  }

  const client = await db.client.findUnique({ where: { id: reqRow.clientId }, select: { firstName: true, lastName: true } });
  const { consentMdToHtml } = await import('@/lib/consent-md');
  return NextResponse.json({
    ok: true,
    status: 'open',
    token,
    title: template.title,
    bodyHtml: consentMdToHtml(template.bodyMd),
    acknowledgements: template.acknowledgements,
    defaultName: [client?.firstName, client?.lastName].filter(Boolean).join(' '),
    kind: reqRow.kind,
  }, { headers: { 'cache-control': 'no-store' } });
}
