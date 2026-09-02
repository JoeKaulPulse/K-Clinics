import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { getLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { CrmDisabled } from '@/components/admin/CrmDisabled';

export const dynamic = 'force-dynamic';

const STATUSES = ['ALL', 'NEW', 'CONTACTED', 'BOOKED', 'COMPLETED', 'CLOSED'];
// BLD-1603: not a real ConsultStatus — a UI-only tab backed by AiAnalysis rows
// the model flagged for expert review (see lib/ai-consultation.ts). Kept out of
// STATUSES so it never reaches listConsultations()'s status filter.
const FLAGGED = 'FLAGGED';

export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { status = 'ALL' } = await searchParams;
  const session = await getSession();
  if (!sessionCan(session, 'consultations.view')) redirect('/admin');

  // AI-flagged cases carry clinical detail (client identity + findings from the
  // "Get My Plan" AI analysis), same as the AI section on the client page — so
  // the tab and its data are gated the same way (clients.clinical.view).
  const clinical = sessionCan(session, 'clients.clinical.view');
  const showFlagged = status === FLAGGED && clinical;

  const { listConsultations, listFlaggedAnalyses, countFlaggedAnalyses } = await import('@/lib/crm-data');
  // Guard: FLAGGED is a UI-only tab, not a ConsultStatus — never let it reach
  // listConsultations()'s Prisma filter (also covers a non-clinical user hitting
  // ?status=FLAGGED directly, who falls back to the ALL view).
  const consultStatus = status === FLAGGED ? 'ALL' : status;
  const [rows, flaggedRows, flaggedCount] = await Promise.all([
    showFlagged ? Promise.resolve([]) : listConsultations(consultStatus),
    showFlagged ? listFlaggedAnalyses() : Promise.resolve([]),
    clinical ? countFlaggedAnalyses() : Promise.resolve(0),
  ]);

  const can = await sessionPermissions();

  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t(locale, 'nav.consultations')}</h1>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/consultations?status=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ${status === s ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
        {clinical && (
          <Link
            href={`/admin/consultations?status=${FLAGGED}`}
            className={`ml-1 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ${status === FLAGGED ? 'bg-[var(--color-blush)] text-[var(--color-ink)]' : 'border border-[var(--color-blush)] text-[var(--color-ink)] hover:bg-[var(--color-blush)]/15'}`}
          >
            Flagged for expert review
            {flaggedCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold ${status === FLAGGED ? 'bg-[var(--color-porcelain)]/70 text-[var(--color-ink)]' : 'bg-[var(--color-blush)] text-[var(--color-ink)]'}`}>
                {flaggedCount}
              </span>
            )}
          </Link>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {showFlagged ? (
          <>
            {flaggedRows.length === 0 && (
              <p className="p-6 text-sm text-[var(--color-stone)]">No AI analyses are currently flagged for expert review.</p>
            )}
            {flaggedRows.map((a) => (
              <Link
                key={a.id}
                href={`/admin/clients/${a.client.id}`}
                className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--color-line)] px-5 py-4 last:border-0 transition-colors duration-150 hover:bg-[var(--color-bone)] active:bg-[var(--color-sand)] sm:grid-cols-[1.2fr_1.4fr_0.8fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-medium">{a.client.firstName} {a.client.lastName ?? ''}</p>
                  <p className="text-xs text-[var(--color-stone)]">{a.client.email}</p>
                </div>
                <p className="hidden text-sm text-[var(--color-stone)] sm:block">{a.summary || a.areas.join(', ') || 'AI consultation'}</p>
                <p className="hidden text-xs text-[var(--color-stone)] sm:block">{new Date(a.createdAt).toLocaleDateString('en-GB')}</p>
                <span className="justify-self-end rounded-full bg-[var(--color-blush)]/20 px-3 py-1 text-xs">Needs expert review</span>
              </Link>
            ))}
          </>
        ) : (
          <>
            {rows.length === 0 && <p className="p-6 text-sm text-[var(--color-stone)]">No consultations in this view.</p>}
            {rows.map((c) => (
              <Link key={c.id} href={`/admin/consultations/${c.id}`} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--color-line)] px-5 py-4 last:border-0 transition-colors duration-150 hover:bg-[var(--color-bone)] active:bg-[var(--color-sand)] sm:grid-cols-[1.2fr_1.4fr_0.8fr_auto] sm:items-center">
                <div>
                  <p className="font-medium">{c.client.firstName} {c.client.lastName ?? ''}</p>
                  <p className="text-xs text-[var(--color-stone)]">{c.client.email}</p>
                </div>
                <p className="hidden text-sm text-[var(--color-stone)] sm:block">{c.treatments.join(', ') || c.category}</p>
                <p className="hidden text-xs text-[var(--color-stone)] sm:block">{new Date(c.createdAt).toLocaleDateString('en-GB')}</p>
                <span className="justify-self-end rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">{c.status}</span>
              </Link>
            ))}
          </>
        )}
      </div>
    </AdminShell>
  );
}
