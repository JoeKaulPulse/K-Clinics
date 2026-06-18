import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { EmailCampaignRows, type DraftRow } from '@/components/admin/EmailCampaignRows';
import { RepermissionCard } from '@/components/admin/RepermissionCard';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default async function EmailDashboard() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const { marketableClientWhere } = await import('@/lib/consent');
  const since = new Date(Date.now() - 30 * 86400000);
  const [sent30, opened30, clicked30, bounced30, optedIn, campaigns] = await Promise.all([
    db.emailEvent.count({ where: { kind: 'CAMPAIGN', status: 'SENT', createdAt: { gte: since } } }),
    db.emailEvent.count({ where: { kind: 'CAMPAIGN', openedAt: { not: null }, createdAt: { gte: since } } }),
    db.emailEvent.count({ where: { kind: 'CAMPAIGN', clickedAt: { not: null }, createdAt: { gte: since } } }),
    db.emailEvent.count({ where: { kind: 'CAMPAIGN', bouncedAt: { not: null }, createdAt: { gte: since } } }),
    // Reachable audience = lawful marketing recipients only (BLD-242).
    db.client.count({ where: marketableClientWhere() }),
    db.campaign.findMany({ where: { status: 'SENT' }, orderBy: { sentAt: 'desc' }, take: 12 }),
  ]);

  // Drafts, scheduled sends and running A/B tests, newest first.
  const pending = await db.campaign.findMany({
    where: { status: { in: ['DRAFT', 'SCHEDULED', 'AB_TESTING'] } },
    orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { updatedAt: 'desc' }],
    take: 30,
  });
  const segNames = new Map((await db.segment.findMany({ select: { id: true, name: true } })).map((s) => [s.id, s.name]));
  const audienceLabel = (t: string | null, v: string | null) =>
    t === 'segment' ? (segNames.get(v || '') || 'Segment') : t === 'tag' ? `Tag: ${v}` : 'All subscribers';
  const pendingRows: DraftRow[] = pending.map((c) => ({
    id: c.id, name: c.name, subject: c.subject, status: c.status,
    scheduledAt: (c.status === 'AB_TESTING' ? c.abDecideAt : c.scheduledAt)?.toISOString() ?? null,
    audience: audienceLabel(c.audienceType, c.audienceValue),
  }));
  const canSend = sessionCan(session, 'campaigns.send');

  const ids = campaigns.map((c) => c.id);
  const events = ids.length ? await db.emailEvent.findMany({ where: { campaignId: { in: ids } }, select: { campaignId: true, status: true, openedAt: true, clickedAt: true } }) : [];
  const stat = new Map<string, { sent: number; opened: number; clicked: number }>();
  for (const e of events) {
    if (!e.campaignId) continue;
    const s = stat.get(e.campaignId) ?? { sent: 0, opened: 0, clicked: 0 };
    if (e.status === 'SENT') s.sent++;
    if (e.openedAt) s.opened++;
    if (e.clickedAt) s.clicked++;
    stat.set(e.campaignId, s);
  }

  // Top clicked links (across recent campaigns).
  const topLinks = await db.emailLinkClick.groupBy({
    by: ['url'], _sum: { clicks: true }, orderBy: { _sum: { clicks: 'desc' } }, take: 8,
  });

  // Performance by audience — campaigns sent in the last 90 days, grouped by the
  // audience they targeted.
  const since90 = new Date(Date.now() - 90 * 86400000);
  const sentCampaigns = await db.campaign.findMany({
    where: { status: 'SENT', sentAt: { gte: since90 } },
    select: { id: true, recipients: true, audienceType: true, audienceValue: true },
  });
  const byAud = new Map<string, { label: string; recipients: number; opened: number; clicked: number }>();
  if (sentCampaigns.length) {
    const evs = await db.emailEvent.findMany({ where: { campaignId: { in: sentCampaigns.map((c) => c.id) } }, select: { campaignId: true, openedAt: true, clickedAt: true } });
    const evByCampaign = new Map<string, { opened: number; clicked: number }>();
    for (const e of evs) {
      if (!e.campaignId) continue;
      const s = evByCampaign.get(e.campaignId) ?? { opened: 0, clicked: 0 };
      if (e.openedAt) s.opened++; if (e.clickedAt) s.clicked++;
      evByCampaign.set(e.campaignId, s);
    }
    for (const c of sentCampaigns) {
      const label = audienceLabel(c.audienceType, c.audienceValue);
      const cur = byAud.get(label) ?? { label, recipients: 0, opened: 0, clicked: 0 };
      const ev = evByCampaign.get(c.id) ?? { opened: 0, clicked: 0 };
      cur.recipients += c.recipients; cur.opened += ev.opened; cur.clicked += ev.clicked;
      byAud.set(label, cur);
    }
  }
  const audienceRows = [...byAud.values()].sort((a, b) => b.recipients - a.recipients);

  // BLD-242 — legacy opt-ins awaiting double opt-in re-permission.
  const reperm = canSend ? await (await import('@/lib/re-permission')).repermissionStats() : { pending: 0, total: 0 };

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Email marketing</h1>
        <div className="flex gap-2">
          <Link href="/admin/marketing/templates" className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)]">Templates</Link>
          <Link href="/admin/marketing/audiences" className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)]">Audiences</Link>
          {sessionCan(session, 'campaigns.send') && <Link href="/admin/marketing/email/new" className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">New email</Link>}
        </div>
      </div>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Send beautiful, on-brand emails through Resend and track opens, clicks &amp; bounces. Last 30 days.</p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Sent" value={String(sent30)} />
        <Kpi label="Open rate" value={`${pct(opened30, sent30)}%`} sub={`${opened30} opened`} />
        <Kpi label="Click rate" value={`${pct(clicked30, sent30)}%`} sub={`${clicked30} clicked`} />
        <Kpi label="Bounce rate" value={`${pct(bounced30, sent30)}%`} sub={`${bounced30} bounced`} />
        <Kpi label="Subscribers" value={String(optedIn)} sub="opted-in" />
      </div>

      {canSend && reperm.total > 0 && (
        <section className="mt-8">
          <RepermissionCard initialPending={reperm.pending} initialTotal={reperm.total} />
        </section>
      )}

      {canSend && pendingRows.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-stone)]">Drafts &amp; scheduled</h2>
          <EmailCampaignRows rows={pendingRows} />
        </section>
      )}

      <section className="mt-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
        <table className="w-full text-sm">
          <thead><tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th className="p-3">Campaign</th><th className="p-3">Date</th><th className="p-3">Sent</th><th className="p-3">Opens</th><th className="p-3">Clicks</th><th className="p-3"></th></tr></thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-sm text-[var(--color-stone)]">No emails sent yet. <Link href="/admin/marketing/email/new" className="text-[var(--color-gold)] underline">Send your first →</Link></td></tr>
            ) : campaigns.map((c) => {
              const s = stat.get(c.id) ?? { sent: 0, opened: 0, clicked: 0 };
              return (
                <tr key={c.id} className="border-t border-[var(--color-line)]">
                  <td className="p-3 font-medium">{c.name}<span className="block text-xs text-[var(--color-stone)]">{c.subject}</span></td>
                  <td className="p-3 text-xs text-[var(--color-stone)]">{new Date(c.sentAt ?? c.createdAt).toLocaleDateString('en-GB')}</td>
                  <td className="p-3 tabular-nums">{s.sent}</td>
                  <td className="p-3 tabular-nums">{s.sent ? `${pct(s.opened, s.sent)}%` : '—'}</td>
                  <td className="p-3 tabular-nums">{s.sent ? `${pct(s.clicked, s.sent)}%` : '—'}</td>
                  <td className="p-3 text-right">{canSend && <Link href={`/admin/marketing/email/new?clone=${c.id}`} className="text-xs text-[var(--color-gold)] hover:underline">Duplicate</Link>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Performance by audience */}
        {audienceRows.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-stone)]">Performance by audience <span className="normal-case text-[var(--color-stone)]">· 90 days</span></h2>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              <table className="w-full text-sm">
                <thead><tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th className="p-3">Audience</th><th className="p-3">Sent</th><th className="p-3">Opens</th><th className="p-3">Clicks</th></tr></thead>
                <tbody>
                  {audienceRows.map((a) => (
                    <tr key={a.label} className="border-t border-[var(--color-line)]">
                      <td className="p-3">{a.label}</td>
                      <td className="p-3 tabular-nums">{a.recipients}</td>
                      <td className="p-3 tabular-nums">{a.recipients ? `${pct(a.opened, a.recipients)}%` : '—'}</td>
                      <td className="p-3 tabular-nums">{a.recipients ? `${pct(a.clicked, a.recipients)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Top clicked links */}
        {topLinks.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-stone)]">Top clicked links</h2>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              <table className="w-full text-sm">
                <tbody>
                  {topLinks.map((l) => (
                    <tr key={l.url} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="max-w-0 truncate p-3"><a href={l.url} target="_blank" rel="noreferrer" className="text-[var(--color-gold)] hover:underline">{l.url}</a></td>
                      <td className="whitespace-nowrap p-3 text-right font-medium tabular-nums">{l._sum.clicks ?? 0} clicks</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <p className="mt-4 text-xs text-[var(--color-stone)]">Opens &amp; clicks require the Resend webhook + tracking to be enabled (point it at <code>/api/webhooks/resend</code>).</p>
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
