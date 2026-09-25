import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// BLD-1345: manual trigger for the consultation-notification retro push, so the
// owner can send it immediately instead of waiting for the nightly cron (which
// runs the same job once via `backfillConsultNotificationsIfNeeded`).
//
// Body (all optional):
//   { emails: ["inna@…", "tetiana@…"] }  — send to these staff addresses exactly,
//                                          instead of matching on first name.
//
// Owner-gated: this sends real email to staff, so it needs the settings-grade
// permission. Deliberately re-runnable — the cron's one-shot latch does not apply
// here, so a first attempt that reached nobody can be corrected and repeated.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM is not enabled.' }, { status: 503 });

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) {
    return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const emails = Array.isArray(body?.emails)
    ? body.emails.map((e: unknown) => String(e).trim().toLowerCase()).filter(Boolean).slice(0, 20)
    : [];

  const { runConsultNotificationBackfill } = await import('@/lib/consult-notify-backfill');
  const result = await runConsultNotificationBackfill({ emails });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'NOTE_ADDED',
    actor: session!.email,
    actorRole: session!.role,
    summary: `Consultation-notification retro push: ${result.consultations} enquiries, emailed ${result.recipients.join(', ') || 'nobody'}${result.warning ? ` — ${result.warning}` : ''}`,
  }).catch(() => {});

  return NextResponse.json({ ok: !result.warning, ...result });
}
