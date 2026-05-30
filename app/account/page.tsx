import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { crmEnabled } from '@/lib/crm';
import { formatPrice } from '@/lib/treatments';
import { portalAssessments } from '@/lib/questionnaires';

export default async function DashboardPage() {
  if (!crmEnabled) return <NotEnabled />;

  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getDashboard } = await import('@/lib/portal-data');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const data = await getDashboard(client.id);

  const next = data.upcoming[0];
  const outstanding = portalAssessments.filter((q) => !data.assessments[q.type]);

  return (
    <PortalShell firstName={client.firstName}>
      <div className="mb-10">
        <p className="eyebrow mb-2">Your portal</p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.4rem+2vw,3rem)]">
          Welcome back, {client.firstName}.
        </h1>
      </div>

      {data.discount && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] p-6">
          <div>
            <p className="font-medium">Your welcome offer is ready</p>
            <p className="text-sm text-[var(--color-stone)]">
              {data.discount.percent}% off your first treatment — code{' '}
              <span className="font-mono font-semibold text-[var(--color-gold)]">{data.discount.code}</span>
            </p>
          </div>
          <Link href="/book" className="rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">
            Book a treatment
          </Link>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Next appointment */}
        <Card title="Next appointment">
          {next ? (
            <div>
              <p className="font-[family-name:var(--font-display)] text-xl">{next.treatmentTitle}</p>
              <p className="mt-1 text-[var(--color-stone)]">
                {next.startAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
                {next.startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <Link href="/account/appointments" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold)]">
                Manage →
              </Link>
            </div>
          ) : (
            <Empty text="No upcoming appointments." cta={{ href: '/book', label: 'Book now' }} />
          )}
        </Card>

        {/* Assessments to complete */}
        <Card title="Health forms">
          {outstanding.length ? (
            <ul className="space-y-3">
              {outstanding.map((q) => (
                <li key={q.key} className="flex items-center justify-between gap-3">
                  <span>{q.title}</span>
                  <Link
                    href={`/account/assessments/${q.key}`}
                    className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)]"
                  >
                    Complete · {q.estMinutes} min
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="All forms complete — thank you." />
          )}
        </Card>

        {/* Recent payments */}
        <Card title="Recent payments">
          {data.invoices.length ? (
            <ul className="divide-y divide-[var(--color-line)]">
              {data.invoices.slice(0, 3).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{inv.title}</span>
                  <span className="font-medium">{formatPrice(inv.amountPence)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No payments yet." />
          )}
          <Link href="/account/invoices" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold)]">
            All payments & invoices →
          </Link>
        </Card>

        {/* Book more */}
        <Card title="Book another session">
          <p className="text-[var(--color-stone)]">Browse treatments and reserve your next visit in moments.</p>
          <Link href="/treatments" className="mt-4 inline-block rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
            Explore treatments
          </Link>
        </Card>
      </div>
    </PortalShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)]">
      <h2 className="eyebrow mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="text-[var(--color-stone)]">
      <p>{text}</p>
      {cta && (
        <Link href={cta.href} className="mt-3 inline-block text-sm font-medium text-[var(--color-gold)]">
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

function NotEnabled() {
  return (
    <div className="mx-auto grid min-h-screen max-w-md place-items-center px-6 text-center">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">Client portal</h1>
        <p className="mt-3 text-[var(--color-stone)]">
          The secure portal runs on the live environment (server + database). It isn’t available in this static preview.
        </p>
      </div>
    </div>
  );
}
