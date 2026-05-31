import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { CrmDisabled } from '@/components/admin/CrmDisabled';

export const dynamic = 'force-dynamic';

const automations = [
  { name: 'Appointment reminder', desc: 'A gentle care reminder the day before a confirmed appointment, with a manage link.', kind: 'APPOINTMENT_REMINDER', trigger: '24 hours before visit' },
  { name: 'Pre-treatment form reminder', desc: 'Nudges clients with a portal account to complete their confidential health forms before arriving.', kind: 'FORM_REMINDER', trigger: '2 days before visit · forms outstanding' },
  { name: 'Birthday greeting', desc: 'Sent on a client’s birthday with a complimentary upgrade offer.', kind: 'BIRTHDAY', trigger: 'DOB matches today' },
  { name: 'Post-treatment follow-up', desc: 'Checks in 3 days after a completed appointment with aftercare + rebooking.', kind: 'FOLLOW_UP', trigger: '3 days after visit' },
  { name: 'Review request', desc: 'Invites a review 7 days after a completed treatment.', kind: 'REVIEW_REQUEST', trigger: '7 days after visit' },
  { name: 'Win-back', desc: 'Re-engages clients who haven’t visited in 6 months with a privilege.', kind: 'WIN_BACK', trigger: '6 months since last visit' },
];

export default async function AutomationsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const { db } = await import('@/lib/db');
  const session = await getSession();
  if (!sessionCan(session, 'automations.view')) redirect('/admin');

  const since = new Date(Date.now() - 30 * 864e5);
  const counts = await db.emailEvent.groupBy({
    by: ['kind'],
    where: { status: 'SENT', createdAt: { gte: since } },
    _count: { _all: true },
  });
  const countFor = (kind: string) => counts.find((c) => c.kind === kind)?._count._all ?? 0;

  const can = await sessionPermissions();

  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.automations')}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Branded lifecycle emails, sent automatically by a daily job. Counts show the last 30 days.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {automations.map((a) => (
          <div key={a.kind} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-xl">{a.name}</h2>
              <span className="rounded-full bg-[var(--color-gold)]/15 px-3 py-1 text-xs text-[var(--color-ink)]">Active</span>
            </div>
            <p className="mt-2 text-sm text-[var(--color-stone)]">{a.desc}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-stone)]">
              <span>Trigger: {a.trigger}</span>
              <span>{countFor(a.kind)} sent / 30d</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-[var(--color-stone)]">
        Automations respect marketing opt-in and unsubscribe status, and never double-send within their window.
        The daily runner is triggered by Vercel Cron (<code>/api/cron/daily</code>).
      </p>
    </AdminShell>
  );
}
