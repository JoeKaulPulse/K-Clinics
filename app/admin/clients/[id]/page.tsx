import Link from 'next/link';
import { notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, canViewClinical, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { AddNote, SendEmail, StatusSelect } from '@/components/admin/ClientActions';
import { DiscountAction } from '@/components/admin/DiscountActions';

export const dynamic = 'force-dynamic';

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { id } = await params;
  const { getClient } = await import('@/lib/crm-data');
  const session = await getSession();
  const c = await getClient(id);
  if (!c) notFound();

  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');

  // Clinical (health) data — practitioners/admins/owner only. Decrypt the latest
  // version of each assessment type for display.
  const clinical = canViewClinical(session?.role);
  const clinicalAssessments: { title: string; version: number; submittedAt: Date; tampered: boolean; items: { id: string; prompt: string; value: string }[] }[] = [];
  if (clinical && c.assessments.length) {
    const seen = new Set<string>();
    const latest = c.assessments.filter((a) => (seen.has(a.type) ? false : (seen.add(a.type), true)));
    const { formatAssessment } = await import('@/lib/health-assessments');
    for (const a of latest) {
      const f = await formatAssessment(a.id);
      if (f) clinicalAssessments.push(f);
    }
  }

  const can = await sessionPermissions();
  return (
    <AdminShell user={session?.email} can={can}>
      <Link href="/admin/clients" className="text-sm text-[var(--color-gold)] hover:underline">← Clients</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{fullName}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {c.email}{c.phone ? ` · ${c.phone}` : ''}
            {c.dob ? ` · DOB ${new Date(c.dob).toLocaleDateString('en-GB')}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.source && <span className="rounded-full bg-[var(--color-bone)] px-2.5 py-0.5 text-xs text-[var(--color-stone)]">{c.source}</span>}
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${c.marketingOptIn && !c.unsubscribed ? 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>
              {c.unsubscribed ? 'unsubscribed' : c.marketingOptIn ? 'marketing opt-in' : 'no marketing'}
            </span>
          </div>
        </div>
        <SendEmail clientId={c.id} email={c.email} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-10">
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Timeline</h2>
          <div className="mb-4"><AddNote clientId={c.id} /></div>
          <ol className="relative space-y-4 border-l border-[var(--color-line)] pl-5">
            {c.interactions.length === 0 && <li className="text-sm text-[var(--color-stone)]">No activity yet.</li>}
            {c.interactions.map((it) => (
              <li key={it.id} className="relative">
                <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-gold)]" />
                <p className="text-sm font-medium">{it.summary}</p>
                {it.detail && <p className="mt-0.5 text-sm text-[var(--color-stone)]">{it.detail}</p>}
                <p className="mt-0.5 text-xs text-[var(--color-stone-soft)]">
                  {new Date(it.createdAt).toLocaleString('en-GB')} · {it.type.toLowerCase()}{it.author ? ` · ${it.author}` : ''}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Clinical: health assessments (practitioners/admins only) */}
        {clinical && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-xl">Health assessments</h2>
              <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-[var(--color-gold-soft)]">Encrypted · clinical</span>
            </div>
            {clinicalAssessments.length === 0 ? (
              <p className="text-sm text-[var(--color-stone)]">No assessments submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {clinicalAssessments.map((a) => (
                  <div key={a.title} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-[var(--color-stone-soft)]">v{a.version} · {new Date(a.submittedAt).toLocaleDateString('en-GB')}</p>
                    </div>
                    {a.tampered && <p className="mt-1 text-xs font-medium text-[var(--color-blush)]">⚠ Integrity check failed — record may have been altered.</p>}
                    <dl className="mt-3 space-y-2">
                      {a.items.map((it) => (
                        <div key={it.id} className="grid grid-cols-[1fr_1.2fr] gap-3 border-b border-[var(--color-line)] pb-2 last:border-0">
                          <dt className="text-xs text-[var(--color-stone)]">{it.prompt}</dt>
                          <dd className="text-sm">{it.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        </div>

        <aside className="space-y-8">
          {/* Welcome discount */}
          {c.discountClaims.length > 0 && (
            <section>
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Welcome discount</h2>
              <div className="space-y-2">
                {c.discountClaims.map((dc) => (
                  <div key={dc.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm">{dc.status === 'BLOCKED' ? '—' : dc.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${dc.status === 'ACTIVE' ? 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]' : dc.status === 'BLOCKED' ? 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>
                        {dc.percent}% · {dc.status.toLowerCase()}
                      </span>
                    </div>
                    {dc.flagged && <p className="mt-1 text-xs font-medium text-[var(--color-blush)]">⚠ Flagged — matched an existing claim.</p>}
                    <div className="mt-2 flex items-center gap-2">
                      {dc.status === 'ACTIVE' && <DiscountAction claimId={dc.id} action="revoke" label="Revoke" />}
                      {(dc.status === 'BLOCKED' || dc.status === 'REVOKED') && <DiscountAction claimId={dc.id} action="restore" label="Grant anyway" />}
                      {dc.reviewedBy && <span className="text-xs text-[var(--color-stone-soft)]">by {dc.reviewedBy}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Consultations</h2>
            <div className="space-y-2">
              {c.consultations.length === 0 && <p className="text-sm text-[var(--color-stone)]">None.</p>}
              {c.consultations.map((cn) => (
                <div key={cn.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium capitalize">{cn.category}</p>
                    <StatusSelect consultId={cn.id} clientId={c.id} current={cn.status} />
                  </div>
                  {cn.treatments.length > 0 && <p className="mt-1 text-xs text-[var(--color-stone)]">{cn.treatments.join(', ')}</p>}
                  {cn.message && <p className="mt-2 text-sm">{cn.message}</p>}
                  <p className="mt-2 text-xs text-[var(--color-stone-soft)]">{new Date(cn.createdAt).toLocaleDateString('en-GB')}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Emails</h2>
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
              {c.emails.length === 0 && <p className="p-4 text-sm text-[var(--color-stone)]">No emails sent.</p>}
              {c.emails.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-2.5 last:border-0">
                  <div>
                    <p className="text-sm">{e.subject}</p>
                    <p className="text-xs text-[var(--color-stone-soft)]">{e.kind.toLowerCase()} · {new Date(e.createdAt).toLocaleDateString('en-GB')}</p>
                  </div>
                  <span className={`text-xs ${e.status === 'SENT' ? 'text-[var(--color-jade)]' : 'text-[var(--color-blush)]'}`}>{e.status.toLowerCase()}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
