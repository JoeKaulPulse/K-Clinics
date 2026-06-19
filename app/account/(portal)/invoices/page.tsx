export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { crmEnabled } from '@/lib/crm';
import { formatPrice } from '@/lib/treatments';
import { pt } from '@/lib/i18n-portal';
import type { Locale } from '@/lib/i18n';

export default async function InvoicesPage() {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getDashboard } = await import('@/lib/portal-data');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const { invoices } = await getDashboard(client.id);

  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';
  const t = (k: string) => pt(locale, k);
  const lc = locale === 'uk' ? 'uk-UA' : 'en-GB';
  const total = invoices.reduce((s, inv) => s + inv.amountPence, 0);

  return (
    <>
      <PortalPageHeader
        eyebrow={t('inv.eyebrow')}
        title={t('inv.title')}
        action={invoices.length > 0 ? (
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{t('inv.total')}</p>
            <p className="font-[family-name:var(--font-display)] text-2xl">{formatPrice(total)}</p>
          </div>
        ) : undefined}
      />

      {invoices.length ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-soft)]">
          <ul className="divide-y divide-[var(--color-line)]">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-bone)]/40">
                <div className="flex items-center gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-jade)]/12 text-[var(--color-jade)]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <div>
                    <p className="font-medium">{inv.title}</p>
                    <p className="text-sm text-[var(--color-stone)]">
                      {inv.lateCancel ? t('inv.reasonLateFee') : t('inv.reasonTreatment')} · {inv.paidAt.toLocaleDateString(lc, { day: 'numeric', month: 'long', year: 'numeric' })} · {t('inv.ref')} {inv.reference}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 font-[family-name:var(--font-display)] text-lg">{formatPrice(inv.amountPence)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[var(--color-stone)]">{t('inv.none')}</p>
      )}
    </>
  );
}
