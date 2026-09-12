// VAT classes and their rates — the pure half of the VAT engine (lib/vat.ts).
//
// lib/vat.ts is 'server-only' because it reads settings from the database. The
// class list and the class → rate mapping are plain data, and the pricing
// planner (components/admin/PricingPlanner.tsx) needs them in the browser to
// recalculate a price as you type. They live here so both sides can import
// them; lib/vat.ts re-exports them so existing server imports are unchanged.

export type VatClass = 'STANDARD' | 'REDUCED' | 'ZERO' | 'EXEMPT';

export const VAT_CLASSES: { id: VatClass; label: string }[] = [
  { id: 'STANDARD', label: 'Standard (20%)' },
  { id: 'REDUCED', label: 'Reduced (5%)' },
  { id: 'ZERO', label: 'Zero-rated (0%)' },
  { id: 'EXEMPT', label: 'Exempt (e.g. dentistry)' },
];

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
