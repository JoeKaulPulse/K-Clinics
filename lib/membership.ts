import 'server-only';
import { db } from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────
// K Circle membership. Status tiers earned from a client's rolling 12-month
// realised spend. Higher tiers earn loyalty points faster and unlock perks —
// margin-safe (no blanket discounts by default). Thresholds/benefits are
// owner-editable (MembershipTier rows); we seed sensible defaults on first use.
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = {
  key: string; name: string; minSpendPence: number; pointsMultiplierBps: number;
  birthdayBonusPoints: number; earlyAccessHours: number; retailDiscountPct: number;
  perks: string[]; color: string | null; sortOrder: number;
};

// Defaults — Silver £500 / Gold £1,500 / Platinum £4,000, accelerating earn.
export const DEFAULT_TIERS: Omit<Tier, never>[] = [
  { key: 'member', name: 'Member', minSpendPence: 0, pointsMultiplierBps: 100, birthdayBonusPoints: 250, earlyAccessHours: 0, retailDiscountPct: 0, color: '#9a8c7e', sortOrder: 0,
    perks: ['Earn 1 point per £1 spent', 'Birthday treat', 'Members-only offers by email'] },
  { key: 'silver', name: 'Silver', minSpendPence: 50000, pointsMultiplierBps: 125, birthdayBonusPoints: 500, earlyAccessHours: 24, retailDiscountPct: 0, color: '#9fb0bd', sortOrder: 1,
    perks: ['Earn points 25% faster (1.25×)', '24-hour early access to new slots & offers', 'Enhanced birthday bonus'] },
  { key: 'gold', name: 'Gold', minSpendPence: 150000, pointsMultiplierBps: 150, birthdayBonusPoints: 1000, earlyAccessHours: 48, retailDiscountPct: 0, color: '#c9a86a', sortOrder: 2,
    perks: ['Earn points 50% faster (1.5×)', '48-hour early access', 'A complimentary skin analysis each year', 'Priority rebooking'] },
  { key: 'platinum', name: 'Platinum', minSpendPence: 400000, pointsMultiplierBps: 200, birthdayBonusPoints: 2000, earlyAccessHours: 72, retailDiscountPct: 0, color: '#6b5b73', sortOrder: 3,
    perks: ['Earn points 2× on every visit', 'First access to launches & events', 'An anniversary reward', 'Dedicated concierge booking'] },
];

let cache: { tiers: Tier[]; at: number } | null = null;
const CACHE_MS = 60_000;

/** Active tiers, low→high. Seeds the defaults the first time if none exist. */
export async function getTiers(): Promise<Tier[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.tiers;
  let rows = await db.membershipTier.findMany({ where: { active: true }, orderBy: { minSpendPence: 'asc' } });
  if (rows.length === 0) {
    await db.membershipTier.createMany({ data: DEFAULT_TIERS, skipDuplicates: true }).catch(() => {});
    rows = await db.membershipTier.findMany({ where: { active: true }, orderBy: { minSpendPence: 'asc' } });
  }
  const tiers = rows.map((r) => ({
    key: r.key, name: r.name, minSpendPence: r.minSpendPence, pointsMultiplierBps: r.pointsMultiplierBps,
    birthdayBonusPoints: r.birthdayBonusPoints, earlyAccessHours: r.earlyAccessHours, retailDiscountPct: r.retailDiscountPct,
    perks: r.perks, color: r.color, sortOrder: r.sortOrder,
  }));
  cache = { tiers, at: Date.now() };
  return tiers.length ? tiers : DEFAULT_TIERS.map((t) => ({ ...t }));
}

export function clearTierCache() { cache = null; }

/** Highest tier a given rolling-spend qualifies for. */
export function tierForSpend(tiers: Tier[], pence: number): Tier {
  let current = tiers[0];
  for (const t of tiers) if (pence >= t.minSpendPence) current = t;
  return current ?? DEFAULT_TIERS[0] as Tier;
}

/** The next tier up (for "£X to go" progress), or null at the top. */
export function nextTier(tiers: Tier[], pence: number): Tier | null {
  return tiers.find((t) => t.minSpendPence > pence) ?? null;
}

/** Realised spend over the trailing 12 months: amounts actually charged for
 *  this client's treatments plus any paid retail orders linked to them. */
export async function rolling12moSpendPence(clientId: string): Promise<number> {
  const since = new Date(Date.now() - 365 * 86400000);
  const bookings = await db.booking.aggregate({ _sum: { chargedPence: true }, where: { clientId, chargedAt: { gte: since } } });
  let total = bookings._sum.chargedPence ?? 0;
  try {
    const orders = await db.order.aggregate({ _sum: { totalPence: true }, where: { clientId, status: { in: ['PAID', 'FULFILLED'] }, createdAt: { gte: since } } });
    total += orders._sum.totalPence ?? 0;
  } catch { /* orders may not link a client — treatment spend still counts */ }
  return total;
}

export type MembershipStatus = {
  tier: Tier; spendPence: number; next: Tier | null; toNextPence: number;
  progressPct: number; multiplierBps: number;
};

