'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type ProductData = {
  id: string; name: string; description: string; brand: string; category: string;
  price: string; compareAt: string; cost: string; sku: string; barcode: string;
  images: string[]; status: string; ageRestricted: boolean; trackInventory: boolean; stockQty: number; lowStockThreshold: number;
};

const field = 'mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm';

export function ProductEditor({ data }: { data: ProductData }) {
  const router = useRouter();
  const [f, setF] = useState<ProductData>(data);
  const [img, setImg] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = <K extends keyof ProductData>(k: K, v: ProductData[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'update', id: f.id, name: f.name, description: f.description, brand: f.brand, category: f.category, price: f.price, compareAt: f.compareAt, cost: f.cost, sku: f.sku, barcode: f.barcode, images: f.images, status: f.status, ageRestricted: f.ageRestricted, trackInventory: f.trackInventory, stockQty: f.stockQty, lowStockThreshold: f.lowStockThreshold }),
    });
    setBusy(false); setMsg(res.ok ? 'Saved ✓' : 'Save failed'); router.refresh();
  }
  async function adjust(delta: number) {
    const res = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'adjustStock', id: f.id, delta }) });
    const j = await res.json().catch(() => ({}));
    if (j.ok) set('stockQty', j.stockQty);
  }
  async function remove() { if (!confirm('Delete this product?')) return; await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'remove', id: f.id }) }); router.push('/admin/products'); }
  const addImg = () => { if (img.trim()) { set('images', [...f.images, img.trim()]); setImg(''); } };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/admin/products" className="text-xs text-[var(--color-stone)] hover:underline">← All products</Link><h1 className="font-[family-name:var(--font-display)] text-3xl">{f.name}</h1></div>
        <select value={f.status} onChange={(e) => set('status', e.target.value)} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm"><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Details</h2>
            <label className="block text-xs text-[var(--color-stone)]">Name<input value={f.name} onChange={(e) => set('name', e.target.value)} className={field} /></label>
            <label className="mt-3 block text-xs text-[var(--color-stone)]">Description<textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={4} className={field} /></label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[var(--color-stone)]">Brand<input value={f.brand} onChange={(e) => set('brand', e.target.value)} className={field} /></label>
              <label className="text-xs text-[var(--color-stone)]">Category<input value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Skincare" className={field} /></label>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Pricing</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-[var(--color-stone)]">Price £<input value={f.price} onChange={(e) => set('price', e.target.value)} className={field} /></label>
              <label className="text-xs text-[var(--color-stone)]">Compare-at £<input value={f.compareAt} onChange={(e) => set('compareAt', e.target.value)} className={field} /></label>
              <label className="text-xs text-[var(--color-stone)]">Cost £<input value={f.cost} onChange={(e) => set('cost', e.target.value)} className={field} /></label>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Images</h2>
            <div className="flex flex-wrap gap-2">
              {f.images.map((u, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-20 w-20 rounded border border-[var(--color-line)] object-cover" />
                  <button onClick={() => set('images', f.images.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-white">✕</button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={img} onChange={(e) => setImg(e.target.value)} placeholder="Image URL (upload in Media first)" className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm" />
              <button onClick={addImg} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:border-[var(--color-gold)]">Add</button>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Compliance</h2>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={f.ageRestricted} onChange={(e) => set('ageRestricted', e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--color-gold)]" />
              <span><strong>Age-restricted (18+)</strong><br /><span className="text-xs text-[var(--color-stone)]">Requires an age check at checkout. Leave off for general products.</span></span>
            </label>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Inventory</h2>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.trackInventory} onChange={(e) => set('trackInventory', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" /> Track inventory</label>
            {f.trackInventory && (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => adjust(-1)} className="h-8 w-8 rounded-full border border-[var(--color-line)]">−</button>
                  <span className="min-w-12 text-center font-[family-name:var(--font-display)] text-xl">{f.stockQty}</span>
                  <button onClick={() => adjust(1)} className="h-8 w-8 rounded-full border border-[var(--color-line)]">+</button>
                  <span className="ml-2 text-xs text-[var(--color-stone)]">in stock</span>
                </div>
                <label className="mt-3 block text-xs text-[var(--color-stone)]">Low-stock alert at<input type="number" value={f.lowStockThreshold} onChange={(e) => set('lowStockThreshold', Number(e.target.value))} className={field} /></label>
              </>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[var(--color-stone)]">SKU<input value={f.sku} onChange={(e) => set('sku', e.target.value)} className={field} /></label>
              <label className="text-xs text-[var(--color-stone)]">Barcode<input value={f.barcode} onChange={(e) => set('barcode', e.target.value)} className={field} /></label>
            </div>
          </section>
        </div>
      </div>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]/95 p-3 backdrop-blur">
        <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-6 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save product'}</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
        <button onClick={remove} className="ml-auto text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
    </div>
  );
}
