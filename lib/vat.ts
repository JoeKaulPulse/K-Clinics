import 'server-only';
import { getSetting, getConfigNumber } from '@/lib/settings';

// VAT engine. The clinic isn't VAT-registered yet, so by default `registered`
// is off and nothing adds/derives VAT (everything is "No VAT"). Once registered,
// prices are treated as VAT-INCLUSIVE by default; each service carries a VAT
// class (dentistry is EXEMPT by default, everything else STANDARD 20%).

export type VatClass = 'STANDARD' | 'REDUCED' | 'ZERO' | 'EXEMPT';
export const VAT_CLASSES: { id: VatClass; label: string }[] = [
  { id: 'STANDARD', label: 'Standard (20%)' },
  { id: 'REDUCED', label: 'Reduced (5%)' },
  { id: 'ZERO', label: 'Zero-rated (0%)' },
  { id: 'EXEMPT', label: 'Exempt (e.g. dentistry)' },
];

export type VatConfig = { registered: boolean; inclusive: boolean; defaultRatePct: number };

export async function getVatConfig(): Promise<VatConfig> {
  const [registered, inclusive, defaultRatePct] = await Promise.all([
    getSetting('vat_registered'),
    getSetting('prices_vat_inclusive'),
    getConfigNumber('vat_default_rate_pct'),
  ]);
  return { registered, inclusive, defaultRatePct };
}

/** A service's effective VAT class — explicit if set, else derived from its
 *  category (dentistry → EXEMPT, otherwise STANDARD). */
export function effectiveVatClass(service: { vatClass?: string | null; category?: string | null }): VatClass {
  if (service.vatClass && ['STANDARD', 'REDUCED', 'ZERO', 'EXEMPT'].includes(service.vatClass)) return service.vatClass as VatClass;
  return service.category === 'dentistry' ? 'EXEMPT' : 'STANDARD';
}

/** The VAT rate (%) for a class. STANDARD uses the configurable default (20%). */
export function ratePctForClass(cls: VatClass, defaultRatePct: number): number {
  switch (cls) {
    case 'STANDARD': return defaultRatePct;
    case 'REDUCED': return 5;
    case 'ZERO':
    case 'EXEMPT':
    default: return 0;
  }
}

export type VatBreakdown = { netPence: number; vatPence: number; grossPence: number; ratePct: number; applied: boolean; exempt: boolean };

/** Split an amount into net/VAT/gross. When not registered (or exempt/zero), VAT
 *  is 0 and gross == net == the amount. `inclusive` means the amount already
 *  contains VAT. */
/** Page-level note to display when the clinic is VAT-registered. Empty string when
 *  not registered (the current default) so callers can gate on truthiness. */
export async function getVatNote(): Promise<string> {
  try {
    const config = await getVatConfig();
    if (!config.registered) return '';
    // PRJ-939.1: prices are always inclusive now — the exclusive wording would
    // contradict what is actually charged.
    return 'All prices include VAT.';
  } catch {
    return '';
  }
}

export function vatBreakdown(amountPence: number, cfg: VatConfig, cls: VatClass): VatBreakdown {
  const exempt = cls === 'EXEMPT' || cls === 'ZERO';
  const ratePct = cfg.registered && !exempt ? ratePctForClass(cls, cfg.defaultRatePct) : 0;
  if (ratePct <= 0) return { netPence: amountPence, vatPence: 0, grossPence: amountPence, ratePct: 0, applied: false, exempt: cfg.registered && exempt };
  // PRJ-939.1/BLD-847 (owner decision, 20 Jul): amounts are ALWAYS treated as
  // VAT-inclusive. The old exclusive branch added VAT on top of the amount for
  // reporting while every charge path charged the listed amount — so the books
  // recorded VAT that was never collected. Customers pay exactly the listed
  // price; the VAT portion is extracted from within it. cfg.inclusive is
  // retained on the type for compatibility but no longer branches.
  const net = Math.round(amountPence / (1 + ratePct / 100));
  return { netPence: net, vatPence: amountPence - net, grossPence: amountPence, ratePct, applied: true, exempt: false };
}
