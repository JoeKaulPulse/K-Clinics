import { redirect } from 'next/navigation';
import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { MaintenanceScheduler } from '@/components/admin/MaintenanceScheduler';
import { ClinicalEncryptionBackfill } from '@/components/admin/ClinicalEncryptionBackfill';
import { getPlatformStatus, type Light } from '@/lib/platform-status';
import { listMaintenance } from '@/lib/maintenance';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const DOT: Record<Light, string> = {
  green: 'bg-[var(--color-jade)]',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  grey: 'bg-[var(--color-stone-soft)]',
};
const LABEL: Record<Light, string> = { green: 'Healthy', amber: 'Attention', red: 'Problem', grey: 'Not set up' };

export default async function StatusPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  // Owner/Admin only — this is an audit surface.
  if (!session || !['OWNER', 'ADMIN'].includes(session.role)) redirect('/admin');

  const can = await sessionPermissions();
  const locale = await getLocale();
  const [status, windows] = await Promise.all([getPlatformStatus(), listMaintenance()]);

  const counts = status.groups.flatMap((g) => g.items).reduce(
    (a, i) => { a[i.light] += 1; return a; },
    { green: 0, amber: 0, red: 0, grey: 0 } as Record<Light, number>,
  );
  const serviceOptions = status.groups.map((g) => ({ id: g.id, label: g.label }));

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Platform status</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
            A live, compartmentalised audit of every service, tool, database and security control. Owner/Admin only.
            For live probes of each external API (real calls, not config checks) see <Link href="/admin/api-health" className="underline">API health</Link>.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2 text-sm">
          <span className={`h-3 w-3 rounded-full ${DOT[status.overall]}`} />
          <span className="font-medium">{LABEL[status.overall]}</span>
          <span className="text-[var(--color-stone)]">· {status.env} · {status.commit}</span>
        </div>
      </div>

      {/* Summary chips */}
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        {(['red', 'amber', 'green', 'grey'] as Light[]).map((l) => (
          <span key={l} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[l]}`} />{counts[l]} {LABEL[l]}
          </span>
        ))}
      </div>

      {/* Data protection — one-click clinical-encryption backfill + verification.
          The route needs the export-grade clinical permission, so only render
          the card for holders (OWNER always; ADMIN only if granted). */}
      {can.includes('clients.export') && (
        <div className="mt-8">
          <ClinicalEncryptionBackfill />
        </div>
      )}

      {/* Planned maintenance */}
      <div className="mt-8">
        <MaintenanceScheduler windows={windows.map((w) => ({ id: w.id, title: w.title, detail: w.detail, startAt: w.startAt.toISOString(), endAt: w.endAt.toISOString(), services: w.services, impact: w.impact, status: w.status, createdBy: w.createdBy }))} serviceOptions={serviceOptions} />
      </div>

      {/* Compartments */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {status.groups.map((g) => {
          const groupLight = g.items.reduce<Light>((acc, i) => (({ red: 3, amber: 2, grey: 1, green: 0 }[i.light] > { red: 3, amber: 2, grey: 1, green: 0 }[acc]) ? i.light : acc), 'green');
          return (
            <section key={g.id} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${DOT[groupLight]}`} />
                  <h2 className="font-[family-name:var(--font-display)] text-lg">{g.label}</h2>
                </div>
                {g.blurb && <span className="hidden text-xs text-[var(--color-stone)] sm:block">{g.blurb}</span>}
              </div>
              <ul className="divide-y divide-[var(--color-line)]">
                {g.items.map((i) => (
                  <li key={i.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[i.light]}`} title={LABEL[i.light]} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="font-medium">{i.label}</p>
                          <p className="text-sm text-[var(--color-stone)]">{i.detail}</p>
                        </div>
                        {i.info && i.info.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {i.info.map((line, k) => (
                              <li key={k} className="text-xs text-[var(--color-stone)]">{line}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-[var(--color-stone)]">Generated {new Date(status.generatedAt).toLocaleString('en-GB')} · refresh to re-check. No secrets are ever shown — only whether each control is healthy and what it still needs.</p>
    </AdminShell>
  );
}
