import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ApiHealthPanel } from '@/components/admin/ApiHealthPanel';
import { getLastApiHealthReport } from '@/lib/api-health';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// API health — traffic lights driven by REAL calls to every external API
// (Stripe, Resend, Anthropic, Xero, TrueLayer, Meta, …) plus the public
// endpoints and cron heartbeats. Complements /admin/status, which audits
// configuration; this page proves each connection actually works right now.
export default async function ApiHealthPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session || !sessionCan(session, 'platform.status')) redirect('/admin');

  const can = await sessionPermissions();
  const locale = await getLocale();
  // Last stored report paints instantly; the panel then re-probes live.
  const initial = await getLastApiHealthReport();

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">API health</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
            Live checks against every connected service — each light is a real API call made from this
            server, not just “is the key set”. See <Link href="/admin/status" className="underline">Platform status</Link> for
            the configuration audit.
          </p>
        </div>
      </div>

      <ApiHealthPanel initial={initial ? JSON.parse(JSON.stringify(initial)) : null} />
    </AdminShell>
  );
}
