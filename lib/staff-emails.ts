import 'server-only';
import { db } from '@/lib/db';
import { sendEmail, tmplStaffDigest, tmplStaffNudge } from '@/lib/email';
import { getSetting } from '@/lib/settings';
import { site } from '@/lib/site';
import { hasPermission } from '@/lib/permissions';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
const firstName = (name: string | null, email: string) => (name?.trim().split(/\s+/)[0]) || email.split('@')[0];
// BLD-1542: a NEW consultation/group-booking lead sitting unanswered this long
// escalates into the same digest/nudge staff already get for tasks and board
// items — matches the 24-72h staleness windows used elsewhere (lib/automations.ts).
const CONSULT_STALE_HOURS = 48;

/** Has this staff email had `kind` sent within `hours`? (dedup; clientId is null
 *  for staff emails, so we match on the recipient address). */
async function sentTo(email: string, kind: 'STAFF_DIGEST' | 'STAFF_NUDGE', hours: number): Promise<boolean> {
  const since = new Date(Date.now() - hours * 3600_000);
  const row = await db.emailEvent.findFirst({ where: { to: email, kind, status: 'SENT', createdAt: { gte: since } }, select: { id: true } });
  return !!row;
}

/** Open tasks + non-shipped board items assigned to a staff member, plus (for
 *  staff who can act on them) stale unanswered consultation/group-booking
 *  leads — either assigned to this person or still unassigned entirely
 *  (BLD-1542: previously never escalated to anyone). */
async function workFor(user: { id: string; email: string; role: string; permGrant?: string[]; permRevoke?: string[] }) {
  const canTriageConsultations = hasPermission(user, 'consultations.view') || hasPermission(user, 'consultations.manage');
  const staleCutoff = new Date(Date.now() - CONSULT_STALE_HOURS * 3600_000);
  const [tasks, items, staleLeads] = await Promise.all([
    db.task.findMany({ where: { assigneeId: user.id, status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 10, select: { title: true } }),
    db.buildItem.findMany({ where: { assignee: user.email, status: { notIn: ['SHIPPED', 'CANCELLED'] } }, orderBy: { updatedAt: 'desc' }, take: 10, select: { title: true, status: true } }),
    canTriageConsultations
      ? db.consultation.findMany({
          where: { status: 'NEW', createdAt: { lt: staleCutoff }, OR: [{ assignedTo: user.email }, { assignedTo: null }] },
          orderBy: { createdAt: 'asc' },
          take: 10,
          select: { category: true, createdAt: true, client: { select: { firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
  ]);
  const leadTitle = (l: (typeof staleLeads)[number]) => {
    const name = [l.client.firstName, l.client.lastName].filter(Boolean).join(' ') || 'A client';
    const ageDays = Math.floor((Date.now() - l.createdAt.getTime()) / 86_400_000);
    return `Unanswered ${l.category} enquiry (${ageDays}d): ${name}`;
  };
  return {
    tasks: tasks.map((t) => t.title),
    items: [...items.map((i) => i.title), ...staleLeads.map(leadTitle)],
    blockers: items.filter((i) => i.status === 'BLOCKED').map((i) => i.title),
  };
}

const ADMIN_REPORTS = [
  { label: 'Reports', href: '/admin/reports' },
  { label: 'Cashflow', href: '/admin/cashflow' },
  { label: 'Platform status', href: '/admin/status' },
];

/** Monday-morning work digest for each active staff member (gated; deduped to
 *  once per ~6 days). Staff with nothing assigned are skipped. */
export async function staffWeeklyDigest(t: { staffDigests: number; errors: number }) {
  try {
    if (!(await getSetting('staff_weekly_digest'))) return;
    if (new Date().getUTCDay() !== 1) return; // Mondays only
    const staff = await db.adminUser.findMany({ where: { active: true }, select: { id: true, email: true, name: true, role: true, permGrant: true, permRevoke: true } });
    for (const u of staff) {
      const work = await workFor(u);
      if (work.tasks.length === 0 && work.items.length === 0) continue; // nothing to say
      if (await sentTo(u.email, 'STAFF_DIGEST', 6 * 24)) continue;
      const isAdmin = ['OWNER', 'ADMIN'].includes(u.role);
      const res = await sendEmail({
        to: u.email,
        subject: `Your week at KClinics — ${work.tasks.length + work.items.length} on your plate`,
        html: tmplStaffDigest({ name: firstName(u.name, u.email), baseUrl: SITE_URL, ...work, isAdmin, reports: isAdmin ? ADMIN_REPORTS : [] }),
      });
      await db.emailEvent.create({ data: { kind: 'STAFF_DIGEST', to: u.email, subject: 'Weekly work digest', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } }).catch(() => {});
      res.ok ? t.staffDigests++ : t.errors++;
    }
  } catch (e) {
    console.error('[staff-emails] digest failed', (e as Error)?.message);
  }
}

/** Nudge staff who have assigned work but haven't signed in for 8h+ (gated;
 *  deduped to once per 3 days so it never nags). */
export async function staffReengagement(t: { staffNudges: number; errors: number }) {
  try {
    if (!(await getSetting('staff_work_reengagement'))) return;
    const cutoff = new Date(Date.now() - 8 * 3600_000);
    const staff = await db.adminUser.findMany({
      where: { active: true, OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: cutoff } }] },
      select: { id: true, email: true, name: true, role: true, permGrant: true, permRevoke: true },
    });
    for (const u of staff) {
      const work = await workFor(u);
      if (work.tasks.length === 0 && work.items.length === 0) continue; // only nudge if work is waiting
      if (await sentTo(u.email, 'STAFF_NUDGE', 3 * 24)) continue;
      const res = await sendEmail({
        to: u.email,
        subject: `You have work waiting at KClinics`,
        html: tmplStaffNudge({ name: firstName(u.name, u.email), baseUrl: SITE_URL, tasks: work.tasks, items: work.items }),
      });
      await db.emailEvent.create({ data: { kind: 'STAFF_NUDGE', to: u.email, subject: 'Work waiting', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } }).catch(() => {});
      res.ok ? t.staffNudges++ : t.errors++;
    }
  } catch (e) {
    console.error('[staff-emails] reengagement failed', (e as Error)?.message);
  }
}
