import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { AwardPoints } from '@/components/admin/AwardPoints';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const RANGES = [30, 90, 365, 0];
const MEDAL = ['🥇', '🥈', '🥉'];

export default async function RewardsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'rewards.view')) redirect('/admin');
  const { range } = await searchParams;
  const days = RANGES.includes(Number(range)) ? Number(range) : 90;
  const canManage = sessionCan(session, 'rewards.manage');

  const { leaderboard } = await import('@/lib/gamification');
  const rows = await leaderboard(days || undefined);

  let staff: { id: string; name: string }[] = [];
  if (canManage) {
    const { db } = await import('@/lib/db');
    const s = await db.adminUser.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } });
    staff = s.map((x) => ({ id: x.id, name: x.name || x.email }));
  }

  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const top = rows[0]?.total || 1;

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{L('Team rewards', 'Винагороди команди')}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">{L('Points earned from client reviews, efficiency and low waste — plus manager awards.', 'Бали за відгуки клієнтів, ефективність і мінімум витрат — а також від керівників.')}</p>
        </div>
        <div className="flex gap-1 rounded-full border border-[var(--color-line)] p-0.5 text-sm">
          {[30, 90, 365, 0].map((r) => (
            <Link key={r} href={`/admin/rewards?range=${r}`} className={`rounded-full px-3 py-1 ${days === r ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)]'}`}>
              {r === 0 ? L('All time', 'Увесь час') : `${r}d`}
            </Link>
          ))}
        </div>
      </div>

      {canManage && <div className="mt-6"><AwardPoints staff={staff} /></div>}

      <div className="mt-8 space-y-3">
        {rows.length === 0 && <p className="text-sm text-[var(--color-stone)]">{L('No points awarded in this period yet.', 'У цей період бали ще не нараховані.')}</p>}
        {rows.map((r, i) => (
          <div key={r.staffId} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 shadow-[var(--shadow-soft)]">
            <span className="w-8 shrink-0 text-center text-2xl">{MEDAL[i] || <span className="text-base text-[var(--color-stone-soft)]">{i + 1}</span>}</span>
            <span className="h-9 w-9 shrink-0 rounded-full" style={{ background: r.color || 'var(--color-gold)' }} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.name}{r.title ? <span className="ml-2 text-xs text-[var(--color-stone-soft)]">{r.title}</span> : ''}</p>
              <div className="mt-1.5 h-1.5 max-w-md overflow-hidden rounded-full bg-[var(--color-bone)]">
                <div className="h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${Math.max(4, Math.round((r.total / top) * 100))}%` }} />
              </div>
              <p className="mt-1 text-xs text-[var(--color-stone)]">
                {r.avgRating ? `${r.avgRating.toFixed(1)}★ · ${r.reviewCount} ${L('reviews', 'відгуків')}` : L('No reviews yet', 'Поки без відгуків')}
                {r.reviewPoints ? ` · ${r.reviewPoints} ${L('review pts', 'балів за відгуки')}` : ''}
              </p>
            </div>
            <div className="text-right">
              <div className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-gold)]">{r.total}</div>
              <div className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--color-stone)]">{L('points', 'балів')}</div>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
