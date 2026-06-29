import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { IpActivity } from '@/components/admin/IpActivity';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// IP & device activity + blocking. Gated on security.manage (same as the
// Security centre it links from). Aggregates the SecurityEvent log per source
// IP so staff can review who is hitting the site and block suspicious IPs.
export default async function IpActivityPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'security.manage')) redirect('/admin');

  const { ipActivity, listBlockedIps } = await import('@/lib/security/ip-activity');
  const [rows, blocked] = await Promise.all([ipActivity({ sinceDays: 7, take: 80 }), listBlockedIps()]);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">IP &amp; device activity</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Every source IP seen by the login/security layer over the last 7 days, the device (browser/OS) it used and the accounts it tried, so you can spot and block suspicious activity. Blocking an IP denies it the sign-in pages and throttled endpoints.
      </p>
      <div className="mt-8">
        <IpActivity
          rows={rows.map((r) => ({ ...r, lastSeen: r.lastSeen.toISOString() }))}
          blocked={blocked.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() }))}
        />
      </div>
    </AdminShell>
  );
}
