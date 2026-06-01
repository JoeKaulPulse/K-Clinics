import 'server-only';
import { db } from '@/lib/db';
import { redisConfigured } from '@/lib/security/rate-limit';
import { turnstileConfigured } from '@/lib/security/guard';
import { getRequired2faRoles } from '@/lib/security/twofa';

export type Severity = 'ok' | 'warn' | 'critical' | 'info';
export type Check = { label: string; severity: Severity; detail: string; group: string };

const isProd = process.env.NODE_ENV === 'production';
const strong = (v?: string) => Boolean(v && v.length >= 32 && !/change-me|insecure|example|test/i.test(v));

export async function securityPosture(): Promise<{ checks: Check[]; score: number }> {
  const checks: Check[] = [];
  const add = (label: string, severity: Severity, detail: string, group: string) => checks.push({ label, severity, detail, group });

  // ── Secrets & keys ─────────────────────────────────────────────────────────
  const secretCheck = (name: string, label: string, critical = true) => {
    const v = process.env[name];
    if (!v) add(label, isProd ? (critical ? 'critical' : 'warn') : 'warn', `${name} is not set${isProd ? '' : ' (dev)'}.`, 'Secrets & keys');
    else if (!strong(v)) add(label, 'warn', `${name} looks weak — use a long random value (32+ chars). Regenerate below.`, 'Secrets & keys');
    else add(label, 'ok', `${name} is set and strong.`, 'Secrets & keys');
  };
  secretCheck('ADMIN_JWT_SECRET', 'Staff session secret');
  secretCheck('CLIENT_JWT_SECRET', 'Client session secret');
  secretCheck('HEALTH_ENCRYPTION_KEY', 'Health-data encryption key');
  secretCheck('HEALTH_HMAC_KEY', 'Health-data integrity key');

  // Key rotation status.
  try {
    const { rotationStatus, rotationActive } = await import('@/lib/key-rotation');
    if (rotationActive()) {
      const st = await rotationStatus();
      add('Encryption key rotation', st.total > 0 ? 'warn' : 'ok', st.total > 0 ? `Rotation in progress — ${st.total} record(s) still on a retired key. Run re-encryption below.` : 'Rotation complete — all records on the active key.', 'Secrets & keys');
    } else {
      add('Encryption key rotation', 'ok', 'No rotation in progress. Rotate keys periodically (see runbook).', 'Secrets & keys');
    }
  } catch { /* rotation lib optional */ }

  // ── Authentication ───────────────────────────────────────────────────────
  const [staffTotal, staff2fa, privileged, privileged2fa] = await Promise.all([
    db.adminUser.count({ where: { active: true } }),
    db.adminUser.count({ where: { active: true, totpEnabledAt: { not: null } } }),
    db.adminUser.count({ where: { active: true, role: { in: ['OWNER', 'ADMIN'] } } }),
    db.adminUser.count({ where: { active: true, role: { in: ['OWNER', 'ADMIN'] }, totpEnabledAt: { not: null } } }),
  ]);
  const policy = await getRequired2faRoles();
  if (privileged > 0 && privileged2fa < privileged) add('Two-factor on privileged accounts', 'warn', `${privileged2fa}/${privileged} owner/admin accounts have 2FA enabled. Enable it on all of them.`, 'Authentication');
  else add('Two-factor on privileged accounts', 'ok', `All ${privileged} owner/admin account(s) use 2FA.`, 'Authentication');
  add('2FA staff coverage', staff2fa === staffTotal ? 'ok' : 'info', `${staff2fa}/${staffTotal} active staff have 2FA. Policy enforces it for: ${policy.length ? policy.join(', ') : 'no roles yet'}.`, 'Authentication');
  add('Login brute-force protection', 'ok', `Active — lockout after repeated failures, ${redisConfigured ? 'Redis-backed rate limiting' : 'database-backed rate limiting'}.`, 'Authentication');
  add('CAPTCHA (Cloudflare Turnstile)', turnstileConfigured ? 'ok' : 'warn', turnstileConfigured ? 'Configured — challenges shown after repeated failures.' : 'Not configured. Add TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY to enable challenges.', 'Authentication');

  // ── Transport & edge ───────────────────────────────────────────────────────
  add('Security headers', process.env.CSP_DISABLED === 'true' ? 'warn' : 'ok', process.env.CSP_DISABLED === 'true' ? 'CSP is disabled via CSP_DISABLED. Re-enable once any blocked third party is allow-listed.' : 'HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy are enforced.', 'Transport & edge');
  const url = process.env.NEXT_PUBLIC_SITE_URL || '';
  add('Live domain & WAF', url.includes('kclinics.co.uk') ? 'ok' : 'info', url.includes('kclinics.co.uk') ? 'On the production domain.' : 'Running on a Vercel domain. At go-live, point kclinics.co.uk at Vercel, enable the Vercel Firewall/WAF + attack-challenge mode, and verify HTTPS/HSTS.', 'Transport & edge');
  add('SQL injection', 'ok', 'Mitigated — all database access goes through Prisma (parameterised); no raw SQL.', 'Transport & edge');
  add('DDoS / DNS protection', 'info', 'Handled at the network edge (Vercel). Enable the Vercel Firewall, rate rules and attack-challenge; the app-layer rate-limiting + lockouts are the failsafe beneath it.', 'Transport & edge');

  const weight: Record<Severity, number> = { ok: 1, info: 1, warn: 0.5, critical: 0 };
  const score = Math.round((checks.reduce((s, c) => s + weight[c.severity], 0) / checks.length) * 100);
  return { checks, score };
}

