import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { CrmDisabled } from '@/components/admin/CrmDisabled';

export const dynamic = 'force-dynamic';

const ICON: Record<string, string> = {
  BOOKING_CREATED: '＋', BOOKING_RESCHEDULED: '↻', BOOKING_CONFIRMED: '✓', BOOKING_CANCELLED: '✕',
  BOOKING_NO_SHOW: '∅', PRACTITIONER_ASSIGNED: '👤', APPOINTMENT_STARTED: '▶', APPOINTMENT_COMPLETED: '■',
  SOP_ACKNOWLEDGED: '📋', MEDICAL_FLAG_REVIEWED: '⚠', PAYMENT_CHARGED: '£', PAYMENT_FAILED: '⚠',
  ASSESSMENT_SUBMITTED: '✎', ASSESSMENT_VIEWED: '👁', NOTE_ADDED: '✎', TIMEOFF_ADDED: '🗓',
};

export default async function ActivityPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  // Activity log is sensitive — admins/owners (or anyone with staff.view) only.
  if (!sessionCan(session, 'staff.view')) redirect('/admin');

  const { recentAudit } = await import('@/lib/audit');
  const events = await recentAudit(120);

  const can = await sessionPermissions();

  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.activity')}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">An immutable, append-only record of actions across the clinic.</p>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {events.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No activity recorded yet.</p>}
        <ol className="divide-y divide-[var(--color-line)]">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-4 px-5 py-3.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-bone)] text-xs">{ICON[e.action] ?? '•'}</span>
              <div className="flex-1">
                <p className="text-sm">
                  {e.bookingId ? <Link href={`/admin/bookings/${e.bookingId}`} className="font-medium hover:text-[var(--color-gold-deep)]">{e.summary}</Link> : <span className="font-medium">{e.summary}</span>}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-stone)]">
                  {new Date(e.createdAt).toLocaleString('en-GB')} · {e.action.toLowerCase().replace(/_/g, ' ')} · {e.actor}{e.actorRole ? ` (${e.actorRole.toLowerCase()})` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </AdminShell>
  );
}
