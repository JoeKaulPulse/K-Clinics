export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { crmEnabled } from '@/lib/crm';
import { formatPrice } from '@/lib/treatments';

export default async function InvoicesPage() {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getDashboard } = await import('@/lib/portal-data');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const { invoices } = await getDashboard(client.id);

  return (
    <PortalShell firstName={client.firstName} locale={client.locale === 'uk' ? 'uk' : 'en'}>
      <div className="mb-8">
        <p className="eyebrow mb-2">Payments</p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">Payments & invoices</h1>
      </div>

      {invoices.length ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">
              <tr>
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Treatment</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {invoices.map((inv) => (
                <tr key={inv.id} className="bg-[var(--color-porcelain)]">
                  <td className="px-5 py-3 font-mono text-xs">{inv.reference}</td>
                  <td className="px-5 py-3">{inv.title}</td>
                  <td className="px-5 py-3 text-[var(--color-stone)]">{inv.paidAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-5 py-3 text-[var(--color-stone)]">{inv.reason}</td>
                  <td className="px-5 py-3 text-right font-medium">{formatPrice(inv.amountPence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[var(--color-stone)]">No payments on record yet. Charges appear here after a treatment or a late-cancellation fee.</p>
      )}
      <p className="mt-4 text-xs text-[var(--color-stone)]">Need a formal VAT invoice? Contact reception and we’ll email one over.</p>
    </PortalShell>
  );
}
