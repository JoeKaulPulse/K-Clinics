'use client';

import { useMemo, useState } from 'react';

type P = { id: string; name: string; pricePence: number; stockQty: number; trackInventory: boolean; ageRestricted: boolean; image: string | null; category: string | null; barcode: string | null; sku: string | null };
const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export function PosTerminal({ products }: { products: P[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<'shop' | 'pay'>('shop');
  const [pay, setPay] = useState<{ qr?: string; url?: string; orderId?: string } | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => !s || p.name.toLowerCase().includes(s) || (p.category || '').toLowerCase().includes(s) || (p.barcode || '').toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s));
  }, [products, q]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  // BLD-201: scan-to-sell — barcode scanners type the code + Enter (keyboard
  // wedge), so an exact barcode/SKU match (or a single search hit) adds to the cart.
  const byCode = useMemo(() => {
    const m = new Map<string, P>();
    for (const p of products) { if (p.barcode) m.set(p.barcode.trim().toLowerCase(), p); if (p.sku) m.set(p.sku.trim().toLowerCase(), p); }
    return m;
  }, [products]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(id)!, qty })).filter((l) => l.p);
  const total = lines.reduce((s, l) => s + l.p.pricePence * l.qty, 0);
  const needAge = lines.some((l) => l.p.ageRestricted);

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  function onScan(e: { key: string }) {
    if (e.key !== 'Enter') return;
    const code = q.trim().toLowerCase();
    if (!code) return;
    const hit = byCode.get(code) || (filtered.length === 1 ? filtered[0] : null);
    if (hit && !(hit.trackInventory && hit.stockQty <= 0)) { add(hit.id); setQ(''); setStatus(`Added ${hit.name}`); }
    else setStatus('No product matched that scan.');
  }
  const sub = (id: string) => setCart((c) => { const n = (c[id] || 0) - 1; const next = { ...c }; if (n <= 0) delete next[id]; else next[id] = n; return next; });
  const clear = () => { setCart({}); setStage('shop'); setPay(null); setStatus(''); };

  async function checkout(method: 'card' | 'cash' | 'terminal', ageVerified = false) {
    setBusy(true); setStatus('');
    const r = await fetch('/api/admin/pos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'checkout', method, ageVerified, items: lines.map((l) => ({ productId: l.p.id, qty: l.qty })) }),
    }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (!r.ok) { setStatus(r.error || 'Something went wrong.'); return; }
    if (r.paid) { setStatus(`Sale complete — ${r.number} ✓`); setTimeout(clear, 2500); return; }
    setPay({ qr: r.qr, url: r.url, orderId: r.orderId }); setStage('pay');
  }

  async function poll() {
    if (!pay?.orderId) return;
    setBusy(true);
    const r = await fetch('/api/admin/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'status', orderId: pay.orderId }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok && (r.status === 'PAID' || r.status === 'FULFILLED')) { setStatus(`Paid — ${r.number} ✓`); setTimeout(clear, 2500); }
    else setStatus('Not paid yet — ask the customer to complete payment, then check again.');
  }

  if (stage === 'pay' && pay) {
    return (
      <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Scan to pay {money(total)}</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">Ask the customer to scan with their phone camera.</p>
        {pay.qr && <img src={pay.qr} alt="Payment QR" width={240} height={240} className="mx-auto mt-5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-2" />}
        {pay.url && <a href={pay.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-xs text-[var(--color-gold-deep)] underline">Open payment link</a>}
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={poll} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Checking…' : 'I’ve been paid — check'}</button>
          <button onClick={clear} className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm">Cancel sale</button>
        </div>
        {status && <p className="mt-4 text-sm text-[var(--color-stone)]">{status}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Products */}
      <div>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onScan} autoFocus placeholder="Scan a barcode, or search products…" aria-label="Scan barcode or search products" className="mb-4 w-full rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-5 py-3 outline-none focus:border-[var(--color-gold)]" />
        {products.length === 0 ? (
          <p className="text-sm text-[var(--color-stone)]">No active products yet. Add them in Catalogue → Products.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((p) => {
              const out = p.trackInventory && p.stockQty <= 0;
              return (
                <button key={p.id} onClick={() => !out && add(p.id)} disabled={out} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3 text-left transition-shadow hover:shadow-[var(--shadow-soft)] disabled:opacity-40">
                  <div className="font-medium leading-tight">{p.name}</div>
                  <div className="mt-1 text-sm text-[var(--color-gold-deep)]">{money(p.pricePence)}</div>
                  <div className="mt-0.5 text-[0.7rem] text-[var(--color-stone-soft)]">{out ? 'Out of stock' : p.trackInventory ? `${p.stockQty} in stock` : 'In stock'}{p.ageRestricted ? ' · 18+' : ''}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
        <div className="flex items-center justify-between"><h2 className="font-[family-name:var(--font-display)] text-xl">Basket</h2>{lines.length > 0 && <button onClick={clear} className="text-xs text-[var(--color-stone)] hover:underline">Clear</button>}</div>
        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-stone)]">Tap products to add them.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-line)]">
            {lines.map((l) => (
              <li key={l.p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.p.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => sub(l.p.id)} className="h-7 w-7 rounded-full border border-[var(--color-line)]">−</button>
                  <span className="w-5 text-center">{l.qty}</span>
                  <button onClick={() => add(l.p.id)} className="h-7 w-7 rounded-full border border-[var(--color-line)]">+</button>
                  <span className="w-16 text-right font-medium">{money(l.p.pricePence * l.qty)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-[var(--color-line)] pt-4">
          <span className="text-sm uppercase tracking-wide text-[var(--color-stone)]">Total</span>
          <span className="font-[family-name:var(--font-display)] text-2xl">{money(total)}</span>
        </div>
        {needAge && <p className="mt-2 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/20 px-3 py-2 text-xs text-[var(--color-ink)]">Includes an 18+ product — confirm the customer’s age before completing.</p>}
        <div className="mt-4 grid gap-2">
          <button onClick={() => checkout('card', needAge)} disabled={busy || lines.length === 0} className="rounded-full bg-[var(--color-gold-deep)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">Card — scan to pay</button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => checkout('terminal', needAge)} disabled={busy || lines.length === 0} className="rounded-full border border-[var(--color-line)] px-4 py-2.5 text-sm disabled:opacity-50">Card machine</button>
            <button onClick={() => checkout('cash', needAge)} disabled={busy || lines.length === 0} className="rounded-full border border-[var(--color-line)] px-4 py-2.5 text-sm disabled:opacity-50">Cash</button>
          </div>
        </div>
        {status && <p className="mt-3 text-sm text-[var(--color-stone)]">{status}</p>}
      </div>
    </div>
  );
}