/** Compute (and cache on the Client) a client's current tier from rolling spend.
 *  Sends a one-off congratulations email when the client moves UP a tier. */
export async function recomputeClientTier(clientId: string): Promise<MembershipStatus | null> {
  const tiers = await getTiers();
  const spend = await rolling12moSpendPence(clientId);
  const tier = tierForSpend(tiers, spend);
  const next = nextTier(tiers, spend);

  const prev = await db.client.findUnique({ where: { id: clientId }, select: { membershipTier: true, email: true, firstName: true } });
  const rank = (key: string | null | undefined) => Math.max(0, tiers.findIndex((t) => t.key === (key ?? 'member')));

  await db.client.update({
    where: { id: clientId },
    data: { membershipTier: tier.key === 'member' ? null : tier.key, membership12moPence: spend, membershipUpdatedAt: new Date() },
  }).catch(() => {});

  // Upgrade celebration (compared against the previously-cached tier → idempotent).
  if (prev && tier.key !== 'member' && rank(tier.key) > rank(prev.membershipTier)) {
    try { await sendTierUpgradeEmail({ email: prev.email, firstName: prev.firstName, clientId }, tier); } catch (e) { console.error('[membership] upgrade email failed:', (e as Error)?.message); }
  }
  return buildStatus(tier, next, spend, tiers);
}

async function sendTierUpgradeEmail(client: { email: string; firstName: string | null; clientId: string }, tier: Tier) {
  if (!client.email) return;
  const { sendEmail, emailShell } = await import('@/lib/email');
  const { site } = await import('@/lib/site');
  const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
  const accent = tier.color || '#a98a6d';
  const perks = tier.perks.map((p) => `<li style="margin:0 0 6px;">${p}</li>`).join('');
  const body = `
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:${accent};margin:0 0 8px;">K Circle membership</p>
    <h1 style="margin:0 0 12px;font-size:26px;">Congratulations, you’ve reached ${tier.name}</h1>
    <p style="margin:0 0 14px;">Hi ${client.firstName || 'there'}, thank you for being one of our valued clients — you’ve been upgraded to <strong>${tier.name}</strong>. Here’s what you now enjoy:</p>
    <ul style="margin:0 0 18px;padding-left:20px;font-size:15px;line-height:1.6;">${perks}</ul>
    <p style="margin:6px 0 18px;"><a href="${base}/book" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;">Book your next visit</a></p>
    <p style="margin:0;font-size:13px;color:#8a7d72;">See your status any time in your <a href="${base}/account/rewards" style="color:${accent};">rewards</a>.</p>`;
  const res = await sendEmail({ to: client.email, subject: `You’ve reached ${tier.name} — welcome to the next level of K Circle`, html: emailShell({ body, preheader: `Your K Circle membership has been upgraded to ${tier.name}.` }) });
  await db.emailEvent.create({ data: { clientId: client.clientId, kind: 'MEMBERSHIP', to: client.email, subject: `K Circle: upgraded to ${tier.name}`, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } }).catch(() => {});
}

function buildStatus(tier: Tier, next: Tier | null, spend: number, tiers: Tier[]): MembershipStatus {
  const floor = tier.minSpendPence;
  const ceil = next?.minSpendPence ?? floor;
  const progressPct = next ? Math.min(100, Math.round(((spend - floor) / Math.max(1, ceil - floor)) * 100)) : 100;
  return { tier, spendPence: spend, next, toNextPence: next ? Math.max(0, ceil - spend) : 0, progressPct, multiplierBps: tier.pointsMultiplierBps };
}

/** Read a client's status from the cached fields (fast path for portal/email). */
export async function clientMembership(clientId: string): Promise<MembershipStatus> {
  const tiers = await getTiers();
  const c = await db.client.findUnique({ where: { id: clientId }, select: { membershipTier: true, membership12moPence: true } });
  const spend = c?.membership12moPence ?? 0;
  const tier = tiers.find((t) => t.key === c?.membershipTier) ?? tierForSpend(tiers, spend);
  return buildStatus(tier, nextTier(tiers, spend), spend, tiers);
}

/** Points multiplier (bps) for a client's current tier — applied when earning. */
export async function earnMultiplierBps(clientId: string): Promise<number> {
  const tiers = await getTiers();
  const c = await db.client.findUnique({ where: { id: clientId }, select: { membershipTier: true } });
  const tier = tiers.find((t) => t.key === c?.membershipTier) ?? tiers[0];
  return tier?.pointsMultiplierBps ?? 100;
}

/** Nightly maintenance: recompute tiers for clients with recent activity so
 *  they move up — and lapse down — as their rolling spend changes. */
export async function recomputeActiveTiers(withinDays = 400, limit = 5000): Promise<number> {
  const since = new Date(Date.now() - withinDays * 86400000);
  const clients = await db.client.findMany({ where: { bookings: { some: { chargedAt: { gte: since } } } }, select: { id: true }, take: limit });
  let n = 0;
  for (const c of clients) { try { await recomputeClientTier(c.id); n++; } catch { /* skip */ } }
  return n;
}
