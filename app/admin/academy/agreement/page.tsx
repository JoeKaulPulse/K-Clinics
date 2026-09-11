import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { AgreementEditor } from '@/components/admin/AgreementEditor';
import { getLocale } from '@/lib/locale';
import type { AgreementSection } from '@/lib/learner-agreement';

export const dynamic = 'force-dynamic';

const fmtDT = (d: Date | null) => (d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

// BLD-1731 — Learner Agreement admin management. Any academy admin
// (settings.manage) can see the current agreement read-only; only the
// account OWNER sees the editor and the publish control. Both the draft-save
// and the publish action re-check OWNER server-side (see actions.ts), so the
// hidden editor is never the only thing standing between a non-owner and the
// wording learners sign.
export default async function AdminAcademyAgreementPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const isOwner = session?.role === 'OWNER';

  const { getCurrentLearnerAgreement, getDraftLearnerAgreement, listLearnerAgreementVersions } = await import('@/lib/learner-agreement');
  const [current, draft, history] = await Promise.all([
    getCurrentLearnerAgreement(),
    isOwner ? getDraftLearnerAgreement() : Promise.resolve(null),
    isOwner ? listLearnerAgreementVersions(10) : Promise.resolve([]),
  ]);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Agreements &amp; Policies</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">The Learner Agreement every trainee reads and signs at the pre-course gate before their course unlocks. {isOwner ? 'Only the account owner can publish a new version.' : 'Only the account owner can edit or publish this.'}</p>

      <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Current published version</h2>
          <span className="rounded-full bg-[var(--color-bone)] px-2.5 py-1 text-xs text-[var(--color-stone)]">Version {current.version}</span>
        </div>
        <div className="max-h-[50vh] space-y-4 overflow-y-auto text-sm leading-relaxed text-[var(--color-ink-soft)]">
          {current.sections.map((s) => (
            <div key={s.heading}>
              <p className="font-medium text-[var(--color-ink)]">{s.heading}</p>
              <p className="mt-1">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {isOwner ? (
        <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">{draft ? 'Continue draft' : 'Edit agreement'}</h2>
          <AgreementEditor initialSections={draft ? (draft.sections as unknown as AgreementSection[]) : current.sections} isOwner={isOwner} />
        </section>
      ) : (
        <p className="mt-6 text-sm text-[var(--color-stone)]">Editing and publishing a new version is restricted to the account owner.</p>
      )}

      {isOwner && history.length > 0 && (
        <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Version history</h2>
          <ul className="space-y-1.5 text-sm">
            {history.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2">
                <span>{v.version}{v.createdBy ? ` · ${v.createdBy}` : ''}</span>
                <span className="shrink-0 text-xs text-[var(--color-stone)]">{v.status === 'PUBLISHED' ? `Published ${fmtDT(v.publishedAt)}` : 'Draft'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AdminShell>
  );
}
