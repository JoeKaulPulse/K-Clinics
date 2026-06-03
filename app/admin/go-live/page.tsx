import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { goLiveChecklist, type GoLiveStatus } from '@/lib/go-live';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const BADGE: Record<GoLiveStatus, { label: string; cls: string }> = {
  ready: { label: 'Ready ✓', cls: 'bg-green-100 text-green-800' },
  action: { label: 'Action needed', cls: 'bg-amber-100 text-amber-800' },
  optional: { label: 'Optional', cls: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
};

export default async function GoLivePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { groups, ready, action, total } = await goLiveChecklist();
  const can = await sessionPermissions();
  const locale = await getLocale();

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Go live</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Your simple, plain-English launch checklist. Work top to bottom — anything marked <strong>Action needed</strong> should
        be done before you open to the public. <strong>Optional</strong> items can wait.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bone)]">
            <div className="h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${Math.round((ready / total) * 100)}%` }} />
          </div>
        </div>
        <p className="text-sm text-[var(--color-stone)]"><strong className="text-[var(--color-ink)]">{ready}/{total}</strong> ready{action > 0 ? ` · ${action} need you` : ' 🎉'}</p>
      </div>

      <div className="mt-8 space-y-8">
        {groups.map((g) => (
          <section key={g.heading}>
            <h2 className="font-[family-name:var(--font-display)] text-xl">{g.heading}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-stone)]">{g.intro}</p>
            <div className="mt-3 space-y-3">
              {g.items.map((it, i) => (
                <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{it.title}</h3>
                      <p className="mt-0.5 text-sm text-[var(--color-stone)]">{it.what}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${BADGE[it.status].cls}`}>{BADGE[it.status].label}</span>
                  </div>
                  {it.how && it.status !== 'ready' && (
                    <ol className="mt-3 ml-4 list-decimal space-y-1 text-sm text-[var(--color-stone)]">
                      {it.how.map((h, j) => <li key={j}>{h}</li>)}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5 text-sm text-[var(--color-stone)]">
        Stuck on anything technical (the keys/secrets)? Send those to your developer — they’re one-time settings. Everything
        else (services, prices, consent wording, products, content) you control right here in the dashboard.
      </p>
    </AdminShell>
  );
}
