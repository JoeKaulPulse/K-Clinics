import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PageSearch } from '@/components/admin/PageSearch';
import { EmptyState } from '@/components/admin/EmptyState';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

type SP = { status?: string; source?: string; q?: string };

// Friendly labels for the known signup sources. Anything unrecognised is shown
// title-cased so a new source added later still reads sensibly with no change.
const SOURCE_LABELS: Record<string, string> = {
  footer: 'Website footer',
  'dentistry-waitlist': 'Dentistry waitlist',
};
const sourceLabel = (s: string | null) => {
  if (!s) return 'Unknown';
  return SOURCE_LABELS[s] ?? s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const STATUS_TABS = [
  { k: 'active', label: 'Subscribed' },
  { k: 'unsubscribed', label: 'Unsubscribed' },
  { k: 'all', label: 'All' },
];

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) redirect('/admin');

  const { status = 'active', source = '', q = '' } = await searchParams;
  const query = q.trim().toLowerCase();

  const { db } = await import('@/lib/db');

  // Headline counts (independent of the active filters so the KPIs stay stable).
  const [total, active, unsubscribed, bySource] = await Promise.all([
    db.newsletterSubscriber.count(),
    db.newsletterSubscriber.count({ where: { active: true } }),
    db.newsletterSubscriber.count({ where: { active: false } }),
    db.newsletterSubscriber.groupBy({ by: ['source'], _count: { _all: true }, where: { active: true } }),
  ]);

  // The filtered list itself.
  const where: Record<string, unknown> = {};
  if (status === 'active') where.active = true;
  else if (status === 'unsubscribed') where.active = false;
  if (source) where.source = source;
  if (query) where.email = { contains: query, mode: 'insensitive' };

  const rows = await db.newsletterSubscriber.findMany({
    where,
    orderBy: { consentedAt: 'desc' },
    take: 1000,
    select: { id: true, email: true, source: true, active: true, consentedAt: true, createdAt: true },
  });

  const sources = bySource
    .map((s) => ({ key: s.source ?? '', label: sourceLabel(s.source), count: s._count._all }))
    .sort((a, b) => b.count - a.count);

  const can = await sessionPermissions();
  const locale = await getLocale();

  // Preserve current filters across links; override selectively.
  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { status, source, q: query, ...over };
    if (merged.status && merged.status !== 'active') p.set('status', merged.status);
    if (merged.source) p.set('source', merged.source);
    if (merged.q) p.set('q', merged.q);
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const rowCls =
    'grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--color-line)] px-5 py-3 last:border-0 sm:grid-cols-[1.8fr_1.1fr_0.9fr_0.9fr] sm:items-center';

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Newsletter subscribers</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
            Everyone who has signed up for emails — from the website footer, the dentistry waitlist and any other
            sign-up form. This is your actual email audience: who is on the list, where they came from, and whether
            they are still subscribed.
          </p>
        </div>
        <a
          href={`/api/admin/marketing/subscribers/export${qs({})}`}
          className="h-11 shrink-0 self-start rounded-full border border-[var(--color-line)] px-4 text-sm font-medium leading-[2.75rem] hover:border-[var(--color-gold)]"
        >
          Export CSV
        </a>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total ever signed up" value={String(total)} />
        <Kpi label="Currently subscribed" value={String(active)} sub="reachable audience" />
        <Kpi label="Unsubscribed" value={String(unsubscribed)} />
        <Kpi label="Sign-up sources" value={String(sources.length)} sub="active subscribers" />
      </div>

      {/* Source breakdown — doubles as a filter. */}
      {sources.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-stone)]">
            Where subscribers came from <span className="normal-case">· currently subscribed</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/marketing/subscribers${qs({ source: '' })}`}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${!source ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}
            >
              All sources <span className="opacity-70">· {active}</span>
            </Link>
            {sources.map((s) => (
              <Link
                key={s.key || 'unknown'}
                href={`/admin/marketing/subscribers${qs({ source: s.key })}`}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${source === s.key ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}
              >
                {s.label} <span className="opacity-70">· {s.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Status tabs + search. */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.k}
              href={`/admin/marketing/subscribers${qs({ status: tab.k })}`}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${status === tab.k ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:bg-[var(--color-bone)]'}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <PageSearch defaultValue={query} placeholder="Search by email…" hidden={{ status, source }} widthClass="w-72" />
      </div>

      <div className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        <div className={`${rowCls} bg-[var(--color-bone)] text-xs uppercase tracking-[0.12em] text-[var(--color-stone)]`}>
          <span>Email</span>
          <span className="hidden sm:block">Source</span>
          <span className="hidden sm:block">Status</span>
          <span className="hidden justify-self-end sm:block">Subscribed</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={query || source ? 'No matching subscribers' : 'No subscribers yet'}
            hint={
              query || source
                ? 'Try a different email or clear the filters above.'
                : 'People appear here automatically when they sign up via the website footer or a waitlist form.'
            }
            icon={<><path d="M3 6.5h18v11H3z" /><path d="m3.5 7 8.5 6 8.5-6" /></>}
          />
        ) : (
          rows.map((r) => (
            <div key={r.id} className={rowCls}>
              <p className="truncate font-medium">{r.email}</p>
              <p className="hidden text-sm text-[var(--color-stone)] sm:block">{sourceLabel(r.source)}</p>
              <p className="hidden sm:block">
                {r.active ? (
                  <span className="rounded-full bg-[color-mix(in_oklab,#2e7d52_18%,transparent)] px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--color-ink)]">
                    Subscribed
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--color-bone)] px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">
                    Unsubscribed
                  </span>
                )}
              </p>
              <p className="hidden justify-self-end text-sm tabular-nums text-[var(--color-stone)] sm:block">{fmtDate(r.consentedAt)}</p>
            </div>
          ))
        )}
      </div>
      {rows.length === 1000 && (
        <p className="mt-3 text-xs text-[var(--color-stone)]">Showing the 1,000 most recent. Use Export CSV for the full list.</p>
      )}
    </AdminShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl tabular-nums text-[var(--color-ink)]">{value}</p>
      {sub && <p className="text-xs text-[var(--color-stone)]">{sub}</p>}
    </div>
  );
}
