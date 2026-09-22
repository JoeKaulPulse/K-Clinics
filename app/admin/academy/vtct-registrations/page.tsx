import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { VtctRegistrationReview } from '@/components/admin/VtctRegistrationReview';
import { VtctDeclarationEditor } from '@/components/admin/VtctDeclarationEditor';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-1794: staff review queue for trainees' VTCT Registration Details.
// BLD-1867: the Student Declaration shown on the public VTCT Registration
// page (title, body, checkbox wording) is editable here — owner-only, both
// for hiding the editor and (the real guard) inside the server action itself
// (see app/admin/academy/vtct-registrations/actions.ts), mirroring the
// Learner Agreement pattern in app/admin/academy/agreement/page.tsx.
export default async function AdminVtctRegistrationsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const isOwner = session?.role === 'OWNER';

  const {
    adminListRegistrations, STATUS_LABEL,
    DECLARATION_TITLE, DECLARATION_TEXT, DECLARATION_CHECKBOX_LABEL,
    DECLARATION_TITLE_KEY, DECLARATION_BODY_KEY, DECLARATION_CHECKBOX_KEY,
  } = await import('@/lib/vtct-registration');
  const { getStringSetting } = await import('@/lib/settings');
  const [registrations, declarationTitle, declarationBody, declarationCheckboxLabel] = await Promise.all([
    adminListRegistrations(),
    getStringSetting(DECLARATION_TITLE_KEY, DECLARATION_TITLE),
    getStringSetting(DECLARATION_BODY_KEY, DECLARATION_TEXT),
    getStringSetting(DECLARATION_CHECKBOX_KEY, DECLARATION_CHECKBOX_LABEL),
  ]);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">VTCT Registrations</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Personal details and identity documents trainees have submitted for their registration with the awarding body. Check the details against the uploaded documents, then confirm — a trainee who edits confirmed details is flagged here for re-review rather than silently overwriting what was confirmed.</p>

      {isOwner ? (
        <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">Student Declaration</h2>
          <p className="mb-3 text-sm text-[var(--color-stone)]">The title, body and checkbox wording shown on the public VTCT Registration page, above the trainee's agree-and-submit checkbox. Only the account owner can edit this.</p>
          <VtctDeclarationEditor initialTitle={declarationTitle} initialBody={declarationBody} initialCheckboxLabel={declarationCheckboxLabel} />
        </section>
      ) : (
        <p className="mt-8 text-sm text-[var(--color-stone)]">Editing the Student Declaration text is restricted to the account owner.</p>
      )}

      <div className="mt-8">
        <VtctRegistrationReview registrations={registrations} statusLabels={STATUS_LABEL} />
      </div>
    </AdminShell>
  );
}
