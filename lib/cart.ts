'use client';

import { useCallback, useEffect, useState } from 'react';

// Lightweight cart held in localStorage. Stores a display snapshot; prices are
// always re-validated server-side at checkout (lib/shop.validateCart).
export type CartItem = { productId: string; slug: string; name: string; image: string | null; pricePence: number; ageRestricted: boolean; qty: number };

const KEY = 'kc_cart_v1';
const read = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
const write = (items: CartItem[]) => { localStorage.setItem(KEY, JSON.stringify(items)); window.dispatchEvent(new Event('kc-cart')); };

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    setItems(read());
    const sync = () => setItems(read());
    window.addEventListener('kc-cart', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('kc-cart', sync); window.removeEventListener('storage', sync); };
  }, []);

  const add = useCallback((item: Omit<CartItem, 'qty'>, qty = 1) => {
    const cur = read();
    const i = cur.findIndex((c) => c.productId === item.productId);
    if (i >= 0) cur[i].qty = Math.min(20, cur[i].qty + qty); else cur.push({ ...item, qty });
    write(cur);
  }, []);
  const setQty = useCallback((productId: string, qty: number) => {
    const cur = read().map((c) => (c.productId === productId ? { ...c, qty: Math.max(1, Math.min(20, qty)) } : c));
    write(cur);
  }, []);
  const remove = useCallback((productId: string) => write(read().filter((c) => c.productId !== productId)), []);
  const clear = useCallback(() => write([]), []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotalPence = items.reduce((s, i) => s + i.pricePence * i.qty, 0);
  return { items, add, setQty, remove, clear, count, subtotalPence };
}
