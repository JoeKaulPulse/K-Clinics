import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Public signing endpoint — authenticated by the unguessable request token.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || '');
  const signerName = String(body.signerName || '').trim().slice(0, 120);
  const acks = Array.isArray(body.acknowledgements) ? body.acknowledgements : [];
  const signatureDataUrl = String(body.signatureDataUrl || '');
  if (!token || !signerName) return NextResponse.json({ ok: false, error: 'Missing details.' }, { status: 400 });
  if (!signatureDataUrl.startsWith('data:image/') || signatureDataUrl.length > 600_000) return NextResponse.json({ ok: false, error: 'Invalid signature.' }, { status: 400 });
  if (acks.length === 0 || acks.some((a: { checked?: boolean }) => !a.checked)) return NextResponse.json({ ok: false, error: 'All confirmations are required.' }, { status: 400 });

  const { db } = await import('@/lib/db');
  const reqRow = await db.consentRequest.findUnique({ where: { token } });
  if (!reqRow) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
  if (reqRow.status !== 'PENDING') return NextResponse.json({ ok: false, error: 'This form is no longer open.' }, { status: 409 });
  if (reqRow.expiresAt && reqRow.expiresAt < new Date()) return NextResponse.json({ ok: false, error: 'This link has expired.' }, { status: 409 });

  const template = await db.consentTemplate.findUnique({ where: { key: reqRow.templateKey } });
  if (!template || !template.active) return NextResponse.json({ ok: false, error: 'Form unavailable.' }, { status: 409 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = req.headers.get('user-agent');

  const { createSignedConsent } = await import('@/lib/consent');
  const signed = await createSignedConsent({
    clientId: reqRow.clientId, bookingId: reqRow.bookingId, templateKey: template.key, templateVersion: template.version,
    title: template.title, kind: reqRow.kind, declined: reqRow.kind === 'photo_opt_out',
    signerName, bodyMd: template.bodyMd,
    acknowledgements: acks.map((a: { label: string; checked: boolean }) => ({ label: String(a.label).slice(0, 300), checked: !!a.checked })),
    signatureDataUrl, openedAt: body.openedAt ? String(body.openedAt) : null, ip, userAgent,
  });

  await db.consentRequest.update({ where: { id: reqRow.id }, data: { status: 'SIGNED', signedConsentId: signed.id } });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: reqRow.kind === 'photo_opt_out' ? 'CONSENT_DECLINED' : 'CONSENT_SIGNED',
    actor: 'client', clientId: reqRow.clientId, bookingId: reqRow.bookingId ?? undefined,
    summary: `${reqRow.kind === 'photo_opt_out' ? 'Declined before-photo' : 'Signed'} “${template.title}” · cert ${signed.contentHash.slice(0, 12)}`,
  });

  return NextResponse.json({ ok: true });
}
