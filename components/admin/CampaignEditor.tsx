'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type CampaignData = {
  id: string; name: string; slug: string; status: string; goal: string;
  audience: string; description: string; brief: string; heroImage: string; utmCampaign: string;
  startAt: string; endAt: string; budget: string; spend: string; targetRevenue: string; targetBookings: string;
  channels: string[];
};
type Stats = { bookings: number; revenuePence: number; roi: number | null };

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const field = 'mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm';
const STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED'];
const CHANNELS: { key: string; label: string }[] = [
  { key: 'email', label: 'Email' }, { key: 'google_ads', label: 'Google Ads' }, { key: 'meta', label: 'Meta (FB/IG)' },
  { key: 'tiktok', label: 'TikTok' }, { key: 'seo', label: 'SEO' }, { key: 'landing', label: 'Landing page' },
];

export function CampaignEditor({ data, stats, baseUrl, canManage, spendSyncedAt }: { data: CampaignData; stats: Stats; baseUrl: string; canManage: boolean; spendSyncedAt?: string | null }) {
  const router = useRouter();
  const [f, setF] = useState<CampaignData>(data);
  const [landing, setLanding] = useState('/');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = <K extends keyof CampaignData>(k: K, v: CampaignData[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleChannel = (key: string) => set('channels', f.channels.includes(key) ? f.channels.filter((c) => c !== key) : [...f.channels, key]);

  async function save(extra: Partial<Record<string, unknown>> = {}) {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/marketing/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'update', id: f.id, name: f.name, goal: f.goal, audience: f.audience, description: f.description, brief: f.brief, heroImage: f.heroImage, utmCampaign: f.utmCampaign, startAt: f.startAt || null, endAt: f.endAt || null, budget: f.budget, spend: f.spend, targetRevenue: f.targetRevenue, targetBookings: f.targetBookings, channels: f.channels, ...extra }),
    });
    setBusy(false);
    setMsg(res.ok ? 'Saved ✓' : 'Save failed'); router.refresh();
  }
  async function setStatus(status: string) { set('status', status); await save({ status }); }
  async function remove() { if (!confirm('Delete this campaign? Attribution on existing bookings is kept but unlinked.')) return; await fetch('/api/admin/marketing/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'remove', id: f.id }) }); router.push('/admin/marketing/campaigns'); }

  // Tracking-link generator.
  const base = `${baseUrl}${landing.startsWith('/') ? landing : `/${landing}`}`;
  const link = (source: string, medium: string) => `${base}?utm_source=${source}&utm_medium=${medium}&utm_campaign=${encodeURIComponent(f.utmCampaign)}`;
  const trackingLinks = [
    { label: 'Google Ads', url: link('google', 'cpc') },
    { label: 'Meta (FB/IG)', url: link('meta', 'paid_social') },
    { label: 'TikTok', url: link('tiktok', 'paid_social') },
    { label: 'Email', url: link('email', 'email') },
    { label: 'Short tag', url: `${base}?c=${encodeURIComponent(f.slug)}` },
  ];

  const targetRev = Number(f.targetRevenue) * 100;
  const revPct = targetRev > 0 ? Math.min(100, Math.round((stats.revenuePence / targetRev) * 100)) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/marketing/campaigns" className="text-xs text-[var(--color-stone)] hover:underline">← All campaigns</Link>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{f.name}</h1>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <select value={f.status} onChange={(e) => setStatus(e.target.value)} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Performance */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi label="Bookings" value={String(stats.bookings)} sub={f.targetBookings ? `target ${f.targetBookings}` : undefined} />
        <Kpi label="Revenue" value={money(stats.revenuePence)} sub={revPct != null ? `${revPct}% of target` : undefined} />
        <Kpi label="Spend" value={money(Number(f.spend) * 100 || 0)} />
        <Kpi label="ROI" value={stats.roi == null ? '—' : `${stats.roi}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Setup */}
        <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Campaign setup</h2>
          <label className="block text-xs text-[var(--color-stone)]">Name<input value={f.name} onChange={(e) => set('name', e.target.value)} className={field} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-[var(--color-stone)]">Goal
              <select value={f.goal} onChange={(e) => set('goal', e.target.value)} className={field}><option value="bookings">Bookings</option><option value="revenue">Revenue</option><option value="leads">Leads</option><option value="awareness">Awareness</option></select>
            </label>
            <label className="text-xs text-[var(--color-stone)]">Audience / segment<input value={f.audience} onChange={(e) => set('audience', e.target.value)} placeholder="e.g. lapsed female clients" className={field} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-[var(--color-stone)]">Starts<input type="date" value={f.startAt} onChange={(e) => set('startAt', e.target.value)} className={field} /></label>
            <label className="text-xs text-[var(--color-stone)]">Ends<input type="date" value={f.endAt} onChange={(e) => set('endAt', e.target.value)} className={field} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <label className="text-xs text-[var(--color-stone)]">Budget £<input value={f.budget} onChange={(e) => set('budget', e.target.value)} className={field} /></label>
            <label className="text-xs text-[var(--color-stone)]">Spend £{spendSyncedAt && <span className="ml-1 text-[var(--color-stone-soft)]">· synced {new Date(spendSyncedAt).toLocaleDateString('en-GB')}</span>}<input value={f.spend} onChange={(e) => set('spend', e.target.value)} className={field} /></label>
            <label className="text-xs text-[var(--color-stone)]">Target £<input value={f.targetRevenue} onChange={(e) => set('targetRevenue', e.target.value)} className={field} /></label>
            <label className="text-xs text-[var(--color-stone)]">Target bookings<input value={f.targetBookings} onChange={(e) => set('targetBookings', e.target.value)} className={field} /></label>
          </div>
          <label className="block text-xs text-[var(--color-stone)]">Creative brief (used by the AI assistant)<textarea value={f.brief} onChange={(e) => set('brief', e.target.value)} rows={3} placeholder="What's the offer, the hook, the audience and the desired action?" className={field} /></label>
          <div>
            <p className="text-xs text-[var(--color-stone)]">Channels</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <button key={c.key} onClick={() => toggleChannel(c.key)} className={`rounded-full border px-3 py-1 text-xs ${f.channels.includes(c.key) ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-white' : 'border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>{c.label}</button>
              ))}
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => save()} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
              {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
              <button onClick={remove} className="ml-auto text-xs text-[var(--color-blush)] hover:underline">Delete campaign</button>
            </div>
          )}
        </section>

        {/* Channels & tracking */}
        <div className="space-y-6">
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg">Channel tools</h2>
            <div className="grid gap-2 text-sm">
              <Link href={`/admin/campaigns?campaign=${f.slug}`} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 hover:border-[var(--color-gold)]">✉️ Compose campaign email →</Link>
              <Link href="/admin/pages" className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 hover:border-[var(--color-gold)]">📄 Build a landing page →</Link>
              <Link href="/admin/seo" className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 hover:border-[var(--color-gold)]">🔎 SEO & pixels →</Link>
              <Link href="/admin/qr" className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 hover:border-[var(--color-gold)]">▦ QR code for print →</Link>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">Tracking links</h2>
            <p className="mb-2 text-xs text-[var(--color-stone)]">Paste these into each channel so bookings attribute back to this campaign automatically.</p>
            <label className="block text-xs text-[var(--color-stone)]">Landing path<input value={landing} onChange={(e) => setLanding(e.target.value)} className={field} /></label>
            <ul className="mt-3 space-y-2">
              {trackingLinks.map((l) => (
                <li key={l.label} className="text-xs">
                  <span className="font-medium text-[var(--color-ink)]">{l.label}</span>
                  <button onClick={() => navigator.clipboard?.writeText(l.url)} className="ml-2 text-[var(--color-gold)] hover:underline">copy</button>
                  <span className="mt-0.5 block truncate font-mono text-[0.65rem] text-[var(--color-stone-soft)]">{l.url}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone-soft)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">{value}</p>
      {sub && <p className="text-[0.65rem] text-[var(--color-stone)]">{sub}</p>}
    </div>
  );
}
