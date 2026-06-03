'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parsePriceMatrix } from '@/lib/price-import';
import { PriceListUpload } from '@/components/admin/PriceListUpload';

type Variant = { id: string; name: string; durationMin: number; pricePence: number; costPence: number | null; courses: { sessions: number; totalPence: number }[]; status: string | null };
type Service = { id: string; slug: string; treatmentSlug: string; name: string; category: string; active: boolean; status: string; variants: Variant[] };
type Offer = { id: string; name: string; scope: string; serviceId: string | null; variantId: string | null; percentOff: number | null; amountOffPence: number | null; startAt: string | null; endAt: string | null; promoted: boolean };
type TreatmentOpt = { slug: string; title: string; category: string };

// Public presentation states. Price is always kept internally; this controls
// what the public site shows + whether the service books online.
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'NORMAL', label: 'Bookable — show price' },
  { value: 'CONSULTATION', label: 'On consultation (price hidden, still books)' },
  { value: 'COMING_SOON', label: 'Coming soon (enquiry only)' },
  { value: 'UNAVAILABLE', label: 'Currently unavailable (enquiry only)' },
];

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm';
const money = (p: number | null) => (p == null ? '—' : p === 0 ? 'On consult.' : `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`);
const pounds = (p: number | null) => (p == null ? '' : (p / 100).toString());

