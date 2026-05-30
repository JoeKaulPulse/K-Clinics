export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { AssessmentRunner } from '@/components/portal/AssessmentRunner';
import { getQuestionnaire } from '@/lib/questionnaires';
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

  return <AssessmentRunner q={q} />;
}
