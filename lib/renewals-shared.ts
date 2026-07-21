// Client-safe shared bits for compliance & renewals (BLD-587) — the category
// list, status type and the pure status derivation. No server-only imports, so
// both the server lib (lib/renewals.ts) and client UI can use them.

export type RenewalStatus = 'EXPIRED' | 'DUE' | 'SOON' | 'OK';

export const RENEWAL_CATEGORIES = [
  'Insurance', 'Licence', 'Certification', 'Equipment servicing',
  'Waste contract', 'PAT testing', 'EICR', 'Other',
] as const;

const DAY = 86_400_000;

/** Derive a renewal status + whole-days-until from a renewal date. */
export function renewalStatus(renewalAt: Date, now = new Date()): { status: RenewalStatus; days: number } {
  const days = Math.ceil((renewalAt.getTime() - now.getTime()) / DAY);
  const status: RenewalStatus = days < 0 ? 'EXPIRED' : days <= 30 ? 'DUE' : days <= 90 ? 'SOON' : 'OK';
  return { status, days };
}
