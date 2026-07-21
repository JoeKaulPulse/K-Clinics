'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart, type CartItem } from '@/lib/cart';
import { Button, ArrowIcon } from '@/components/ui/Button';

export function AddToCart({ product, outOfStock }: { product: Omit<CartItem, 'qty'>; outOfStock: boolean }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (outOfStock) return <p className="rounded-full bg-[var(--color-bone)] px-5 py-3 text-sm text-[var(--color-stone)]">Out of stock</p>;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-full border border-[var(--color-line)]">
        <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-10 w-10 text-lg">−</button>
        <span className="w-8 text-center">{qty}</span>
        <button onClick={() => setQty((q) => Math.min(20, q + 1))} className="h-10 w-10 text-lg">+</button>
      </div>
      <Button onClick={() => { add(product, qty); setAdded(true); }} variant="gold" size="lg">Add to bag</Button>
      {added && <Link href="/shop/cart" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-gold-deep)] hover:underline">View bag <ArrowIcon /></Link>}
    </div>
  );
}
