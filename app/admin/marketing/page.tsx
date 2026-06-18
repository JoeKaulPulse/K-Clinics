import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

const TOOLS: { href: string; title: string; desc: string }[] = [
  { href: '/admin/marketing/campaigns', title: 'Campaigns', desc: 'Plan & run cross-channel campaigns — email, paid, SEO & landing pages, with AI assist.' },
  { href: '/admin/marketing/performance', title: 'Performance & forecast', desc: 'Revenue by source & campaign, attribution and a data-driven forecast.' },
  { href: '/admin/marketing/audiences', title: 'Audiences', desc: 'Reusable client segments with live size estimates for targeting.' },
  { href: '/admin/brand', title: 'Brand kit', desc: 'Colours, fonts, logos & tone of voice — the source of brand truth.' },
  { href: '/admin/marketing/ab', title: 'A/B testing', desc: 'Split-test landing-page headlines & CTAs to find the winner.' },
  { href: '/admin/marketing/insights', title: 'Behaviour insights', desc: 'Click heatmaps, scroll depth and full session replay.' },
  { href: '/admin/marketing/connections', title: 'Connections', desc: 'One-click connect Google, Meta, TikTok & email platforms.' },
  { href: '/admin/marketing/email', title: 'Email marketing', desc: 'Build & send branded emails via Resend; track opens, clicks & bounces.' },
  { href: '/admin/marketing/templates', title: 'Email templates', desc: 'Preview every client email, live and on-brand.' },
  { href: '/admin/automations', title: 'Automations', desc: 'Birthday, follow-up and win-back email flows.' },
  { href: '/admin/seo', title: 'SEO & pixels', desc: 'Search health, AI answers, and ad/analytics tracking.' },
  { href: '/admin/qr', title: 'QR codes', desc: 'Dynamic QR codes for print & in-clinic, with scan analytics.' },
  { href: '/admin/redirects', title: 'Redirects', desc: 'Preserve SEO from old URLs and printed links.' },
];

export default async function MarketingHubPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view') && !sessionCan(session, 'settings.manage')) redirect('/admin');

  let kpis = { rev30: 0, bookings30: 0, conversion: 0, newClients30: 0 };
  try {
    const { getAnalytics } = await import('@/lib/crm-data');
    const a = await getAnalytics();
    kpis = { rev30: a.rev30 ?? 0, bookings30: a.bookings30 ?? 0, conversion: a.conversion ?? 0, newClients30: a.newClients30 ?? 0 };
  } catch { /* analytics optional */ }

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Marketing</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Your command centre for growth — campaigns, brand, content, paid, SEO and analytics in one place.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue · 30 days" value={money(kpis.rev30)} />
        <Kpi label="Bookings · 30 days" value={String(kpis.bookings30)} />
        <Kpi label="Enquiry → booking" value={`${Math.round(kpis.conversion)}%`} />
        <Kpi label="New clients · 30 days" value={String(kpis.newClients30)} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="group rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 transition-colors hover:border-[var(--color-gold)]">
            <h2 className="font-[family-name:var(--font-display)] text-lg transition-colors group-hover:text-[var(--color-gold)]">{t.title}</h2>
            <p className="mt-1 text-sm text-[var(--color-stone)]">{t.desc}</p>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl tabular-nums text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
