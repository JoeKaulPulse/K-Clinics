import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const num = (v: unknown) => (v == null || v === '' ? null : Math.round(Number(v)));
const list = (v: unknown): string[] => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean);

// Manage the academy catalogue + enrolments. Requires settings.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = await currentTenantId();
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });
  const bad = () => NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });

  // Refresh the public academy pages + sitemap and nudge search engines when a
  // course changes (the course list is published in both places).
  const revalidateAcademy = async (slug?: string | null) => {
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/academy'); revalidatePath('/sitemap.xml');
    const paths = ['/academy'];
    if (slug) { revalidatePath(`/academy/${slug}`); paths.push(`/academy/${slug}`); }
    import('@/lib/indexnow').then((m) => m.indexNow(paths)).catch(() => {});
  };

  switch (body.op) {
    case 'upsertCourse': {
      const b = body as Record<string, unknown>;
      if (!b.title) return bad();
      const data = {
        title: String(b.title).slice(0, 120),
        level: (b.level as string)?.trim() || null,
        summary: (b.summary as string)?.slice(0, 300) || null,
        description: (b.description as string) || null,
        pricePence: Math.max(0, num(b.pricePence) ?? 0),
        depositPence: b.depositPence ? num(b.depositPence) : null,
        durationText: (b.durationText as string)?.trim() || null,
        format: (b.format as string)?.trim() || null,
        accreditations: list(b.accreditations).map((s) => s.toUpperCase()),
        outcomes: list(b.outcomes),
        prerequisites: (b.prerequisites as string)?.trim() || null,
        thinkificUrl: (b.thinkificUrl as string)?.trim() || null,
        heroImage: (b.heroImage as string)?.trim() || null,
        featured: !!b.featured,
        active: b.active === undefined ? true : !!b.active,
      };
      let slug: string | null = null;
      if (b.id) { const u = await db.course.update({ where: { id: String(b.id) }, data, select: { slug: true } }); slug = u.slug; }
      else {
        const order = await db.course.count();
        const c = await db.course.create({ data: { ...data, tenantId, slug: `${slugify(data.title)}-${Date.now().toString(36).slice(-4)}`, order }, select: { slug: true } });
        slug = c.slug;
      }
      await revalidateAcademy(slug);
      return ok();
    }
    case 'toggleCourse': {
      if (!body.id) return bad();
      const c = await db.course.update({ where: { id: body.id }, data: { active: !!body.active }, select: { slug: true } });
      await revalidateAcademy(c.slug);
      return ok();
    }
    case 'removeCourse': {
      if (!body.id) return bad();
      const c = await db.course.delete({ where: { id: body.id }, select: { slug: true } });
      await revalidateAcademy(c.slug);
      return ok();
    }
    case 'upsertCohort': {
      const b = body as Record<string, unknown>;
      if (!b.courseId || !b.startAt) return bad();
      const data = {
        startAt: new Date(b.startAt as string),
        endAt: b.endAt ? new Date(b.endAt as string) : null,
        capacity: Math.max(1, num(b.capacity) ?? 8),
        location: (b.location as string)?.trim() || null,
        trainer: (b.trainer as string)?.trim() || null,
        status: ['OPEN', 'FULL', 'CLOSED'].includes(b.status as string) ? (b.status as 'OPEN') : 'OPEN',
        notes: (b.notes as string)?.trim() || null,
        accessStartAt: b.accessStartAt ? new Date(b.accessStartAt as string) : null,
        accessEndAt: b.accessEndAt ? new Date(b.accessEndAt as string) : null,
      };
      if (b.id) await db.cohort.update({ where: { id: String(b.id) }, data });
      else await db.cohort.create({ data: { ...data, tenantId, courseId: String(b.courseId) } });
      return ok();
    }
    case 'removeCohort': {
      if (!body.id) return bad();
      await db.cohort.delete({ where: { id: body.id } });
      return ok();
    }
    case 'updateEnrolment': {
      if (!body.id) return bad();
      const b = body as Record<string, unknown>;
      await db.enrolment.update({
        where: { id: String(b.id) },
        data: {
          ...(b.status && ['APPLIED', 'OFFERED', 'PAID', 'ENROLLED', 'COMPLETED', 'CANCELLED'].includes(b.status as string) ? { status: b.status as 'APPLIED' } : {}),
          ...(b.cohortId !== undefined ? { cohortId: (b.cohortId as string) || null } : {}),
          ...(b.paidPence !== undefined ? { paidPence: Math.max(0, num(b.paidPence) ?? 0) } : {}),
          ...(b.notes !== undefined ? { notes: (b.notes as string) || null } : {}),
        },
      });
      return ok();
    }
    case 'removeEnrolment': {
      if (!body.id) return bad();
      await db.enrolment.delete({ where: { id: body.id } });
      return ok();
    }
    case 'upsertLiveClass': {
      const b = body as Record<string, unknown>;
      if (!b.courseId || !b.title || !b.startAt) return bad();
      const data = {
        title: String(b.title).slice(0, 120),
        startAt: new Date(b.startAt as string),
        endAt: b.endAt ? new Date(b.endAt as string) : null,
        joinUrl: (b.joinUrl as string)?.trim() || null,
        trainer: (b.trainer as string)?.trim() || null,
        description: (b.description as string)?.trim() || null,
      };
      if (b.id) await db.liveClass.update({ where: { id: String(b.id) }, data });
      else await db.liveClass.create({ data: { ...data, tenantId, courseId: String(b.courseId) } });
      return ok();
    }
    case 'removeLiveClass': {
      if (!body.id) return bad();
      await db.liveClass.delete({ where: { id: body.id } });
      return ok();
    }
    case 'setStudentActive': {
      // Activate / suspend a trainee's portal access. A suspended trainee loses
      // access immediately (getCurrentStudent rejects portalActive === false);
      // bumping sessionEpoch on suspend also revokes their outstanding JWTs, so a
      // later reactivation doesn't silently restore a pre-suspension session.
      if (!body.id) return bad();
      const active = !!body.active;
      await db.academyStudent.update({
        where: { id: String(body.id) },
        data: { portalActive: active, ...(active ? {} : { sessionEpoch: { increment: 1 } }) },
      });
      return ok();
    }
    case 'updateStudentNotes': {
      if (!body.id) return bad();
      const notes = (body.notes as string | undefined)?.slice(0, 4000) || null;
      await db.academyStudent.update({ where: { id: String(body.id) }, data: { notes } });
      return ok();
    }
    case 'updateFunding': {
      if (!body.id) return bad();
      const b = body as Record<string, unknown>;
      const STATUSES = ['NEW', 'REVIEWING', 'REFERRED', 'APPROVED', 'DECLINED', 'FUNDED', 'CLOSED'];
      await db.fundingApplication.update({
        where: { id: String(b.id) },
        data: {
          ...(b.status && STATUSES.includes(b.status as string) ? { status: b.status as 'NEW' } : {}),
          ...(b.notes !== undefined ? { notes: (b.notes as string)?.slice(0, 4000) || null } : {}),
        },
      });
      return ok();
    }
    case 'removeFunding': {
      if (!body.id) return bad();
      await db.fundingApplication.delete({ where: { id: String(body.id) } });
      return ok();
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
