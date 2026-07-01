import 'server-only';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/audit';

// IP & device activity tracking + blocking (security audit).
//
// We surface "who is hitting the site, from where, on what device" by
// aggregating the append-only SecurityEvent log (login attempts, lockouts,
// rate-limits, 2FA events) per source IP, and let staff block a suspicious IP.
//
// On "MAC address": a device's MAC address is a link-layer identifier that
// never leaves the local network — it is replaced at the first router hop and
// is physically unobtainable by any website. The closest a server can get to a
// per-device signal is the User-Agent string (the browser/OS fingerprint),
// which we already capture on every SecurityEvent and show in the Device
// column. We are explicit about this rather than pretending to log a MAC.

export type IpRow = {
  ip: string;
  events: number;
  fails: number;
  lastSeen: Date;
  portals: string[];
  devices: string[]; // distinct User-Agent strings seen from this IP
  identifiers: string[]; // distinct emails attempted from this IP
  types: Record<string, number>;
  blocked: boolean;
  blockReason: string | null;
};

const FAIL_TYPES = new Set(['LOGIN_FAIL', 'LOCKOUT', 'RATE_LIMITED', 'CAPTCHA_FAIL', 'TWOFA_FAIL']);

/** Aggregate the security log by source IP for the activity table. Newest-active
 *  IPs first; bounded so the admin page stays fast even on a noisy log. */
export async function ipActivity(opts: { sinceDays?: number; take?: number } = {}): Promise<IpRow[]> {
  const since = new Date(Date.now() - (opts.sinceDays ?? 7) * 24 * 3600 * 1000);
  const take = Math.min(Math.max(opts.take ?? 60, 1), 200);

  // Top IPs by event volume in the window.
  const groups = await db.securityEvent
    .groupBy({
      by: ['ip'],
      where: { ip: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _count: { ip: 'desc' } },
      take,
    })
    .catch(() => [] as { ip: string | null; _count: { _all: number }; _max: { createdAt: Date | null } }[]);

  const ips = groups.map((g) => g.ip).filter((v): v is string => Boolean(v));
  if (!ips.length) return [];

  // One pass over the raw events for those IPs to derive the per-IP breakdown
  // (device/identifier/type). Bounded by take*40 so a flood can't blow memory.
  const raw = await db.securityEvent
    .findMany({
      where: { ip: { in: ips }, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: take * 40,
      select: { ip: true, type: true, portal: true, userAgent: true, identifier: true },
    })
    .catch(() => [] as { ip: string | null; type: string; portal: string; userAgent: string | null; identifier: string | null }[]);

  const detail = new Map<string, { portals: Set<string>; devices: Set<string>; identifiers: Set<string>; types: Record<string, number>; fails: number }>();
  for (const e of raw) {
    if (!e.ip) continue;
    let d = detail.get(e.ip);
    if (!d) { d = { portals: new Set(), devices: new Set(), identifiers: new Set(), types: {}, fails: 0 }; detail.set(e.ip, d); }
    if (e.portal) d.portals.add(e.portal);
    if (e.userAgent) d.devices.add(e.userAgent);
    if (e.identifier) d.identifiers.add(e.identifier);
    d.types[e.type] = (d.types[e.type] ?? 0) + 1;
    if (FAIL_TYPES.has(e.type)) d.fails++;
  }

  const blocked = await blockedIpDetails(ips);

  return groups
    .filter((g) => g.ip)
    .map((g) => {
      const ip = g.ip as string;
      const d = detail.get(ip);
      const b = blocked.get(ip);
      return {
        ip,
        events: g._count._all,
        fails: d?.fails ?? 0,
        lastSeen: g._max.createdAt ?? since,
        portals: d ? [...d.portals] : [],
        devices: d ? [...d.devices].slice(0, 6) : [],
        identifiers: d ? [...d.identifiers].slice(0, 12) : [],
        types: d?.types ?? {},
        blocked: Boolean(b),
        blockReason: b ?? null,
      };
    });
}

/** Active block reason keyed by IP, for a given candidate set. */
async function blockedIpDetails(ips: string[]): Promise<Map<string, string | null>> {
  const rows = await db.blockedIp.findMany({ where: { active: true, ip: { in: ips } }, select: { ip: true, reason: true } }).catch(() => []);
  return new Map(rows.map((r) => [r.ip, r.reason]));
}

export type BlockedRow = { id: string; ip: string; reason: string | null; createdBy: string | null; createdAt: Date };

export async function listBlockedIps(): Promise<BlockedRow[]> {
  return db.blockedIp
    .findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, select: { id: true, ip: true, reason: true, createdBy: true, createdAt: true } })
    .catch(() => []);
}

/** Block an IP. Structural dedupe: reuse the open row if one exists (refresh its
 *  reason), otherwise create one. Audited. Returns false for an invalid IP. */
export async function blockIp(ip: string, reason: string | null, by: string): Promise<boolean> {
  const clean = (ip || '').trim();
  if (!clean || clean === 'unknown' || clean.length > 64) return false;
  const existing = await db.blockedIp.findFirst({ where: { ip: clean, active: true }, select: { id: true } }).catch(() => null);
  if (existing) {
    await db.blockedIp.update({ where: { id: existing.id }, data: { reason: reason?.slice(0, 300) || null, createdBy: by } }).catch(() => {});
  } else {
    await db.blockedIp.create({ data: { ip: clean, reason: reason?.slice(0, 300) || null, active: true, createdBy: by } }).catch(() => {});
  }
  invalidateBlockCache();
  await logAudit({ action: 'SETTINGS_UPDATED', actor: by, summary: `Blocked IP ${clean}${reason ? ` — ${reason}` : ''}` }).catch(() => {});
  return true;
}

/** Lift the block on an IP (deactivates every open row for it). Audited. */
export async function unblockIp(ip: string, by: string): Promise<boolean> {
  const clean = (ip || '').trim();
  if (!clean) return false;
  const res = await db.blockedIp.updateMany({ where: { ip: clean, active: true }, data: { active: false } }).catch(() => ({ count: 0 }));
  invalidateBlockCache();
  if (res.count > 0) await logAudit({ action: 'SETTINGS_UPDATED', actor: by, summary: `Unblocked IP ${clean}` }).catch(() => {});
  return res.count > 0;
}

// ── Cached deny-list (enforcement hot path) ──────────────────────────────────
// Read on every gated request, so cache the active set in module memory for a
// short TTL rather than hitting Postgres each time. Writes invalidate it, and
// the TTL bounds staleness across serverless instances that didn't see the write.
let _cache: { set: Set<string>; at: number } | null = null;
const BLOCK_TTL_MS = 30_000;

export function invalidateBlockCache() { _cache = null; }

export async function blockedIpSet(): Promise<Set<string>> {
  if (_cache && Date.now() - _cache.at < BLOCK_TTL_MS) return _cache.set;
  const rows = await db.blockedIp.findMany({ where: { active: true }, select: { ip: true } }).catch(() => [] as { ip: string }[]);
  _cache = { set: new Set(rows.map((r) => r.ip)), at: Date.now() };
  return _cache.set;
}

/** Is this IP on the active deny-list? Cheap (cached). Never blocks 'unknown'. */
export async function isIpBlocked(ip: string | null | undefined): Promise<boolean> {
  if (!ip || ip === 'unknown') return false;
  return (await blockedIpSet()).has(ip);
}
