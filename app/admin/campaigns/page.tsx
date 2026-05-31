import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { CampaignComposer } from '@/components/admin/CampaignComposer';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const { db } = await import('@/lib/db');
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) redirect('/admin');
  const [audience, past] = await Promise.all([
    db.client.count({ where: { marketingOptIn: true, unsubscribed: false } }),
    db.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  const can = await sessionPermissions();

  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.campaigns')}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Send a branded broadcast to your marketing subscribers.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <CampaignComposer audience={audience} />

        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">History</h2>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            {past.length === 0 && <p className="p-5 text-sm text-[var(--color-stone)]">No campaigns sent yet.</p>}
            {past.map((c) => (
              <div key={c.id} className="border-b border-[var(--color-line)] px-5 py-3.5 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{c.name}</p>
                  <span className="text-xs text-[var(--color-stone)]">{c.sentAt ? `${c.recipients} sent` : 'draft'}</span>
                </div>
                <p className="text-xs text-[var(--color-stone)]">{c.subject}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
