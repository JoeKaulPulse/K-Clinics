import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { MembershipManager, type TierRow } from '@/components/admin/MembershipManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

export default async function MembershipPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'discounts.manage')) redirect('/admin');

  const { getTiers } = await import('@/lib/membership');
  await getTiers(); // seed defaults on first visit
  const { db } = await import('@/lib/db');
  const [tiers, counts] = await Promise.all([
    db.membershipTier.findMany({ orderBy: { minSpendPence: 'asc' } }),
    db.client.groupBy({ by: ['membershipTier'], _count: true }),
  ]);
  const countFor = (key: string) => counts.find((c) => (c.membershipTier ?? 'member') === key)?._count ?? 0;

  const rows: TierRow[] = tiers.map((t) => ({
    id: t.id, key: t.key, name: t.name, minSpendPence: t.minSpendPence, pointsMultiplierBps: t.pointsMultiplierBps,
    birthdayBonusPoints: t.birthdayBonusPoints, earlyAccessHours: t.earlyAccessHours, retailDiscountPct: t.retailDiscountPct,
    perks: t.perks, color: t.color, active: t.active, members: countFor(t.key),
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Membership — K Circle</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Status tiers earned from each client’s rolling 12-month spend. Higher tiers earn loyalty points faster and unlock
        perks — no standing discounts, so margin is protected. Edit thresholds, earn rates and perks below; changes apply
        on the next nightly recompute (or use “Recompute now”).
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((t) => (
          <div key={t.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: t.color || 'var(--color-gold)' }} />
              <p className="font-medium">{t.name}</p>
            </div>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl">{t.members.toLocaleString('en-GB')}</p>
            <p className="text-xs text-[var(--color-stone)]">members · {gbp(t.minSpendPence)}+ · {(t.pointsMultiplierBps / 100)}× pts</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <MembershipManager rows={rows} />
      </div>
    </AdminShell>
  );
}
