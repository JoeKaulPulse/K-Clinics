import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { CrmDisabled } from '@/components/admin/CrmDisabled';

export const dynamic = 'force-dynamic';

const automations = [
  { name: 'Appointment reminder (72 h)', desc: 'A friendly heads-up three days before a confirmed appointment — time to reschedule without a fee.', kind: 'APPOINTMENT_REMINDER', trigger: '72 hours before visit', settingKey: 'reminder_72h' as const },
  { name: 'Appointment reminder (48 h)', desc: 'A gentle care reminder two days before a confirmed appointment, with a manage link.', kind: 'APPOINTMENT_REMINDER', trigger: '48 hours before visit', settingKey: 'reminder_48h' as const },
  { name: 'Pre-treatment form reminder', desc: 'Nudges clients with a portal account to complete their confidential health forms before arriving.', kind: 'FORM_REMINDER', trigger: '2 days before visit · forms outstanding', settingKey: null },
  { name: 'Birthday greeting', desc: "Sent on a client's birthday with a complimentary upgrade offer.", kind: 'BIRTHDAY', trigger: 'DOB matches today', settingKey: null },
  { name: 'Post-treatment follow-up', desc: 'Checks in 3 days after a completed appointment with aftercare + rebooking.', kind: 'FOLLOW_UP', trigger: '3 days after visit', settingKey: null },
  { name: 'Review request', desc: 'Invites a review 7 days after a completed treatment.', kind: 'REVIEW_REQUEST', trigger: '7 days after visit', settingKey: null },
  { name: 'Win-back', desc: "Re-engages clients who haven't visited in 6 months with a privilege.", kind: 'WIN_BACK', trigger: '6 months since last visit', settingKey: null },
];

export default async function AutomationsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const { db } = await import('@/lib/db');
  const { getSetting } = await import('@/lib/settings');
  const session = await getSession();
  if (!sessionCan(session, 'automations.view')) redirect('/admin');

  const since = new Date(Date.now() - 30 * 864e5);
  // Transactional emails (confirmations/receipts/reminders) carry no campaignId; a
  // FAILED row in the last 7 days means the provider isn't configured or the domain
  // isn't verified, so clients silently get nothing. Surface it (assessment #4).
  const failSince = new Date(Date.now() - 7 * 864e5);
  const [counts, r72, r48, failedComms, lastFail] = await Promise.all([
    db.emailEvent.groupBy({
      by: ['kind'],
      where: { status: 'SENT', createdAt: { gte: since } },
      _count: { _all: true },
    }),
    getSetting('reminder_72h'),
    getSetting('reminder_48h'),
    db.emailEvent.count({ where: { status: 'FAILED', campaignId: null, createdAt: { gte: failSince } } }),
    db.emailEvent.findFirst({ where: { status: 'FAILED', campaignId: null }, orderBy: { createdAt: 'desc' }, select: { subject: true, error: true } }),
  ]);
  const countFor = (kind: string) => counts.filter((c) => c.kind === kind).reduce((s, c) => s + c._count._all, 0);
  // Distinguish a rate-limit (key is fine, we sent too fast) from a real config gap,
  // so the fix shown is the right one.
  const rateLimited = /too many requests|rate.?limit|\b429\b/i.test(lastFail?.error || '');

  const settingEnabled: Record<string, boolean> = {
    reminder_72h: Boolean(r72),
    reminder_48h: Boolean(r48),
  };

  const can = await sessionPermissions();

  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.automations')}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Branded lifecycle emails, sent automatically by a daily job. Counts show the last 30 days.</p>

      {failedComms > 0 && (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-red-300 bg-red-50 p-5 text-red-900">
          <p className="font-[family-name:var(--font-display)] text-lg">{failedComms} transactional email{failedComms === 1 ? '' : 's'} failed to send in the last 7 days</p>
          <p className="mt-1 text-sm">
            {rateLimited
              ? 'These hit Resend’s limit of 5 requests/second during a burst (e.g. the nightly reminder run) — the API key is fine, the sends were just too fast.'
              : 'Booking confirmations, receipts and reminders only send when the email provider is configured.'}
            {lastFail?.error ? <> Latest failure{lastFail.subject ? ` (${lastFail.subject})` : ''}: <span className="font-mono text-xs">{lastFail.error}</span>.</> : null}
          </p>
          <p className="mt-2 text-sm">
            {rateLimited
              ? <>A send throttle (≈4.5/sec) and automatic retry are now in place, so this should clear on the next run. If it persists, raise the rate limit on your Resend plan.</>
              : <>Fix in <strong>Settings → Credentials</strong>: set <code>RESEND_API_KEY</code> and verify the sending domain in Resend.</>}
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {automations.map((a) => {
          const active = a.settingKey === null ? true : settingEnabled[a.settingKey] ?? false;
          return (
            <div key={`${a.kind}-${a.trigger}`} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-[family-name:var(--font-display)] text-xl">{a.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-[var(--color-gold)]/15 text-[var(--color-ink)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{active ? 'Active' : 'Off'}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-stone)]">{a.desc}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-stone)]">
                <span>Trigger: {a.trigger}</span>
                <span>{countFor(a.kind)} sent / 30d</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-[var(--color-stone)]">
        Automations respect marketing opt-in and unsubscribe status, and never double-send within their window.
        The daily runner is triggered by Vercel Cron (<code>/api/cron/daily</code>).
        The 72 h and 48 h reminders can be toggled individually under <strong>Settings → Notifications</strong>.
      </p>
    </AdminShell>
  );
}
