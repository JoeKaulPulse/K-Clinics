import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { questionnaires } from '@/lib/questionnaires';
import { HealthFormManager, type CustomQ } from '@/components/admin/HealthFormManager';

export const dynamic = 'force-dynamic';

// BLD-190 — where health forms are managed. Base questions are versioned in code
// (shown read-only, for clinical integrity); staff add EXTRA questions per form.
export default async function HealthFormsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const can = await sessionPermissions();

  const forms = Object.values(questionnaires).filter((q, i, arr) => arr.findIndex((x) => x.key === q.key) === i);
  const { db } = await import('@/lib/db');
  const customRows = await db.formQuestion.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }).catch(() => []);
  const customByKey = new Map<string, CustomQ[]>();
  for (const r of customRows) {
    const arr = customByKey.get(r.questionnaireKey) ?? [];
    arr.push({ id: r.id, prompt: r.prompt, fieldType: r.fieldType, help: r.help, required: r.required, active: r.active, options: Array.isArray(r.options) ? (r.options as { value: string; label: string }[]) : null });
    customByKey.set(r.questionnaireKey, arr);
  }

  return (
    <AdminShell user={session.email} can={can}>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Health forms</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
          These are the questionnaires clients complete in their portal. The core questions are clinically reviewed and fixed
          (they’re versioned so every saved answer always maps to the exact wording shown). You can add your own extra questions
          to any form below — they appear at the end of the client’s form and on the clinician’s view.
        </p>
      </div>

      <div className="mt-7 space-y-5">
        {forms.map((q) => (
          <section key={q.key} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-xl">{q.title}</h2>
              <span className="text-xs text-[var(--color-stone-soft)]">{q.type} · v{q.version} · {q.questions.length} core questions</span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-stone)]">{q.intro}</p>

            <details className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)]/40 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-[var(--color-stone)]">View core questions (read-only)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--color-ink-soft)]">
                {q.questions.map((qq) => <li key={qq.id}>{qq.prompt}</li>)}
              </ol>
            </details>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">Your extra questions</p>
              <HealthFormManager formKey={q.key} questions={customByKey.get(q.key) ?? []} />
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
