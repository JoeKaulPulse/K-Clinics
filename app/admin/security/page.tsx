import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { SecurityCentre } from '@/components/admin/SecurityCentre';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'security.manage')) redirect('/admin');

  const { securityPosture, threatSummary } = await import('@/lib/security/dashboard');
  const { getRequired2faRoles } = await import('@/lib/security/twofa');
  const [{ checks, score }, threats, policy] = await Promise.all([securityPosture(), threatSummary(), getRequired2faRoles()]);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Security centre</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        The failsafe beneath the firewall — login protection, key health and live threat monitoring. Network-edge defences (DDoS, DNS, WAF) are configured in Vercel; this watches everything in the application layer.
      </p>
      <a href="/admin/security/activity" className="mt-3 inline-block text-sm font-medium text-[var(--color-gold)] hover:underline">
        Review IP &amp; device activity and block suspicious IPs →
      </a>
      <div className="mt-8">
        <SecurityCentre
          score={score}
          checks={checks}
          policy={policy}
          threats={{
            ...threats,
            recent: threats.recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
          }}
        />
      </div>
    </AdminShell>
  );
}
