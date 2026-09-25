import 'server-only';
import { db } from '@/lib/db';
import { renewalStatus, type RenewalStatus } from '@/lib/renewals-shared';
import { COMPLIANCE_CALENDAR_SEED, complianceSeedId } from '@/lib/compliance-calendar-seed';

// Business compliance & renewals (BLD-587) — server data layer. Tracks recurring
// deadlines (insurance, licences, PAT/EICR, servicing, waste contracts) and
// derives status so the dashboard + cron surface what needs attention. The pure
// status derivation + category list live in lib/renewals-shared (client-safe).
export { renewalStatus, RENEWAL_CATEGORIES, type RenewalStatus } from '@/lib/renewals-shared';

export type RenewalRow = Awaited<ReturnType<typeof listRenewals>>[number];

/** All active items, soonest renewal first, with derived status. */
export async function listRenewals() {
  const rows = await db.complianceItem.findMany({ where: { active: true }, orderBy: { renewalAt: 'asc' } });
  const now = new Date();
  return rows.map((r) => ({ ...r, ...renewalStatus(r.renewalAt, now) }));
}

/** Counts + the next few items needing attention — for the dashboard widget. */
export async function renewalsSummary() {
  const rows = await db.complianceItem
    .findMany({ where: { active: true }, select: { id: true, name: true, renewalAt: true, category: true } })
    .catch(() => [] as { id: string; name: string; renewalAt: Date; category: string }[]);
  const now = new Date();
  let expired = 0, due = 0, soon = 0;
  const attention: { id: string; name: string; category: string; days: number; status: RenewalStatus }[] = [];
  for (const r of rows) {
    const { status, days } = renewalStatus(r.renewalAt, now);
    if (status === 'EXPIRED') expired++;
    else if (status === 'DUE') due++;
    else if (status === 'SOON') soon++;
    if (status !== 'OK') attention.push({ id: r.id, name: r.name, category: r.category, days, status });
  }
  attention.sort((a, b) => a.days - b.days);
  return { total: rows.length, expired, due, soon, needAttention: expired + due + soon, next: attention.slice(0, 5) };
}

let complianceCalendarSeeded = false;
/** BLD-1830 — idempotently seed the statutory filing calendar for the two
 *  K-Clinics legal entities onto the existing compliance board. Called once per
 *  page load, mirroring ensureTaskRefs/ensureBuildRefs.
 *
 *  Uniqueness is structural, not a DB constraint — the deploy gate refuses new
 *  @unique columns on an existing table (see CLAUDE.md / lib/task-refs.ts):
 *   • each seeded row gets a deterministic primary key (complianceSeedId), so
 *     two concurrent page loads racing the same insert collide on the PK and
 *     the loser is skipped rather than creating a duplicate;
 *   • rows are also matched on name+company, so a row seeded before the stable
 *     ids existed (or re-created by hand) is recognised instead of duplicated;
 *   • one read and one write, not two queries per item. */
export async function ensureComplianceCalendarSeeded(): Promise<void> {
  if (complianceCalendarSeeded) return;
  try {
    const companies = [...new Set(COMPLIANCE_CALENDAR_SEED.map((i) => i.company))];
    const seedIds = COMPLIANCE_CALENDAR_SEED.map(complianceSeedId);
    const existing = await db.complianceItem.findMany({
      where: { OR: [{ id: { in: seedIds } }, { company: { in: companies } }] },
      select: { id: true, name: true, company: true },
    });
    const byId = new Set(existing.map((r) => r.id));
    const byNameCompany = new Set(existing.map((r) => `${r.company}\u0000${r.name}`));

    const missing = COMPLIANCE_CALENDAR_SEED.filter(
      (i) => !byId.has(complianceSeedId(i)) && !byNameCompany.has(`${i.company}\u0000${i.name}`),
    );
    if (missing.length) {
      await db.complianceItem.createMany({
        data: missing.map((item) => ({
          id: complianceSeedId(item),
          name: item.name,
          category: item.category,
          company: item.company,
          renewalAt: new Date(`${item.renewalAt}T12:00:00.000Z`),
          notes: item.notes ?? null,
          reference: item.reference ?? null,
          createdBy: 'system:compliance-calendar-seed',
        })),
        skipDuplicates: true,
      });
    }
    complianceCalendarSeeded = true;
  } catch (e) {
    console.error('[renewals] compliance calendar seed failed', e);
  }
}

/** Daily cron: alert staff when an item crosses a reminder threshold it hasn't
 *  been alerted for this cycle (reset on renewal). One grouped notification. */
export async function runRenewalReminders(): Promise<{ alerted: number }> {
  const rows = await db.complianceItem.findMany({ where: { active: true } });
  const now = new Date();
  const flagged: { id: string; name: string; days: number; threshold: number }[] = [];

  for (const r of rows) {
    const { days } = renewalStatus(r.renewalAt, now);
    const thresholds = r.reminderDays?.length ? r.reminderDays : [90, 60, 30];
    // Expired items are always worth one alert (threshold 0).
    const candidates = [...(days < 0 ? [0] : []), ...thresholds].sort((a, b) => a - b); // ascending
    // The smallest threshold the item has now crossed (days <= T).
    let hit: number | null = null;
    for (const t of candidates) { if (days <= t) { hit = t; break; } }
    if (hit === null) continue;
    // Skip if we've already alerted at this threshold (or a smaller one) this cycle.
    if (r.lastRemindedDays != null && hit >= r.lastRemindedDays) continue;
    flagged.push({ id: r.id, name: r.name, days, threshold: hit });
  }

  if (!flagged.length) return { alerted: 0 };

  await Promise.all(flagged.map((f) =>
    db.complianceItem.update({ where: { id: f.id }, data: { lastRemindedDays: f.threshold } }).catch(() => {}),
  ));

  try {
    const { notifyStaffByPermission } = await import('@/lib/notifications');
    const expired = flagged.filter((f) => f.days < 0);
    const title = expired.length
      ? `${flagged.length} compliance item${flagged.length === 1 ? '' : 's'} need attention (${expired.length} expired)`
      : `${flagged.length} compliance renewal${flagged.length === 1 ? '' : 's'} due soon`;
    await notifyStaffByPermission('compliance.view', {
      kind: 'status', category: 'system', priority: expired.length ? 'high' : 'normal', groupKey: 'compliance:renewals',
      title,
      body: flagged.slice(0, 5).map((f) => f.days < 0 ? `${f.name} (expired ${Math.abs(f.days)}d ago)` : `${f.name} (in ${f.days}d)`).join(', ') + (flagged.length > 5 ? '…' : ''),
      href: '/admin/compliance',
    });
  } catch { /* notification is best-effort */ }

  return { alerted: flagged.length };
}
