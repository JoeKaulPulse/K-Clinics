import 'server-only';
import { academyDb as db } from '@/lib/academy-db';

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
  pricePence: number; depositPence: number | null;
  promoPrice: number | null; promoStartAt: Date | null; promoEndAt: Date | null;
  durationText: string | null; format: string | null;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toView = (c: any, cohorts: CohortView[] = []): CourseView =>
  ({
    id: c.id, slug: c.slug, title: c.title, level: c.level, summary: c.summary, description: c.description,
    pricePence: c.pricePence, depositPence: c.depositPence,
    promoPrice: c.promoPrice ?? null, promoStartAt: c.promoStartAt ?? null, promoEndAt: c.promoEndAt ?? null,
    durationText: c.durationText, format: c.format, accreditations: c.accreditations, outcomes: c.outcomes,
    prerequisites: c.prerequisites, thinkificUrl: c.thinkificUrl, heroImage: c.heroImage, featured: c.featured,
    cohorts,
  });

/** Active courses for the public academy (featured first, then order). */
export async function listCourses(includeInactive = false): Promise<CourseView[]> {
  const rows = await db.course.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ featured: 'desc' }, { order: 'asc' }, { pricePence: 'asc' }],
  });
  return rows.map((r) => toView(r));
}

export async function getCourse(slug: string): Promise<CourseView | null> {
  const c = await db.course.findFirst({ where: { slug } }); // per-tenant slug (Ring 1) — tenant scope injected by the db extension
  if (!c || !c.active) return null;
  return toView(c, await cohortsWithRemaining(c.id));
}

// ── BLD-532: bundles / learning pathways ─────────────────────────────────────
export type BundleCourse = { slug: string; title: string; level: string | null; summary: string | null; pricePence: number };
export type BundleView = { id: string; slug: string; title: string; summary: string | null; description: string | null; heroImage: string | null; pricePence: number | null; courses: BundleCourse[] };

type BundleRow = { id: string; slug: string; title: string; summary: string | null; description: string | null; heroImage: string | null; pricePence: number | null; items: { course: { slug: string; title: string; level: string | null; summary: string | null; pricePence: number; active: boolean } }[] };
function toBundleView(b: BundleRow): BundleView {
  return {
    id: b.id, slug: b.slug, title: b.title, summary: b.summary, description: b.description, heroImage: b.heroImage, pricePence: b.pricePence,
    courses: b.items.filter((i) => i.course.active).map((i) => ({ slug: i.course.slug, title: i.course.title, level: i.course.level, summary: i.course.summary, pricePence: i.course.pricePence })),
  };
}

export async function listBundles(): Promise<BundleView[]> {
  const rows = await db.courseBundle.findMany({ where: { active: true }, orderBy: { order: 'asc' }, include: { items: { orderBy: { order: 'asc' }, include: { course: true } } } });
  return rows.map(toBundleView).filter((b) => b.courses.length > 0);
}

export async function getBundle(slug: string): Promise<BundleView | null> {
  const b = await db.courseBundle.findFirst({ where: { slug }, include: { items: { orderBy: { order: 'asc' }, include: { course: true } } } });
  if (!b || !b.active) return null;
  return toBundleView(b);
}
