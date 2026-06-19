export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { PageTransition } from '@/components/motion/PageTransition';
import { crmEnabled } from '@/lib/crm';
import type { Locale } from '@/lib/i18n';

/**
 * Persistent shell for the authenticated portal. Living in a layout (not in each
 * page) keeps PortalShell mounted across navigations, so the nav's active pill
 * glides between pages (motion layoutId) and the page body cross-fades — the
 * portal's signature transition. The auth gate is centralised here; pages keep a
 * defensive getCurrentClient()/redirect for their own data.
 *
 * When the CRM/DB isn't available (static preview), render children bare so the
 * overview's own "not enabled" screen still shows and the other pages can
 * redirect to it.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  if (!crmEnabled) return <>{children}</>;

  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';

  return (
    <PortalShell firstName={client.firstName} locale={locale}>
      <PageTransition>{children}</PageTransition>
    </PortalShell>
  );
}
