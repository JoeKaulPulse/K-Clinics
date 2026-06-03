import 'server-only';

export const slugifyProduct = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export type StockState = 'in' | 'low' | 'out' | 'untracked';
export function stockState(p: { trackInventory: boolean; stockQty: number; lowStockThreshold: number }): StockState {
  if (!p.trackInventory) return 'untracked';
  if (p.stockQty <= 0) return 'out';
  if (p.stockQty <= p.lowStockThreshold) return 'low';
  return 'in';
}

export const productMargin = (pricePence: number, costPence: number | null): number | null =>
  costPence != null && pricePence > 0 ? Math.round(((pricePence - costPence) / pricePence) * 100) : null;
