import 'server-only';
import { db } from '@/lib/db';

// Platform status — a compartmentalised, traffic-light health view for Owner/
// Admin audit. Every probe is defensive (never throws); each item carries a
// light plus the actual signal underneath (not just "connected"). Compartments
// follow the ClinicOS bounded contexts so this maps onto the future per-cluster
// status page.

export type Light = 'green' | 'amber' | 'red' | 'grey';
export type StatusItem = { id: string; label: string; light: Light; detail: string; info?: string[] };
export type StatusGroup = { id: string; label: string; blurb?: string; items: StatusItem[] };
export type PlatformStatus = { generatedAt: string; env: string; commit: string; overall: Light; groups: StatusGroup[] };

const has = (v?: string | null) => Boolean(v && v.length > 0);
const ago = (d: Date | null) => {
  if (!d) return 'never';
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

const RANK: Record<Light, number> = { red: 3, amber: 2, grey: 1, green: 0 };
const worst = (lights: Light[]): Light => lights.reduce<Light>((acc, l) => (RANK[l] > RANK[acc] ? l : acc), 'green');

export async function getPlatformStatus(): Promise<PlatformStatus> {
  const groups: StatusGroup[] = [];

  // ── Database ───────────────────────────────────────────────────────────────
  {
    const items: StatusItem[] = [];
    const pooled = [process.env.PRISMA_DATABASE_URL, process.env.ACCELERATE_URL, process.env.DATABASE_URL, process.env.POSTGRES_URL]
      .find((u) => u && /^prisma(\+postgres)?:\/\//.test(u));
    let connected = false; let count = 0; let ms = 0;
    try { const t = Date.now(); count = await db.client.count(); ms = Date.now() - t; connected = true; } catch { connected = false; }
    items.push({
      id: 'db-conn', label: 'Connection', light: connected ? (ms > 1500 ? 'amber' : 'green') : 'red',
      detail: connected ? `Connected · ${count.toLocaleString('en-GB')} clients · ${ms}ms` : 'Not reachable',
    });
    items.push({
      id: 'db-mode', label: 'Connection mode', light: pooled ? 'green' : 'amber',
      detail: pooled ? 'Pooled (Prisma Accelerate) — fleet shares a managed pool' : 'Direct postgres:// — per-instance pool capped (connection_limit=1)',
      info: [pooled ? 'Recommended for serverless; designed out the connection-exhaustion failure mode.' : 'Set PRISMA_DATABASE_URL to a prisma+postgres:// pooled URL to remove the exhaustion risk entirely.'],
    });
    // Schema sync — probe the tables the ops suite depends on.
    const checks: { name: string; ok: boolean }[] = [];
    const probe = async (name: string, fn: () => Promise<unknown>) => { try { await fn(); checks.push({ name, ok: true }); } catch { checks.push({ name, ok: false }); } };
    await probe('setting', () => db.setting.count());
    await probe('booking', () => db.booking.count());
    await probe('buildItem', () => db.buildItem.count());
    await probe('maintenanceWindow', () => db.maintenanceWindow.count());
    const missing = checks.filter((c) => !c.ok).map((c) => c.name);
    items.push({
      id: 'db-schema', label: 'Schema in sync', light: missing.length === 0 ? 'green' : 'red',
      detail: missing.length === 0 ? `All ${checks.length} probed tables present` : `Missing/behind: ${missing.join(', ')}`,
      info: missing.length ? ['A migration may not have applied — run the deploy db-sync.'] : undefined,
    });
    groups.push({ id: 'database', label: 'Database', blurb: 'The single source of truth.', items });
  }

  // ── Security & identity ──────────────────────────────────────────────────
  {
    const items: StatusItem[] = [];
    let jwt: Light = 'red'; let jwtDetail = 'No JWT secret set';
    try {
      const { SignJWT, jwtVerify } = await import('jose');
      const raw = process.env.CLIENT_JWT_SECRET || process.env.ADMIN_JWT_SECRET;
      if (raw) {
        const bytes = new TextEncoder().encode(raw); let key = bytes;
        if (bytes.length < 32) { const o = new Uint8Array(32); for (let i = 0; i < 32; i++) o[i] = bytes[i % bytes.length]; key = o; }
        const tok = await new SignJWT({ t: 1 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1m').sign(key);
        await jwtVerify(tok, key); jwt = 'green'; jwtDetail = 'Sign + verify round-trip OK';
      }
    } catch { jwt = 'red'; jwtDetail = 'Self-test failed'; }
    items.push({ id: 'sec-jwt', label: 'Session signing', light: jwt, detail: jwtDetail });

    let enc: Light = 'red'; let encDetail = 'Encryption key missing';
    try {
      const { encryptJson, decryptJson } = await import('@/lib/crypto');
      decryptJson(encryptJson({ t: 1 })); enc = 'green'; encDetail = 'Clinical-data encryption round-trip OK';
    } catch { enc = 'red'; encDetail = 'Encrypt/decrypt self-test failed — clinical data at risk'; }
    items.push({ id: 'sec-enc', label: 'Clinical encryption', light: enc, detail: encDetail });

    try {
      const admins = await db.adminUser.findMany({ where: { active: true }, select: { totpEnabledAt: true, role: true, _count: { select: { passkeys: true } } } });
      const total = admins.length;
      const covered = admins.filter((a) => a.totpEnabledAt || a._count.passkeys > 0).length;
      const ownerCovered = admins.filter((a) => a.role === 'OWNER').every((a) => a.totpEnabledAt || a._count.passkeys > 0);
      const light: Light = total === 0 ? 'grey' : covered === total ? 'green' : ownerCovered ? 'amber' : 'red';
      items.push({
        id: 'sec-2fa', label: 'Second-factor coverage', light,
        detail: total ? `${covered}/${total} active admins have 2FA or a passkey` : 'No admins on file',
        info: covered < total ? ['Encourage every admin to add a passkey or TOTP.'] : undefined,
      });
    } catch { items.push({ id: 'sec-2fa', label: 'Second-factor coverage', light: 'grey', detail: 'Could not read admin users' }); }
    groups.push({ id: 'security', label: 'Security & identity', blurb: 'Signing, encryption and second factors.', items });
  }

  // ── Services & connections ────────────────────────────────────────────────
  {
    const CRITICAL = new Set(['database', 'security', 'payments', 'email', 'cron']);
    const map = (s: string, id: string): Light =>
      s === 'connected' ? 'green' : s === 'partial' ? 'amber' : s === 'parked' ? 'grey' : (CRITICAL.has(id) ? 'red' : 'grey');
    let items: StatusItem[] = [];
    try {
      const { getIntegrations } = await import('@/lib/integrations');
      const integrations = await getIntegrations();
      items = integrations.map((i) => ({
        id: `svc-${i.id}`, label: i.name, light: map(i.status, i.id), detail: i.detail,
        info: [
          `Category: ${i.category}`,
          ...i.envVars.filter((v) => !v.set && !v.optional).map((v) => `Missing: ${v.name}`),
        ],
      }));
    } catch { items = [{ id: 'svc-error', label: 'Integrations', light: 'amber', detail: 'Could not load the integration registry' }]; }
    groups.push({ id: 'services', label: 'Services & connections', blurb: 'Every external dependency, with the env it still needs.', items });
  }

  // ── Scheduled jobs ────────────────────────────────────────────────────────
  {
    const items: StatusItem[] = [];
    const cronSet = has(process.env.CRON_SECRET);
    items.push({ id: 'cron-secret', label: 'Cron secured', light: cronSet ? 'green' : 'red', detail: cronSet ? 'CRON_SECRET set' : 'Set CRON_SECRET to secure the runners' });
    const read = async (key: string) => { try { const r = await db.setting.findUnique({ where: { key } }); return r?.value ? new Date(r.value) : null; } catch { return null; } };
    const daily = await read('cron_daily_last');
    const dispatch = await read('cron_dispatch_last');
    const dailyLight: Light = !daily ? 'grey' : Date.now() - daily.getTime() < 26 * 3600000 ? 'green' : Date.now() - daily.getTime() < 50 * 3600000 ? 'amber' : 'red';
    const dispLight: Light = !dispatch ? 'grey' : Date.now() - dispatch.getTime() < 30 * 60000 ? 'green' : Date.now() - dispatch.getTime() < 2 * 3600000 ? 'amber' : 'red';
    items.push({ id: 'cron-daily', label: 'Daily run', light: dailyLight, detail: `Last run ${ago(daily)}`, info: ['Reminders, loyalty, board seed, retention. Expected every 24h.'] });
    items.push({ id: 'cron-dispatch', label: 'Frequent dispatcher', light: dispLight, detail: `Last run ${ago(dispatch)}`, info: ['Scheduled email, chat follow-ups, GitHub mirror. Expected every 15m.'] });
    groups.push({ id: 'jobs', label: 'Scheduled jobs', blurb: 'The cron runners and how fresh they are.', items });
  }

  // ── Build & audit ─────────────────────────────────────────────────────────
  {
    const items: StatusItem[] = [];
    try {
      const [open, blocked, unsynced] = await Promise.all([
        db.buildItem.count({ where: { status: { not: 'SHIPPED' } } }),
        db.buildItem.count({ where: { status: 'BLOCKED' } }),
        db.buildItem.count({ where: { githubUrl: null } }),
      ]);
      const { githubConfigured } = await import('@/lib/build-board');
      const gh = await githubConfigured();
      items.push({ id: 'board-open', label: 'Open board items', light: blocked > 0 ? 'amber' : 'green', detail: `${open} open · ${blocked} blocked` });
      items.push({ id: 'board-gh', label: 'GitHub audit mirror', light: gh ? (unsynced > 0 ? 'amber' : 'green') : 'amber', detail: gh ? (unsynced > 0 ? `${unsynced} item(s) not yet on GitHub — mirroring on the 15m cron` : 'All board items mirrored to GitHub') : 'GitHub not connected — connect on the board to mirror for audit' });
    } catch { items.push({ id: 'board-error', label: 'Build board', light: 'grey', detail: 'Could not read the board' }); }
    groups.push({ id: 'audit', label: 'Build & audit', blurb: 'Work tracking and its GitHub mirror.', items });
  }

  // ── Tools (bounded contexts) ──────────────────────────────────────────────
  {
    const TOOLS: { id: string; label: string; probe: () => Promise<unknown> }[] = [
      { id: 'booking', label: 'Booking & scheduling', probe: () => db.booking.count() },
      { id: 'crm', label: 'CRM & clinical', probe: () => db.client.count() },
      { id: 'commerce', label: 'Commerce', probe: () => db.product.count() },
      { id: 'marketing', label: 'Marketing & comms', probe: () => db.campaign.count() },
      { id: 'learning', label: 'Learning (Academy)', probe: () => db.course.count() },
      { id: 'content', label: 'Content / CMS', probe: () => db.page.count() },
    ];
    const items: StatusItem[] = [];
    for (const t of TOOLS) {
      try { const n = await t.probe(); items.push({ id: `tool-${t.id}`, label: t.label, light: 'green', detail: `Healthy · ${(n as number).toLocaleString('en-GB')} records` }); }
      catch { items.push({ id: `tool-${t.id}`, label: t.label, light: 'red', detail: 'Domain query failed' }); }
    }
    groups.push({ id: 'tools', label: 'Tools (admin sections)', blurb: 'Each bounded context that becomes its own service under ClinicOS.', items });
  }

  const overall = worst(groups.flatMap((g) => g.items.map((i) => i.light)));
  return {
    generatedAt: new Date().toISOString(),
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    overall,
    groups,
  };
}
