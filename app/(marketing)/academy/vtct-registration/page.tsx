import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { PageTitle } from '@/components/academy/ui';
import { VtctRegistrationForm } from '@/components/academy/VtctRegistrationForm';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'VTCT Registration Details — K Academy', description: 'Submit the personal details and identity documents needed for your registration with the Academy’s awarding body.', path: '/academy/vtct-registration', noindex: true });
export const dynamic = 'force-dynamic';

// BLD-1794: "VTCT Registration Details" — a separate record from the
// student's general account/profile, collecting the personal info + supporting
// documents required for registration with the Academy's awarding body.
export default async function VtctRegistrationPage() {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { getMyRegistration, TITLES, GENDER_OPTIONS, DECLARATION_TEXT } = await import('@/lib/vtct-registration');
  const registration = await getMyRegistration(student.id);

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <PageTitle lede="The personal details and identity documents K Academy needs to register you with the awarding body. This is separate from your general account details above and is reviewed by K Academy staff.">VTCT Registration Details</PageTitle>
      <VtctRegistrationForm
        initial={registration}
        titles={TITLES}
        genderOptions={GENDER_OPTIONS}
        declarationText={DECLARATION_TEXT}
      />
    </AcademyPortalShell>
  );
}
