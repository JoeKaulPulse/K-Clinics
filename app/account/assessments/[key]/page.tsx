export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { AssessmentRunner } from '@/components/portal/AssessmentRunner';
import { TermsGate } from '@/components/portal/TermsGate';
import { getEffectiveQuestionnaire } from '@/lib/questionnaire-versions';
import { localizeQuestionnaire } from '@/lib/questionnaires-uk';
import { crmEnabled } from '@/lib/crm';

export default async function AssessmentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  // Serve the latest published version (admin edits via /admin/health-forms, BLD-209).
  const q = await getEffectiveQuestionnaire(key);
  if (!q) notFound();
  if (!crmEnabled) redirect('/account');

  // Auth is enforced by middleware; ensure a client exists for a clean session.
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');

  // Append any admin-managed extra questions (BLD-190) before localising.
  const { withCustomQuestions } = await import('@/lib/health-forms');
  const merged = await withCustomQuestions(q);

  // Show the form in the client's language; stored answer values stay canonical.
  const locale = client.locale === 'uk' ? 'uk' : 'en';
  // BLD-1845 (review fix): this is the one authenticated /account page that does
  // NOT render inside PortalShell, so the mandatory T&Cs gate mounted there did
  // not cover it — a client with no recorded acceptance could still open an
  // assessment directly (bookmark, emailed link) and submit health data. Mount
  // the same gate here so the portal is covered end to end.
  return (
    <>
      <AssessmentRunner q={localizeQuestionnaire(merged, locale)} locale={locale} />
      <TermsGate accepted={!!client.termsAcceptedAt} />
    </>
  );
}
