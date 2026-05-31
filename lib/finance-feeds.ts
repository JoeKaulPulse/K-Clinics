import 'server-only';

// Live financial feeds for the cashflow forecast.
//
// • Stripe — your own account balance via the secret key (no OAuth needed).
// • Bank (Open Banking) & Xero — require OAuth; they light up once a provider's
//   credentials + a stored connection token are present. Until then they report
//   `connected: false` and contribute nothing (safe no-op).
//
// Everything is fault-tolerant: a feed failing never breaks the forecast page.

export type LiveBalance = {
  source: 'stripe' | 'bank' | 'xero';
  label: string;
  connected: boolean;
  availablePence: number;
  pendingPence: number;
  currency: string;
  detail?: string;
};

/** Stripe account balance (GBP) via the secret key. */
export async function getStripeBalance(): Promise<LiveBalance> {
  const key = process.env.STRIPE_SECRET_KEY;
  const base: LiveBalance = { source: 'stripe', label: 'Stripe', connected: false, availablePence: 0, pendingPence: 0, currency: 'GBP' };
  if (!key) return { ...base, detail: 'Add STRIPE_SECRET_KEY to enable.' };
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
      // Never cache a balance.
      cache: 'no-store',
    });
    if (!res.ok) return { ...base, detail: `Stripe error ${res.status}` };
    const data = (await res.json()) as { available?: { amount: number; currency: string }[]; pending?: { amount: number; currency: string }[] };
    const sum = (arr?: { amount: number; currency: string }[]) => (arr || []).filter((x) => x.currency === 'gbp').reduce((s, x) => s + x.amount, 0);
    return { ...base, connected: true, availablePence: sum(data.available), pendingPence: sum(data.pending) };
  } catch {
    return { ...base, detail: 'Could not reach Stripe.' };
  }
}

/** Open Banking bank balance via TrueLayer (live once OAuth-connected). */
export async function getBankBalance(): Promise<LiveBalance> {
  const base: LiveBalance = { source: 'bank', label: 'Business bank', connected: false, availablePence: 0, pendingPence: 0, currency: 'GBP' };
  const { trueLayerConfigured, getBankCashPence } = await import('@/lib/truelayer');
  if (!trueLayerConfigured()) return { ...base, detail: 'Add TrueLayer credentials to enable.' };
  const { isConnected } = await import('@/lib/oauth-connections');
  if (!(await isConnected('truelayer'))) return { ...base, detail: 'Configured — connect your bank in Integrations.' };
  const r = await getBankCashPence();
  if (!r.ok) return { ...base, detail: 'Connected — balance temporarily unavailable.', label: r.label || base.label };
  return { ...base, label: r.label || base.label, connected: true, availablePence: r.availablePence, pendingPence: r.pendingPence };
}

/** Xero cash position (live once OAuth-connected). */
export async function getXeroBalance(): Promise<LiveBalance> {
  const base: LiveBalance = { source: 'xero', label: 'Xero', connected: false, availablePence: 0, pendingPence: 0, currency: 'GBP' };
  const { xeroConfigured, getXeroCashPence } = await import('@/lib/xero');
  if (!xeroConfigured()) return { ...base, detail: 'Add Xero credentials to enable.' };
  const { isConnected } = await import('@/lib/oauth-connections');
  if (!(await isConnected('xero'))) return { ...base, detail: 'Configured — connect Xero in Integrations.' };
  const r = await getXeroCashPence();
  if (!r.ok) return { ...base, detail: 'Connected — balance temporarily unavailable.', label: r.label || base.label };
  return { ...base, label: r.label || base.label, connected: true, availablePence: r.pence };
}

export async function liveBalances(): Promise<LiveBalance[]> {
  const [stripe, bank, xero] = await Promise.all([getStripeBalance(), getBankBalance(), getXeroBalance()]);
  return [stripe, bank, xero];
}
