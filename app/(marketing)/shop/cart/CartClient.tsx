'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { Button, ArrowIcon } from '@/components/ui/Button';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export function CartClient({ vatNote }: { vatNote: string }) {
  const { items, setQty, remove, subtotalPence } = useCart();

  return (
    <section className="container-lux section pt-[calc(var(--header-h,5.25rem)+2rem)]">
      <h1 className="text-title">Your bag</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-[var(--color-stone)]">Your bag is empty. <Link href="/shop" className="text-[var(--color-gold)] underline">Browse the shop →</Link></p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            {items.map((i) => (
              <li key={i.productId} className="flex items-center gap-4 bg-[var(--color-porcelain)] p-4">
                {i.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={i.image} alt="" className="h-16 w-16 rounded object-cover" />
                  : <span className="grid h-16 w-16 place-items-center rounded bg-[var(--color-bone)] text-[var(--color-stone)]">▦</span>}
                <div className="min-w-0 flex-1">
                  <Link href={`/shop/${i.slug}`} className="font-[family-name:var(--font-display)] hover:text-[var(--color-gold)]">{i.name}{i.ageRestricted && <span className="ml-2 rounded-full bg-[var(--color-ink)] px-1.5 py-0.5 text-[0.6rem] text-[var(--color-porcelain)]">18+</span>}</Link>
                  <p className="text-sm text-[var(--color-stone)]">{money(i.pricePence)}</p>
                </div>
                <div className="flex items-center rounded-full border border-[var(--color-line)] text-sm">
                  <button onClick={() => setQty(i.productId, i.qty - 1)} aria-label={`Decrease quantity of ${i.name}`} className="h-11 w-11">−</button>
                  <span className="w-7 text-center" aria-live="polite" aria-label={`${i.name} quantity`}>{i.qty}</span>
                  <button onClick={() => setQty(i.productId, i.qty + 1)} aria-label={`Increase quantity of ${i.name}`} className="h-11 w-11">+</button>
                </div>
                <button onClick={() => remove(i.productId)} aria-label={`Remove ${i.name} from bag`} className="text-xs text-[var(--color-blush)] hover:underline">Remove</button>
              </li>
            ))}
          </ul>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
            <div className="flex items-center justify-between text-sm"><span className="text-[var(--color-stone)]">Subtotal</span><span className="font-medium">{money(subtotalPence)}</span></div>
            <p className="mt-1 text-xs text-[var(--color-stone)]">Shipping &amp; any gift card applied at checkout.</p>
            {vatNote && <p className="mt-0.5 text-xs text-[var(--color-stone)]">{vatNote}</p>}
            <Link href="/shop/checkout" className="mt-5 block"><Button variant="gold" size="lg" className="w-full">Checkout <ArrowIcon /></Button></Link>
            <Link href="/shop" className="mt-3 block text-center text-sm text-[var(--color-stone)] hover:underline">Continue shopping</Link>
          </div>
        </div>
      )}
    </section>
  );
}
