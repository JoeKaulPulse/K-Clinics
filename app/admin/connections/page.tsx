import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { getConnectionCentre } from '@/lib/connection-centre';
import { ConnectionCentre } from '@/components/admin/ConnectionCentre';

export const dynamic = 'force-dynamic';

// One control surface for every external connection: live status, the keys each
// one needs (entered and saved here), the one-time Connect step for OAuth
// services, and the webhook/redirect URLs to register. Replaces hopping between
// Integrations, Credentials, API health and Marketing connections.
export default async function ConnectionsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const [centre, can, locale] = await Promise.all([getConnectionCentre(), sessionPermissions(), getLocale()]);

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Connection Centre</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Every external service in one place — its live status, the keys it needs, the Connect step for accounts like Xero
        or Google, and the exact webhook and redirect URLs to paste into each provider. Keys you save here are encrypted and
        take effect immediately, no redeploy. Press <span className="font-medium">Re-check now</span> to run live tests against
        every provider.
      </p>
      <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-gold)]/40 bg-[color-mix(in_oklab,var(--color-gold)_8%,transparent)] p-3 text-xs text-[var(--color-ink-soft)]">
        <span aria-hidden>🔒</span>
        <span>Keys are stored encrypted and never shown again — you can replace one but never read it back. For the raw key list see <a href="/admin/settings/credentials" className="text-[var(--color-gold)] hover:underline">Credentials</a>; for the full probe detail see <a href="/admin/api-health" className="text-[var(--color-gold)] hover:underline">API health</a>.</span>
      </div>

      <ConnectionCentre initial={centre} />
    </AdminShell>
  );
}
