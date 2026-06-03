'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart';

export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/shop/cart" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2 text-sm hover:border-[var(--color-gold)]">
      <span aria-hidden>🛍</span> Bag{count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-ink)] px-1 text-[0.65rem] text-[var(--color-porcelain)]">{count}</span>}
    </Link>
  );
}