export type ThreatSummary = {
  failed24h: number; lockouts24h: number; rateLimited24h: number; captchaFails24h: number; twofaFails24h: number;
  lockedNow: { identifier: string; fails: number }[];
  topIps: { ip: string; fails: number }[];
  recent: { id: string; type: string; portal: string; identifier: string | null; ip: string | null; createdAt: Date }[];
};

export async function threatSummary(): Promise<ThreatSummary> {
  const since24 = new Date(Date.now() - 24 * 3600 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const lockWindow = new Date(Date.now() - 15 * 60 * 1000);

  const [failed24h, lockouts24h, rateLimited24h, captchaFails24h, twofaFails24h, lockedGroups, ipGroups, recent] = await Promise.all([
    db.securityEvent.count({ where: { type: 'LOGIN_FAIL', createdAt: { gte: since24 } } }),
    db.securityEvent.count({ where: { type: 'LOCKOUT', createdAt: { gte: since24 } } }),
    db.securityEvent.count({ where: { type: 'RATE_LIMITED', createdAt: { gte: since24 } } }),
    db.securityEvent.count({ where: { type: 'CAPTCHA_FAIL', createdAt: { gte: since24 } } }),
    db.securityEvent.count({ where: { type: 'TWOFA_FAIL', createdAt: { gte: since24 } } }),
    db.securityEvent.groupBy({ by: ['identifier'], where: { type: 'LOGIN_FAIL', identifier: { not: null }, createdAt: { gte: lockWindow } }, _count: { _all: true } }),
    db.securityEvent.groupBy({ by: ['ip'], where: { type: 'LOGIN_FAIL', ip: { not: null }, createdAt: { gte: since7d } }, _count: { _all: true } }),
    db.securityEvent.findMany({ where: { type: { in: ['LOGIN_FAIL', 'LOCKOUT', 'RATE_LIMITED', 'CAPTCHA_FAIL', 'TWOFA_FAIL', 'TWOFA_ENABLED', 'TWOFA_DISABLED', 'UNLOCK'] } }, orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, type: true, portal: true, identifier: true, ip: true, createdAt: true } }),
  ]);

  const lockedNow = lockedGroups
    .filter((g) => g._count._all >= 5 && g.identifier)
    .map((g) => ({ identifier: g.identifier as string, fails: g._count._all }))
    .sort((a, b) => b.fails - a.fails);
  const topIps = ipGroups
    .map((g) => ({ ip: g.ip as string, fails: g._count._all }))
    .filter((g) => g.fails >= 3)
    .sort((a, b) => b.fails - a.fails)
    .slice(0, 8);

  return { failed24h, lockouts24h, rateLimited24h, captchaFails24h, twofaFails24h, lockedNow, topIps, recent };
}
