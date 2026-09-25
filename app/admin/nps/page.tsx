import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { npsSummary } from '@/lib/nps';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

export default async function AdminNpsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'reviews.manage')) redirect('/admin');
  const can = await sessionPermissions();
  const locale = await getLocale();
  const s = await npsSummary();

  const Stat = ({ label, value, tone = '' }: { label: string; value: string; tone?: string }) => (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <p className={`font-[family-name:var(--font-display)] text-3xl tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-[var(--color-stone)]">{label}</p>
    </div>
  );

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">NPS</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Net Promoter Score from post-visit surveys (last 12 months). Enable sending in Settings → “NPS satisfaction survey”.</p>

      {s.responses === 0 ? (
        <p className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-sm text-[var(--color-stone)]">No responses yet. Once the survey is enabled, scores will appear here after completed visits.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <Stat label="NPS score" value={s.nps != null ? String(s.nps) : '—'} tone={s.nps != null && s.nps >= 50 ? 'text-[var(--color-jade)]' : s.nps != null && s.nps < 0 ? 'text-[var(--color-blush-deep)]' : ''} />
            <Stat label="Avg (0–10)" value={s.avg != null ? s.avg.toFixed(1) : '—'} />
            <Stat label="Responses" value={`${s.responses}/${s.sentTotal}`} />
            <Stat label="Promoters" value={`${s.promoters}`} tone="text-[var(--color-jade)]" />
          </div>
          <p className="mt-3 text-xs text-[var(--color-stone)]">{s.promoters} promoters (9–10) · {s.passives} passives (7–8) · {s.detractors} detractors (0–6). NPS = % promoters − % detractors.</p>

          {s.comments.length > 0 && (
            <section className="mt-8">
              <h2 className="font-[family-name:var(--font-display)] text-xl">Recent comments</h2>
              <ul className="mt-3 space-y-2">
                {s.comments.map((c, i) => (
                  <li key={i} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 text-sm">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${(c.score ?? 0) >= 9 ? 'bg-green-100 text-green-800' : (c.score ?? 0) <= 6 ? 'bg-red-100 text-red-800' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{c.score}</span>
                    {/* The client's name is the PII here, not the link, so gate
                        both on clients.view — this page is reachable on
                        reviews.manage alone, which no default role pairs with
                        an absent clients.view but a custom permission set can.
                        Nobody without clients.view can act on the follow-up
                        anyway. clientId is null once a client is anonymised or
                        deleted (schema onDelete: SetNull), so the name can
                        still show without a link. (BLD-1305) */}
                    {sessionCan(session, 'clients.view') && (c.clientId || c.clientName) ? (
                      c.clientId ? (
                        <a href={`/admin/clients/${c.clientId}`} className="mr-2 font-medium text-[var(--color-ink)] hover:underline">{c.clientName || 'View client'}</a>
                      ) : (
                        <span className="mr-2 font-medium text-[var(--color-ink)]">{c.clientName}</span>
                      )
                    ) : null}
                    <span className="text-[var(--color-ink-soft)]">{c.comment}</span>
                    <span className="ml-2 text-xs text-[var(--color-stone)]">{c.treatment ? `· ${c.treatment} ` : ''}· {fmt(c.at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AdminShell>
  );
}
