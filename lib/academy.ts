import 'server-only';
import { db } from '@/lib/db';

// ── K Academy catalogue (CRM-managed) ───────────────────────────────────────

export const ACCREDITATION_LABELS: Record<string, string> = {
  OFQUAL: 'Ofqual-regulated',
  VTCT: 'VTCT qualification',
  CPD: 'CPD accredited',
};

export const formatFee = (pence: number | null | undefined) =>
  pence == null || pence === 0 ? 'On enquiry' : `£${(pence / 100).toLocaleString('en-GB')}`;

export type CohortView = { id: string; startAt: Date; endAt: Date | null; capacity: number; location: string | null; trainer: string | null; status: string; remaining: number };
export type CourseView = {
  id: string; slug: string; title: string; level: string | null; summary: string | null; description: string | null;
  pricePence: number; depositPence: number | null; durationText: string | null; format: string | null;
  accreditations: string[]; outcomes: string[]; prerequisites: string | null; thinkificUrl: string | null;
  heroImage: string | null; featured: boolean; cohorts: CohortView[];
};

async function cohortsWithRemaining(courseId: string): Promise<CohortView[]> {
  const cohorts = await db.cohort.findMany({
    where: { courseId, status: { not: 'CLOSED' }, startAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    orderBy: { startAt: 'asc' },
  });
  const counts = await db.enrolment.groupBy({
    by: ['cohortId'],
    where: { cohortId: { in: cohorts.map((c) => c.id) }, status: { in: ['PAID', 'ENROLLED'] } },
    _count: { _all: true },
  });
  const used = new Map(counts.map((c) => [c.cohortId, c._count._all]));
  return cohorts.map((c) => ({
    id: c.id, startAt: c.startAt, endAt: c.endAt, capacity: c.capacity, location: c.location, trainer: c.trainer,
    status: c.status, remaining: Math.max(0, c.capacity - (used.get(c.id) ?? 0)),
  }));
}

const toView = (c: { id: string; slug: string; title: string; level: string | null; summary: string | null; description: string | null; pricePence: number; depositPence: number | null; durationText: string | null; format: string | null; accreditations: string[]; outcomes: string[]; prerequisites: string | null; thinkificUrl: string | null; heroImage: string | null; featured: boolean }, cohorts: CohortView[] = []): CourseView =>
  ({ ...c, cohorts });

/** Active courses for the public academy (featured first, then order). */
export async function listCourses(includeInactive = false): Promise<CourseView[]> {
  const rows = await db.course.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ featured: 'desc' }, { order: 'asc' }, { pricePence: 'asc' }],
  });
  return rows.map((r) => toView(r));
}

export async function getCourse(slug: string): Promise<CourseView | null> {
  const c = await db.course.findUnique({ where: { slug } });
  if (!c || !c.active) return null;
  return toView(c, await cohortsWithRemaining(c.id));
}
