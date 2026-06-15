import { redirect } from 'next/navigation';
import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { PageSearch } from '@/components/admin/PageSearch';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { DiscountAction } from '@/components/admin/DiscountActions';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  REDEEMED: 'bg-[var(--color-ink)] text-[var(--color-porcelain)]',
  REVOKED: 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]',
  BLOCKED: 'bg-[var(--color-blush)]/30 text-[var(--color-ink)]',
};

export default async function DiscountsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'discounts.manage')) redirect('/admin');
  const { status = 'ALL', q = '' } = await searchParams;

  const { db } = await import('@/lib/db');
  const where: Record<string, unknown> = {};
  if (['ACTIVE', 'REDEEMED', 'REVOKED', 'BLOCKED'].includes(status)) where.status = status;
  if (q) where.OR = [{ code: { contains: q, mode: 'insensitive' } }, { client: { email: { contains: q, mode: 'insensitive' } } }];

  const [claims, counts] = await Promise.all([
    db.discountClaim.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
      include: { client: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    db.discountClaim.groupBy({ by: ['status'], _count: true }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const FILTERS = ['ALL', 'ACTIVE', 'REDEEMED', 'REVOKED', 'BLOCKED'];

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{L('Discount codes', 'Промокоди')}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {L('Track every welcome-offer claim, check validity and override when needed.', 'Відстежуйте всі вітальні знижки, перевіряйте дійсність і керуйте ними.')}
      </p>

      {/* Stat row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: L('Active', 'Активні'), value: countOf('ACTIVE'), tone: 'text-green-700' },
          { label: L('Redeemed', 'Використані'), value: countOf('REDEEMED'), tone: '' },
          { label: L('Revoked', 'Скасовані'), value: countOf('REVOKED'), tone: 'text-[var(--color-stone)]' },
          { label: L('Blocked', 'Заблоковані'), value: countOf('BLOCKED'), tone: 'text-[var(--color-blush)]' },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <div className={`font-[family-name:var(--font-display)] text-2xl ${s.tone}`}>{s.value}</div>
            <div className="mt-1 text-xs text-[var(--color-stone)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-[var(--color-line)] p-0.5 text-sm">
          {FILTERS.map((f) => (
            <Link key={f} href={`/admin/discounts?status=${f}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={`rounded-full px-3 py-1 ${status === f ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)]'}`}>
              {f === 'ALL' ? L('All', 'Усі') : f[0] + f.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
        <PageSearch
          defaultValue={q}
          placeholder={L('Code or email…', 'Код або email…')}
          hidden={{ status: status !== 'ALL' ? status : undefined }}
          showSubmit={false}
          widthClass="w-56"
        />
      </div>

      {/* Table */}
      <div className="mt-5 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
            <tr>
              {[L('Code', 'Код'), L('Client', 'Клієнт'), L('Status', 'Статус'), L('Value', 'Знижка'), L('Created', 'Створено'), ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-[var(--color-stone)]">{L('No discount codes match.', 'Немає кодів за фільтром.')}</td></tr>}
            {claims.map((c) => {
              const name = [c.client.firstName, c.client.lastName].filter(Boolean).join(' ') || c.client.email;
              return (
                <tr key={c.id} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]">
                  <td className="px-4 py-3 font-mono text-xs">{c.status === 'BLOCKED' ? '—' : c.code}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${c.client.id}`} className="font-medium hover:text-[var(--color-gold)]">{name}</Link>
                    <div className="text-xs text-[var(--color-stone-soft)]">{c.client.email}</div>
                    {c.flagged && <span className="mt-1 inline-block rounded-full bg-[var(--color-blush)]/25 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-[var(--color-ink)]">⚠ {L('flagged', 'позначено')}</span>}
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${STATUS_STYLE[c.status]}`}>{c.status.toLowerCase()}</span></td>
                  <td className="px-4 py-3">{c.percent}%</td>
                  <td className="px-4 py-3 text-[var(--color-stone)]">{c.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-right">
                    {c.status === 'ACTIVE' && <DiscountAction claimId={c.id} action="revoke" label={L('Revoke', 'Скасувати')} />}
                    {(c.status === 'BLOCKED' || c.status === 'REVOKED') && <DiscountAction claimId={c.id} action="restore" label={L('Grant', 'Надати')} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
