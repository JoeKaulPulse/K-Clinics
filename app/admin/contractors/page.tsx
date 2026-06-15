import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { site } from '@/lib/site';
import { qrSvg } from '@/lib/qr';
import {
  ApproveButton,
  BlockButton,
  UnblockButton,
  ForceCheckOutButton,
  ContractorNote,
} from '@/components/admin/ContractorAdminControls';

export const dynamic = 'force-dynamic';

const STATUS_CLS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-[color-mix(in_oklab,var(--color-jade)_16%,transparent)] text-[var(--color-jade)]',
  BLOCKED: 'bg-[#fbedea] text-[#8a2f2f]',
};
const STATUS_LABEL: Record<string, string> = { PENDING: 'Awaiting approval', APPROVED: 'Approved', BLOCKED: 'Blocked' };

// PRJ-63 — Contractors. Gated on `contractor.tasks.manage`. On-site now, awaiting
// approval, the full list, and a printable reception QR. No client/clinical data.
export default async function ContractorsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');
  if (!sessionCan(session, 'contractor.tasks.manage')) redirect('/admin');

  const can = await sessionPermissions();
  const { db } = await import('@/lib/db');

  const [onSite, contractors] = await Promise.all([
    db.contractorVisit.findMany({
      where: { checkedOutAt: null },
      orderBy: { checkedInAt: 'desc' },
      select: { id: true, checkedInAt: true, contractor: { select: { id: true, name: true, company: true, status: true } } },
    }).catch(() => []),
    db.contractor.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, email: true, phone: true, company: true, tradeType: true, status: true, note: true, createdAt: true },
    }).catch(() => []),
  ]);

  const pending = contractors.filter((c) => c.status === 'PENDING');
  const receptionUrl = `${site.url.replace(/\/$/, '')}/contractor`;
  const qr = await qrSvg(receptionUrl).catch(() => '');

  const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
  const sectionCls = 'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5';

  return (
    <AdminShell user={session.email} can={can}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Contractors</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            Who is on site, who is awaiting approval, and the reception sign-in QR. Contractors see only their jobs and the building plans — never client or clinical data.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* On site now */}
          <section className={sectionCls}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">On site now</h2>
            {onSite.length === 0 ? (
              <p className="text-sm text-[var(--color-stone)]">No contractors signed in right now.</p>
            ) : (
              <ul className="space-y-2">
                {onSite.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{v.contractor.name}{v.contractor.company ? ` · ${v.contractor.company}` : ''}</p>
                      <p className="text-xs text-[var(--color-stone-soft)]">Checked in {dateTimeFmt.format(v.checkedInAt)}</p>
                    </div>
                    <ForceCheckOutButton visitId={v.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Awaiting approval */}
          <section className={sectionCls}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">Awaiting approval</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-[var(--color-stone)]">Nothing waiting. New self-registrations appear here.</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/30 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-[var(--color-stone-soft)]">
                        {[c.company, c.tradeType, c.email, c.phone].filter(Boolean).join(' · ') || 'No details given'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <ApproveButton id={c.id} />
                      <BlockButton id={c.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Full list */}
          <section className={sectionCls}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">All contractors</h2>
            {contractors.length === 0 ? (
              <p className="text-sm text-[var(--color-stone)]">No contractor profiles yet.</p>
            ) : (
              <ul className="space-y-3">
                {contractors.map((c) => (
                  <li key={c.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {c.name}
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${STATUS_CLS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--color-stone-soft)]">
                          {[c.company, c.tradeType, c.email, c.phone].filter(Boolean).join(' · ') || 'No details given'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {c.status === 'PENDING' && <ApproveButton id={c.id} />}
                        {c.status === 'BLOCKED' ? <UnblockButton id={c.id} /> : <BlockButton id={c.id} />}
                      </div>
                    </div>
                    <div className="mt-3">
                      <ContractorNote id={c.id} note={c.note} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Reception QR */}
        <aside>
          <section className={`${sectionCls} lg:sticky lg:top-6`}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-soft)]">Reception QR</h2>
            {qr ? (
              <div className="mx-auto max-w-[220px] [&>svg]:h-auto [&>svg]:w-full [&>svg]:rounded-[var(--radius-md)] [&>svg]:border [&>svg]:border-[var(--color-line)]" dangerouslySetInnerHTML={{ __html: qr }} />
            ) : (
              <p className="text-sm text-[var(--color-stone)]">QR unavailable.</p>
            )}
            <p className="mt-3 break-all text-center text-xs text-[var(--color-stone-soft)]">{receptionUrl}</p>
            <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-bone)]/40 p-3 text-xs text-[var(--color-stone)]">
              <p className="font-medium text-[var(--color-ink)]">Print &amp; place at reception</p>
              <p className="mt-1">Contractors scan this to sign in for their visit. New people register on the spot; you approve them above.</p>
            </div>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
