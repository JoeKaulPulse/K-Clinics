import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ProfileEditor } from '@/components/admin/ProfileEditor';
import { ROLES } from '@/lib/permissions';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { db } = await import('@/lib/db');
  const me = await db.adminUser.findUnique({
    where: { id: session.sub },
    select: { name: true, title: true, email: true, role: true, isClinician: true, lastLoginAt: true },
  });
  if (!me) redirect('/admin/login');

  const roleLabel = ROLES.find((r) => r.value === me.role)?.label || me.role;
  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';

  // Personal performance (gamification) — shown when the member has any points.
  const { staffStanding } = await import('@/lib/gamification');
  const standing = await staffStanding(session.sub);
  const showPerf = standing.total !== 0 || standing.recent.length > 0 || me.isClinician;
  const CAT_LABEL: Record<string, string> = {
    REVIEW: uk ? 'Відгуки' : 'Reviews', EFFICIENCY: uk ? 'Ефективність' : 'Efficiency',
    CONSUMABLES: uk ? 'Витратні' : 'Consumables', PUNCTUALITY: uk ? 'Пунктуальність' : 'Punctuality',
    PERFORMANCE: uk ? 'Результати' : 'Performance', FRIENDLINESS: uk ? 'Привітність' : 'Friendliness',
    TEAMWORK: uk ? 'Команда' : 'Teamwork', MANUAL: uk ? 'Коригування' : 'Adjustment', REDEMPTION: uk ? 'Витрачено' : 'Redeemed',
  };

  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{uk ? 'Мій профіль' : 'My profile'}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {me.email} · {roleLabel}{me.isClinician ? (uk ? ' · клініцист' : ' · clinician') : ''}
        {me.lastLoginAt ? ` · ${uk ? 'останній вхід' : 'last login'} ${new Date(me.lastLoginAt).toLocaleString('en-GB')}` : ''}
      </p>
      <div className="mt-8 max-w-xl">
        <ProfileEditor name={me.name} title={me.title} uk={uk} />
      </div>

      {showPerf && (
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-6 bg-[var(--color-gold)]" />
            <h2 className="eyebrow">{uk ? 'Моя ефективність' : 'My performance'}</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: uk ? 'Бали' : 'Points', value: standing.total, tone: 'text-[var(--color-gold)]' },
              { label: uk ? 'Місце' : 'Rank', value: standing.rank ? `#${standing.rank}` : '—', sub: standing.rank ? `/ ${standing.totalStaff}` : '' },
              { label: uk ? 'Сер. оцінка' : 'Avg rating', value: standing.avgRating ? `${standing.avgRating.toFixed(1)}★` : '—' },
              { label: uk ? 'Відгуки' : 'Reviews', value: standing.reviewCount },
            ].map((s) => (
              <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                <div className={`font-[family-name:var(--font-display)] text-2xl ${s.tone || ''}`}>{s.value} {s.sub && <span className="text-sm text-[var(--color-stone-soft)]">{s.sub}</span>}</div>
                <div className="mt-1 text-xs text-[var(--color-stone)]">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {standing.byCategory.length > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
                <h3 className="mb-3 text-sm font-medium">{uk ? 'Розбивка балів' : 'Points breakdown'}</h3>
                <ul className="space-y-2">
                  {standing.byCategory.map((c) => (
                    <li key={c.category} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-stone)]">{CAT_LABEL[c.category] || c.category}</span>
                      <span className={`font-medium ${c.points < 0 ? 'text-[var(--color-blush)]' : ''}`}>{c.points > 0 ? '+' : ''}{c.points}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {standing.recent.length > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
                <h3 className="mb-3 text-sm font-medium">{uk ? 'Останні нарахування' : 'Recent activity'}</h3>
                <ul className="divide-y divide-[var(--color-line)]">
                  {standing.recent.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{r.reason}</span>
                        <span className="text-xs text-[var(--color-stone-soft)]">{new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {CAT_LABEL[r.category] || r.category}</span>
                      </span>
                      <span className={`shrink-0 font-medium ${r.points < 0 ? 'text-[var(--color-blush)]' : 'text-[var(--color-jade)]'}`}>{r.points > 0 ? '+' : ''}{r.points}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
