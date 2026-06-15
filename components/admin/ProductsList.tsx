'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type ProductRow = { id: string; name: string; image: string | null; pricePence: number; status: string; ageRestricted: boolean; stockQty: number; stock: 'in' | 'low' | 'out' | 'untracked' };

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const STATUS: Record<string, string> = { DRAFT: 'bg-[var(--color-bone)] text-[var(--color-stone)]', ACTIVE: 'bg-green-100 text-green-800', ARCHIVED: 'bg-[var(--color-bone)] text-[var(--color-stone-soft)]' };
const STOCK: Record<string, string> = { in: 'text-[var(--color-jade)]', low: 'text-amber-700', out: 'text-[var(--color-blush)]', untracked: 'text-[var(--color-stone-soft)]' };

export function ProductsList({ rows }: { rows: ProductRow[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftMsg, setGiftMsg] = useState('');

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'create', name }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok && j.id) router.push(`/admin/products/${j.id}`); else router.refresh();
  }

  async function generateGiftPackages() {
    setGiftBusy(true); setGiftMsg('');
    const j = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'giftPackages' }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setGiftBusy(false);
    if (j.ok) { setGiftMsg(j.created ? `Created ${j.created} draft${j.created === 1 ? '' : 's'} — review & publish below.` : 'All giftable package drafts already exist.'); router.refresh(); }
    else setGiftMsg('Could not generate — please retry.');
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">New product</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-[var(--color-stone)]">Name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vitamin C Serum" className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm w-64" /></label>
          <button onClick={create} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Creating…' : 'Create & edit'}</button>
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">🎁 Gifts</h2>
        <p className="mb-3 max-w-2xl text-sm text-[var(--color-stone)]">
          Gift cards and giftable packages live here. Generate your curated treatment packages as <strong>draft</strong> gift products — nothing goes live until you set a gift price and publish each one.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={generateGiftPackages} disabled={giftBusy} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bone)] disabled:opacity-50">{giftBusy ? 'Generating…' : 'Generate giftable package drafts'}</button>
          {giftMsg && <span className="text-sm text-[var(--color-stone)]">{giftMsg}</span>}
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-sm text-[var(--color-stone)]">No products yet.</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full text-sm">
            <thead><tr className="bg-[var(--color-bone)] text-left text-xs uppercase tracking-wide text-[var(--color-stone-soft)]"><th scope="col" className="p-3">Product</th><th scope="col" className="p-3">Price</th><th scope="col" className="p-3">Stock</th><th scope="col" className="p-3">Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-line)] hover:bg-[var(--color-bone)]/50">
                  <td className="p-3">
                    <Link href={`/admin/products/${r.id}`} className="flex items-center gap-3">
                      {r.image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={r.image} alt="" className="h-10 w-10 rounded object-cover" />
                        : <span className="grid h-10 w-10 place-items-center rounded bg-[var(--color-bone)] text-[var(--color-stone-soft)]">▦</span>}
                      <span className="font-medium hover:text-[var(--color-gold)]">{r.name}{r.ageRestricted && <span className="ml-2 rounded-full bg-[var(--color-ink)] px-1.5 py-0.5 text-[0.6rem] text-[var(--color-porcelain)]">18+</span>}</span>
                    </Link>
                  </td>
                  <td className="p-3">{money(r.pricePence)}</td>
                  <td className={`p-3 ${STOCK[r.stock]}`}>{r.stock === 'untracked' ? '—' : `${r.stockQty} ${r.stock === 'low' ? '(low)' : r.stock === 'out' ? '(out)' : ''}`}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${STATUS[r.status]}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
