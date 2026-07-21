import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SMS provider diagnostic (BLD-668). GET validates the Twilio credentials
// read-only (no message sent); POST { to, message? } sends one real test text.
// Gated on settings.manage and audited — staff can confirm SMS is wired up
// before relying on booking confirmations/reminders.

export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const { smsProviderStatus } = await import('@/lib/sms');
  return NextResponse.json({ ok: true, status: await smsProviderStatus() });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { to, message } = (await req.json().catch(() => ({}))) as { to?: string; message?: string };
  if (!to || (to.match(/\d/g) || []).length < 7) {
    return NextResponse.json({ ok: false, error: 'A valid destination phone number is required.' }, { status: 400 });
  }

  const { sendSms } = await import('@/lib/sms');
  const body = (message?.trim() || 'KClinics SMS test — your text messaging is working. No action needed.').slice(0, 320);
  const res = await sendSms(to, body);

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'SETTINGS_UPDATED',
    actor: session!.email,
    actorRole: session!.role,
    summary: `Sent a Twilio test SMS to ${to} — ${res.ok ? (res.dummy ? 'dummy (not configured)' : `sent (${res.id})`) : `failed: ${res.error}`}`,
  }).catch(() => {});

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error || 'Send failed.' }, { status: 502 });
  // dummy:true means Twilio isn't actually configured — surface that clearly.
  return NextResponse.json({ ok: true, dummy: res.dummy ?? false, id: res.id });
}
