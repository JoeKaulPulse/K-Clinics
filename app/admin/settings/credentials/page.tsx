import { redirect } from 'next/navigation';
import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';
import { secretStatus } from '@/lib/secrets';
import { CredentialsManager } from '@/components/admin/CredentialsManager';

export const dynamic = 'force-dynamic';

// Owner-managed credentials: enter integration API keys here instead of hosting
// env vars. Values are encrypted at rest and the app prefers them over env (with
// env as fallback). Owner/admin only.
export default async function CredentialsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const secrets = await secretStatus();
  const can = await sessionPermissions();
  const locale = await getLocale();

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Credentials &amp; API keys</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Enter your integration keys here and they take effect immediately — no developer or redeploy needed. Values are
        encrypted and never shown again; we only display whether each one is set. A key set here always overrides the
        hosting environment; if you clear it, the app falls back to any hosting value. See <Link href="/admin/integrations" className="text-[var(--color-gold-deep)] hover:underline">Integrations</Link> for live connection status.
      </p>
      <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-gold)]/40 bg-[color-mix(in_oklab,var(--color-gold)_8%,transparent)] p-3 text-xs text-[var(--color-ink-soft)]">
        <span aria-hidden>🔒</span>
        <span>Treat these like passwords. Keys are stored encrypted (AES-256) and are only readable by the server. Anyone with access to this page can replace a key but never read it back.</span>
      </div>

      <CredentialsManager initial={secrets} />
    </AdminShell>
  );
}
