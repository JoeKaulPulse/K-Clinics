export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { AssessmentRunner } from '@/components/portal/AssessmentRunner';
import { getQuestionnaire } from '@/lib/questionnaires';
import { localizeQuestionnaire } from '@/lib/questionnaires-uk';
import { crmEnabled } from '@/lib/crm';

export default async function AssessmentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const q = getQuestionnaire(key);
  if (!q) notFound();
  if (!crmEnabled) redirect('/account');

  // Auth is enforced by middleware; ensure a client exists for a clean session.
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');

  // If signed forms are hidden from clients and this one is already submitted,
  // don't expose the signed copy (it's held in the CRM / provided on SAR).
  const { getSetting } = await import('@/lib/settings');
  if (await getSetting('hide_signed_forms')) {
    const { assessmentStatus } = await import('@/lib/health-assessments');
    const statuses = await assessmentStatus(client.id);
    if (statuses.get(q.type)) redirect('/account/assessments');
  }

  // Show the form in the client's language; stored answer values stay canonical.
  const locale = client.locale === 'uk' ? 'uk' : 'en';
  return <AssessmentRunner q={localizeQuestionnaire(q, locale)} locale={locale} />;
}