async function post(payload: object) {
  return fetch('/api/admin/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function ServicesManager({ services, offers, treatments }: { services: Service[]; offers: Offer[]; treatments: TreatmentOpt[] }) {
  return (
    <div className="space-y-8">
      <ImportPanel services={services} treatments={treatments} />
      <BulkPrice services={services} />
      <OffersSection services={services} offers={offers} />
      <div className="space-y-5">
        {services.map((s) => <ServiceCard key={s.id} service={s} />)}
      </div>
    </div>
  );
}

function ImportPanel({ services, treatments }: { services: Service[]; treatments: TreatmentOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(''); // serviceId or '' for new
  const [newName, setNewName] = useState('');
  const [treatmentSlug, setTreatmentSlug] = useState(treatments[0]?.slug ?? '');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState<{ name: string; durationMin: number; pricePence: number; courses: { sessions: number; totalPence: number }[] }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function doPreview() {
    const r = parsePriceMatrix(raw);
    setPreview(r.variants);
    setMsg(r.variants.length ? `${r.variants.length} variant(s) read${r.warnings.length ? ` · ${r.warnings.length} line(s) skipped` : ''}` : 'Nothing could be read — check the format.');
  }
  async function doImport() {
    if (!preview?.length) { setMsg('Preview first.'); return; }
    if (!target && (!newName.trim() || !treatmentSlug)) { setMsg('Name the new service and link a treatment.'); return; }
    setBusy(true); setMsg('Importing…');
    const cat = treatments.find((t) => t.slug === treatmentSlug)?.category;
    const res = await post({ op: 'import', raw, serviceId: target || undefined, newServiceName: target ? undefined : newName, treatmentSlug: target ? undefined : treatmentSlug, category: cat, mode });
    const j = await res.json();
    setBusy(false);
    if (res.ok) { setMsg(`Imported ${j.imported} variant(s) ✓`); setRaw(''); setPreview(null); router.refresh(); }
    else setMsg(j.error || 'Import failed.');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg">Import from the price sheet</h2>
          <p className="text-sm text-[var(--color-stone)]">Paste rows from your pricing spreadsheet — name, price, per-session, sessions, minutes, minutes+doc. Course rows group automatically.</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{open ? 'Close' : 'Open importer'}</button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          <PriceListUpload treatments={treatments} onImported={() => router.refresh()} />
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone-soft)]">Or paste a single block manually</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-stone)]">Import into<br />
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
                <option value="">+ New service…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            {!target && (
              <>
                <label className="text-xs text-[var(--color-stone)]">New service name<br /><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Laser Hair Removal — Women" className={`${field} w-56`} /></label>
                <label className="text-xs text-[var(--color-stone)]">Linked treatment<br />
                  <select value={treatmentSlug} onChange={(e) => setTreatmentSlug(e.target.value)} className={field}>
                    {treatments.map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}
                  </select>
                </label>
              </>
            )}
            <label className="text-xs text-[var(--color-stone)]">Mode<br />
              <select value={mode} onChange={(e) => setMode(e.target.value as 'replace' | 'append')} className={field}>
                <option value="replace">Replace variants</option>
                <option value="append">Add to existing</option>
              </select>
            </label>
          </div>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} placeholder="Bikini line 1 session	27	0	1	15	25&#10;Bikini line 3 session	73	25	3	15	25" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-3 font-mono text-xs" />
          <div className="flex items-center gap-2">
            <button onClick={doPreview} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">Preview</button>
            <button onClick={doImport} disabled={busy || !preview?.length} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? '…' : 'Import'}</button>
            {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
          </div>
          {preview && preview.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white">
              <table className="w-full text-sm">
                <thead><tr className="sticky top-0 bg-[var(--color-bone)] text-left text-xs uppercase text-[var(--color-stone-soft)]"><th className="p-2">Variant</th><th className="p-2">Min</th><th className="p-2">Price</th><th className="p-2">Courses</th></tr></thead>
                <tbody>
                  {preview.map((v, i) => (
                    <tr key={i} className="border-t border-[var(--color-line)]">
                      <td className="p-2">{v.name}</td><td className="p-2">{v.durationMin}</td><td className="p-2">{money(v.pricePence)}</td>
                      <td className="p-2 text-xs text-[var(--color-stone)]">{v.courses.map((c) => `${c.sessions}×${money(c.totalPence)}`).join('  ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BulkPrice({ services }: { services: Service[] }) {
  const router = useRouter();
  const [scope, setScope] = useState('');
  const [percent, setPercent] = useState('');
  const [msg, setMsg] = useState('');

  async function apply() {
    const pct = Number(percent);
    if (!pct) { setMsg('Enter a non-zero %.'); return; }
    if (!confirm(`Change ${scope ? 'this service’s' : 'ALL'} prices by ${pct > 0 ? '+' : ''}${pct}%? This updates session and course prices.`)) return;
    setMsg('Applying…');
    const res = await post({ op: 'bulkPrice', percent: pct, serviceId: scope || undefined });
    const j = await res.json();
    setMsg(res.ok ? `Updated ${j.updated} variant(s) ✓` : j.error || 'Failed');
    router.refresh();
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">Bulk price change</h2>
      <p className="mb-3 text-sm text-[var(--color-stone)]">Raise or cut prices by a fixed percentage — across everything or one service. Use a negative number to reduce.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--color-stone)]">Apply to<br />
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={field}>
            <option value="">All services</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-[var(--color-stone)]">Change %<br /><input type="number" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="e.g. 5 or -10" className={`${field} w-28`} /></label>
        <button onClick={apply} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">Apply</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function act(payload: object) { await post(payload); router.refresh(); }
  return (
    <section className={`rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 ${service.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setOpen((v) => !v)} className="text-left">
          <h3 className="font-[family-name:var(--font-display)] text-lg">{service.name}</h3>
          <p className="text-xs text-[var(--color-stone-soft)]">{service.variants.length} variant(s) · {service.category} · {open ? 'hide' : 'show'}</p>
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-stone)]">
            Public status
            <select value={service.status} onChange={(e) => act({ op: 'updateService', id: service.id, status: e.target.value })} className={field}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <Link href={`/admin/services/content/${service.treatmentSlug}`} className="text-xs font-medium text-[var(--color-gold)] hover:underline">Edit page content →</Link>
          <button onClick={() => act({ op: 'updateService', id: service.id, active: !service.active })} className="text-xs text-[var(--color-stone)] hover:underline">{service.active ? 'Disable' : 'Enable'}</button>
        </div>
      </div>
      {open && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone-soft)]">
              <th className="py-1 pr-2">Variant</th><th className="px-2">Min</th><th className="px-2">Price £</th><th className="px-2">Cost £</th><th className="px-2">Margin</th><th className="px-2">Status</th><th className="px-2"></th>
            </tr></thead>
            <tbody>
              {service.variants.map((v) => <VariantRow key={v.id} v={v} />)}
            </tbody>
          </table>
          <AddVariant serviceId={service.id} />
        </div>
      )}
    </section>
  );
}

function VariantRow({ v }: { v: Variant }) {
  const router = useRouter();
  const [price, setPrice] = useState(pounds(v.pricePence));
  const [cost, setCost] = useState(pounds(v.costPence));
  const [dur, setDur] = useState(String(v.durationMin));
  const [saved, setSaved] = useState(false);
  const dirty = price !== pounds(v.pricePence) || cost !== pounds(v.costPence) || dur !== String(v.durationMin);

  const margin = v.costPence != null && v.pricePence > 0 ? Math.round(((v.pricePence - v.costPence) / v.pricePence) * 100) : null;

  async function save() {
    await post({ op: 'updateVariant', id: v.id, pricePence: Math.round(Number(price || 0) * 100), costPence: cost === '' ? null : Math.round(Number(cost) * 100), durationMin: Number(dur) });
    setSaved(true); setTimeout(() => setSaved(false), 1500); router.refresh();
  }
  async function remove() { if (confirm(`Remove “${v.name}”?`)) { await post({ op: 'removeVariant', id: v.id }); router.refresh(); } }
  async function setStatus(status: string) { await post({ op: 'updateVariant', id: v.id, status: status || null }); router.refresh(); }

  return (
    <tr className="border-t border-[var(--color-line)]">
      <td className="py-1.5 pr-2">{v.name}{v.courses.length > 0 && <span className="ml-1 text-[0.65rem] text-[var(--color-stone-soft)]">+{v.courses.length} course{v.courses.length > 1 ? 's' : ''}</span>}</td>
      <td className="px-2"><input value={dur} onChange={(e) => setDur(e.target.value)} className={`${field} w-14`} /></td>
      <td className="px-2"><input value={price} onChange={(e) => setPrice(e.target.value)} className={`${field} w-20`} /></td>
      <td className="px-2"><input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="—" className={`${field} w-20`} /></td>
      <td className="px-2 text-[var(--color-stone)]">{margin == null ? '—' : `${margin}%`}</td>
      <td className="px-2">
        <select value={v.status ?? ''} onChange={(e) => setStatus(e.target.value)} className={`${field} max-w-[8.5rem]`} title="Override the service status for this option">
          <option value="">Inherit</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label.split(' (')[0].split(' — ')[0]}</option>)}
        </select>
      </td>
      <td className="px-2 text-right">
        {dirty ? <button onClick={save} className="rounded-full bg-[var(--color-gold)] px-3 py-1 text-xs text-white">Save</button>
          : saved ? <span className="text-xs text-green-700">Saved ✓</span>
          : <button onClick={remove} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>}
      </td>
    </tr>
  );
}

function AddVariant({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [dur, setDur] = useState('30');
  async function add() {
    if (!name.trim()) return;
    await post({ op: 'addVariant', serviceId, name, pricePence: Math.round(Number(price || 0) * 100), durationMin: Number(dur) });
    setName(''); setPrice(''); router.refresh();
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New variant name" className={`${field} w-48`} />
      <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="£ price" className={`${field} w-24`} />
      <input value={dur} onChange={(e) => setDur(e.target.value)} placeholder="min" className={`${field} w-16`} />
      <button onClick={add} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:border-[var(--color-gold)]">+ Add variant</button>
    </div>
  );
}

function OffersSection({ services, offers }: { services: Service[]; offers: Offer[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [scope, setScope] = useState('ALL');
  const [serviceId, setServiceId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [discType, setDiscType] = useState<'percent' | 'amount'>('percent');
  const [amount, setAmount] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [msg, setMsg] = useState('');

  const allVariants = services.flatMap((s) => s.variants.map((v) => ({ id: v.id, label: `${s.name} — ${v.name}` })));

  async function create() {
    if (!name.trim() || !amount) { setMsg('Name + discount required.'); return; }
    if (scope === 'SERVICE' && !serviceId) { setMsg('Choose a service.'); return; }
    if (scope === 'VARIANT' && !variantId) { setMsg('Choose an option.'); return; }
    const res = await post({
      op: 'createOffer', name, scope,
      serviceId: scope === 'SERVICE' ? serviceId : undefined,
      variantId: scope === 'VARIANT' ? variantId : undefined,
      percentOff: discType === 'percent' ? Number(amount) : undefined,
      amountOffPence: discType === 'amount' ? Math.round(Number(amount) * 100) : undefined,
      startAt: startAt || undefined, endAt: endAt || undefined, promoted: true,
    });
    if (res.ok) { setName(''); setAmount(''); setStartAt(''); setEndAt(''); setMsg(''); router.refresh(); } else { const j = await res.json(); setMsg(j.error || 'Failed'); }
  }
  async function act(payload: object) { await post(payload); router.refresh(); }
  const svcName = (id: string | null) => services.find((s) => s.id === id)?.name ?? '';

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">Special offers &amp; seasonal discounts</h2>
      <p className="mb-3 text-sm text-[var(--color-stone)]">Set a site-wide, per-service or per-option discount with optional start/end dates. Promoted offers appear on the marketing site (as a struck-through “was / now” price with the offer label) and apply automatically at booking.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--color-stone)]">Name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Skin" className={`${field} w-44`} /></label>
        <label className="text-xs text-[var(--color-stone)]">Scope<br />
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={field}>
            <option value="ALL">All services</option>
            <option value="SERVICE">One service</option>
            <option value="VARIANT">One option</option>
          </select>
        </label>
        {scope === 'SERVICE' && (
          <label className="text-xs text-[var(--color-stone)]">Service<br />
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={field}>
              <option value="">Choose…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        {scope === 'VARIANT' && (
          <label className="text-xs text-[var(--color-stone)]">Option<br />
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={`${field} max-w-[16rem]`}>
              <option value="">Choose…</option>
              {allVariants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs text-[var(--color-stone)]">Discount<br />
          <span className="flex items-center gap-1">
            <select value={discType} onChange={(e) => setDiscType(e.target.value as 'percent' | 'amount')} className={field}>
              <option value="percent">% off</option>
              <option value="amount">£ off</option>
            </select>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={discType === 'percent' ? '20' : '15'} className={`${field} w-20`} />
          </span>
        </label>
        <label className="text-xs text-[var(--color-stone)]">Starts<br /><input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">Ends<br /><input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={field} /></label>
        <button onClick={create} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">Add offer</button>
        {msg && <span className="text-sm text-[var(--color-blush)]">{msg}</span>}
      </div>

      {offers.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
          {offers.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-medium">{o.name.replace(/\s*[—–-]+\s*£?\d+%?\s*off\s*$/i, '').trim() || o.name}</span>
                <span className="text-[var(--color-stone-soft)]"> · {o.percentOff ? `${o.percentOff}% off` : `£${((o.amountOffPence ?? 0) / 100)} off`} · {o.scope === 'SERVICE' ? svcName(o.serviceId) : o.scope === 'VARIANT' ? 'one variant' : 'all services'}{o.endAt ? ` · ends ${new Date(o.endAt).toLocaleDateString('en-GB')}` : ''}</span>
                {o.promoted && <span className="ml-2 rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[0.65rem] text-[var(--color-gold)]">promoted</span>}
              </span>
              <span className="flex items-center gap-3">
                <button onClick={() => act({ op: 'updateOffer', id: o.id, promoted: !o.promoted })} className="text-xs text-[var(--color-stone)] hover:underline">{o.promoted ? 'Unpromote' : 'Promote'}</button>
                <button onClick={() => { if (confirm('Remove this offer?')) act({ op: 'removeOffer', id: o.id }); }} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
