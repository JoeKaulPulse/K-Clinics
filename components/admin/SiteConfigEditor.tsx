'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SiteConfig } from '@/lib/site-config';
import { NavEditor } from '@/components/admin/NavEditor';

type Revision = { id: string; label: string | null; createdAt: string; createdBy: string | null };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const label = 'block text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)] mb-1.5';
const card = 'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5';

export function SiteConfigEditor({ initial, revisions }: { initial: SiteConfig; revisions: Revision[] }) {
  const router = useRouter();
  const [c, setC] = useState<SiteConfig>(initial);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'globals' | 'nav'>('globals');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Setters for nested values, kept terse.
  const top = <K extends keyof SiteConfig>(k: K, v: SiteConfig[K]) => setC((s) => ({ ...s, [k]: v }));
  const nest = <K extends keyof SiteConfig>(k: K, patch: Partial<SiteConfig[K]>) => setC((s) => ({ ...s, [k]: { ...(s[k] as object), ...patch } as SiteConfig[K] }));

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/site', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'save', data: c }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { setMsg({ kind: 'err', text: data.error || 'Could not save.' }); return; }
    setMsg({ kind: 'ok', text: 'Saved — live across the site.' });
    router.refresh();
  }
  async function rollback(id: string) {
    if (!confirm('Restore this version? Your current values are snapshotted first, so you can undo.')) return;
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/site', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'rollback', revisionId: id }) });
    setBusy(false);
    if (res.ok) { setMsg({ kind: 'ok', text: 'Restored.' }); router.refresh(); }
    else setMsg({ kind: 'err', text: 'Rollback failed.' });
  }

  // ── Social links (dynamic rows) ──
  const socialRows = Object.entries(c.social);
  const setSocial = (rows: [string, string][]) => top('social', Object.fromEntries(rows.filter(([k]) => k.trim())) as Record<string, string>);

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Site &amp; global variables</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">One place for contact details, social links, hours, booking, the announcement bar, navigation and brand text. Changes go live across every page on save.</p>
        </div>
      </div>

      <div className="mt-5 inline-flex rounded-full border border-[var(--color-line)] bg-[var(--color-bone)] p-1 text-sm">
        {([['globals', 'Global variables'], ['nav', 'Navigation']] as const).map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-full px-4 py-1.5 transition-colors ${tab === id ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-ink-soft)]'}`}>{lbl}</button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          {tab === 'nav' ? (
            <NavEditor nav={c.nav} onChange={(nav) => top('nav', nav)} />
          ) : (
          <>{/* globals */}
          {/* Brand */}
          <section className={card}>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Brand</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={label}>Name</label><input className={field} value={c.name} onChange={(e) => top('name', e.target.value)} /></div>
              <div><label className={label}>Legal name</label><input className={field} value={c.legalName} onChange={(e) => top('legalName', e.target.value)} /></div>
              <div><label className={label}>Company number</label><input className={field} value={c.companyNumber} onChange={(e) => top('companyNumber', e.target.value)} placeholder="17101088" /></div>
            </div>
            <div className="mt-4"><label className={label}>Tagline</label><input className={field} value={c.tagline} onChange={(e) => top('tagline', e.target.value)} /></div>
            <div className="mt-4"><label className={label}>Description <span className="normal-case text-[var(--color-stone)]">(SEO / meta default)</span></label><textarea className={`${field} min-h-[80px]`} value={c.description} onChange={(e) => top('description', e.target.value)} /></div>
          </section>

          {/* Announcement bar */}
          <section className={card}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-xl">Announcement bar</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={c.announcement.enabled} onChange={(e) => nest('announcement', { enabled: e.target.checked })} />
                Show banner
              </label>
            </div>
            <div><label className={label}>Message</label><input className={field} value={c.announcement.message} placeholder="e.g. 15% off your first visit this month" onChange={(e) => nest('announcement', { message: e.target.value })} /></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label className={label}>Link text <span className="normal-case text-[var(--color-stone)]">(optional)</span></label><input className={field} value={c.announcement.linkLabel || ''} onChange={(e) => nest('announcement', { linkLabel: e.target.value })} /></div>
              <div><label className={label}>Link URL</label><input className={field} value={c.announcement.linkHref || ''} placeholder="/offers" onChange={(e) => nest('announcement', { linkHref: e.target.value })} /></div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label className={label}>Start date <span className="normal-case text-[var(--color-stone)]">(optional)</span></label><input type="date" className={field} value={c.announcement.startAt?.slice(0, 10) || ''} onChange={(e) => nest('announcement', { startAt: e.target.value || null })} /></div>
              <div><label className={label}>End date <span className="normal-case text-[var(--color-stone)]">(optional)</span></label><input type="date" className={field} value={c.announcement.endAt?.slice(0, 10) || ''} onChange={(e) => nest('announcement', { endAt: e.target.value || null })} /></div>
            </div>
          </section>

          {/* Contact */}
          <section className={card}>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={label}>Phone (display)</label><input className={field} value={c.phone} onChange={(e) => top('phone', e.target.value)} /></div>
              <div><label className={label}>Phone link <span className="normal-case text-[var(--color-stone)]">(tel:)</span></label><input className={field} value={c.phoneHref} onChange={(e) => top('phoneHref', e.target.value)} /></div>
              <div><label className={label}>Email (display)</label><input className={field} value={c.email} onChange={(e) => top('email', e.target.value)} /></div>
              <div><label className={label}>Email link <span className="normal-case text-[var(--color-stone)]">(mailto:)</span></label><input className={field} value={c.emailHref} onChange={(e) => top('emailHref', e.target.value)} /></div>
              <div><label className={label}>WhatsApp <span className="normal-case text-[var(--color-stone)]">(digits, intl)</span></label><input className={field} value={c.whatsapp} onChange={(e) => top('whatsapp', e.target.value)} /></div>
            </div>
          </section>

          {/* Address */}
          <section className={card}>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Address &amp; map</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={label}>Street</label><input className={field} value={c.address.street} onChange={(e) => nest('address', { street: e.target.value })} /></div>
              <div><label className={label}>Locality</label><input className={field} value={c.address.locality} onChange={(e) => nest('address', { locality: e.target.value })} /></div>
              <div><label className={label}>Region</label><input className={field} value={c.address.region} onChange={(e) => nest('address', { region: e.target.value })} /></div>
              <div><label className={label}>Postcode</label><input className={field} value={c.address.postalCode} onChange={(e) => nest('address', { postalCode: e.target.value })} /></div>
              <div><label className={label}>Country</label><input className={field} value={c.address.countryName} onChange={(e) => nest('address', { countryName: e.target.value })} /></div>
            </div>
            <div className="mt-4"><label className={label}>Map link <span className="normal-case text-[var(--color-stone)]">(Google Maps share URL)</span></label><input className={field} value={c.mapLink} onChange={(e) => top('mapLink', e.target.value)} /></div>
            <div className="mt-4"><label className={label}>Map embed URL</label><input className={field} value={c.mapEmbed} onChange={(e) => top('mapEmbed', e.target.value)} /></div>
          </section>

          {/* Opening hours */}
          <section className={card}>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Opening hours</h2>
            <div className="space-y-2">
              {c.hours.map((h, i) => (
                <div key={h.day} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-3">
                  <span className="text-sm font-medium">{h.day}</span>
                  <input className={field} value={h.open} placeholder="09:00 or Closed" onChange={(e) => { const hours = [...c.hours]; hours[i] = { ...h, open: e.target.value }; top('hours', hours); }} />
                  <input className={field} value={h.close} placeholder="19:00 or Closed" onChange={(e) => { const hours = [...c.hours]; hours[i] = { ...h, close: e.target.value }; top('hours', hours); }} />
                </div>
              ))}
            </div>
          </section>

          {/* Social */}
          <section className={card}>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Social links</h2>
            <div className="space-y-2">
              {socialRows.map(([k, v], i) => (
                <div key={i} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-3">
                  <input className={field} value={k} placeholder="platform" onChange={(e) => { const rows = socialRows.map((r) => [...r] as [string, string]); rows[i][0] = e.target.value.toLowerCase(); setSocial(rows); }} />
                  <input className={field} value={v} placeholder="https://…" onChange={(e) => { const rows = socialRows.map((r) => [...r] as [string, string]); rows[i][1] = e.target.value; setSocial(rows); }} />
                  <button className="text-[var(--color-stone)] hover:text-[#c0392b]" onClick={() => setSocial(socialRows.filter((_, j) => j !== i) as [string, string][])} aria-label="Remove">✕</button>
                </div>
              ))}
            </div>
            <button className="mt-3 text-sm text-[var(--color-gold-deep)] hover:underline" onClick={() => setSocial([...socialRows as [string, string][], ['', '']])}>+ Add social link</button>
            <p className="mt-2 text-xs text-[var(--color-stone)]">Known platforms (instagram, facebook, tiktok) get branded icons; others show an initial.</p>
          </section>

          {/* Booking + service flags */}
          <section className={card}>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">Booking &amp; services</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={label}>Booking page path</label><input className={field} value={c.booking.path} onChange={(e) => nest('booking', { path: e.target.value })} /></div>
              <div><label className={label}>Booking phone CTA</label><input className={field} value={c.booking.phoneCta} onChange={(e) => nest('booking', { phoneCta: e.target.value })} /></div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={c.dentistryLive} onChange={(e) => top('dentistryLive', e.target.checked)} />
              Dentistry is live <span className="text-[var(--color-stone)]">(off = “opening soon” + register interest)</span>
            </label>
          </section>

          <p className="text-xs text-[var(--color-stone)]">The media library and page builder arrive in the next update.</p>
          </>
          )}
        </div>

        {/* Sticky save + history */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className={card}>
            <button disabled={busy} onClick={save} className="w-full rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>
            {msg && <p className={`mt-3 text-sm ${msg.kind === 'ok' ? 'text-[var(--color-jade)]' : 'text-[#c0392b]'}`}>{msg.text}</p>}
            <p className="mt-3 text-xs text-[var(--color-stone)]">Saved changes publish immediately across the live site.</p>
          </div>

          <div className={card}>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone)]">Version history</h3>
            {revisions.length === 0 && <p className="text-sm text-[var(--color-stone)]">No previous versions yet. Each save creates a restore point.</p>}
            <ul className="space-y-2">
              {revisions.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] pb-2 text-sm last:border-0">
                  <span>
                    <span className="block">{new Date(r.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {(r.label || r.createdBy) && <span className="text-xs text-[var(--color-stone)]">{r.label || r.createdBy}</span>}
                  </span>
                  <button disabled={busy} onClick={() => rollback(r.id)} className="shrink-0 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)] hover:text-[var(--color-gold-deep)] disabled:opacity-50">Restore</button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
