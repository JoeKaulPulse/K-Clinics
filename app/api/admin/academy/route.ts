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
        promoPrice: b.promoPrice != null && b.promoPrice !== '' ? Number(b.promoPrice) : null,
        promoStartAt: b.promoStartAt ? new Date(b.promoStartAt as string) : null,
        promoEndAt: b.promoEndAt ? new Date(b.promoEndAt as string) : null,
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
      if (b.id) {
        const existing = await db.course.findFirst({ where: { id: String(b.id), tenantId }, select: { slug: true } });
        if (!existing) return bad();
        await db.course.update({ where: { id: String(b.id) }, data });
        slug = existing.slug;
      } else {
        const order = await db.course.count();
        const c = await db.course.create({ data: { ...data, tenantId, slug: `${slugify(data.title)}-${Date.now().toString(36).slice(-4)}`, order }, select: { slug: true } });
        slug = c.slug;
      }
      await revalidateAcademy(slug);
      return ok();
    }
    case 'toggleCourse': {
      if (!body.id) return bad();
      const c = await db.course.findFirst({ where: { id: body.id, tenantId }, select: { slug: true } });
      if (!c) return bad();
      await db.course.update({ where: { id: body.id }, data: { active: !!body.active } });
      await revalidateAcademy(c.slug);
      return ok();
    }
    case 'removeCourse': {
      if (!body.id) return bad();
      const c = await db.course.findFirst({ where: { id: body.id, tenantId }, select: { slug: true } });
      if (!c) return bad();
      await db.course.delete({ where: { id: body.id } });
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
        name: (b.name as string)?.trim() || null,
        status: ['OPEN', 'FULL', 'CLOSED'].includes(b.status as string) ? (b.status as 'OPEN') : 'OPEN',
        notes: (b.notes as string)?.trim() || null,
        accessStartAt: b.accessStartAt ? new Date(b.accessStartAt as string) : null,
        accessEndAt: b.accessEndAt ? new Date(b.accessEndAt as string) : null,
      };
      if (b.id) await db.cohort.updateMany({ where: { id: String(b.id), tenantId }, data });
      else await db.cohort.create({ data: { ...data, tenantId, courseId: String(b.courseId) } });
      return ok();
    }
    case 'removeCohort': {
      if (!body.id) return bad();
      // BLD-489: scope delete to this tenant so a cross-tenant ID guess is a no-op.
      await db.cohort.deleteMany({ where: { id: body.id, tenantId } });
      return ok();
    }
    case 'upsertPracticalDay': {
      // BLD-881: per-cohort practical training days — several per cohort,
      // edited/deleted independently, never shared across cohorts.
      const b = body as Record<string, unknown>;
      if (!b.cohortId || !b.startAt) return bad();
      const cohort = await db.cohort.findFirst({ where: { id: String(b.cohortId), tenantId }, select: { id: true } });
      if (!cohort) return bad();
      const data = {
        title: (b.title as string)?.trim().slice(0, 120) || 'Practical training',
        startAt: new Date(b.startAt as string),
        endAt: b.endAt ? new Date(b.endAt as string) : null,
        location: (b.location as string)?.trim() || null,
        trainer: (b.trainer as string)?.trim() || null,
        notes: (b.notes as string)?.trim() || null,
      };
      if (Number.isNaN(+data.startAt) || (data.endAt && Number.isNaN(+data.endAt))) return bad();
      if (b.id) await db.cohortPracticalDay.updateMany({ where: { id: String(b.id), tenantId, cohortId: cohort.id }, data });
      else await db.cohortPracticalDay.create({ data: { ...data, tenantId, cohortId: cohort.id } });
      return ok();
    }
    case 'removePracticalDay': {
      if (!body.id) return bad();
      await db.cohortPracticalDay.deleteMany({ where: { id: body.id, tenantId } });
      return ok();
    }
    case 'updateEnrolment': {
      if (!body.id) return bad();
      const b = body as Record<string, unknown>;
      // BLD-489: scope to this tenant.
      await db.enrolment.updateMany({
        where: { id: String(b.id), tenantId },
        data: {
          ...(b.status && ['APPLIED', 'OFFERED', 'PAID', 'ENROLLED', 'COMPLETED', 'CANCELLED'].includes(b.status as string) ? { status: b.status as 'APPLIED' } : {}),
          ...(b.cohortId !== undefined ? { cohortId: (b.cohortId as string) || null } : {}),
          // BLD-850: an explicit staff price edit is a new agreement — re-stamp
          // the locked fee too, otherwise the money engine would keep settling
          // against the old locked value and the edit would be silently dead.
          ...(b.pricePence !== undefined ? { pricePence: Math.max(0, num(b.pricePence) ?? 0), agreedFeePence: Math.max(0, num(b.pricePence) ?? 0) } : {}),
          ...(b.paidPence !== undefined ? { paidPence: Math.max(0, num(b.paidPence) ?? 0) } : {}),
          ...(b.notes !== undefined ? { notes: (b.notes as string) || null } : {}),
        },
      });
      return ok();
    }
    case 'removeEnrolment': {
      if (!body.id) return bad();
      // BLD-489: scope delete to this tenant.
      await db.enrolment.deleteMany({ where: { id: body.id, tenantId } });
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
      if (b.id) await db.liveClass.updateMany({ where: { id: String(b.id), tenantId }, data });
      else await db.liveClass.create({ data: { ...data, tenantId, courseId: String(b.courseId) } });
      return ok();
    }
    case 'removeLiveClass': {
      if (!body.id) return bad();
      await db.liveClass.deleteMany({ where: { id: body.id, tenantId } });
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
    // ── BLD-528: enrolment + payment engine ────────────────────────────────
    case 'makeOffer': {
      // Confirm a place: ensure the trainee account, set OFFERED, email the
      // one-click "accept & pay" link.
      if (!body.id) return bad();
      const { makeOffer } = await import('@/lib/academy-payments');
      const r = await makeOffer(String(body.id), { staffEmail: session.email, expiresInDays: body.expiresInDays ? Number(body.expiresInDays) : undefined });
      return r.ok ? ok() : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    }
    case 'enrolStudent': {
      // Manually add a learner to a course (+ optional cohort), creating/reusing
      // their trainee account by email. Defaults to ENROLLED so access unlocks.
      const b = body as Record<string, unknown>;
      if (!b.courseId || !b.email) return bad();
      const { enrolStudentManually } = await import('@/lib/academy-payments');
      const r = await enrolStudentManually({
        courseId: String(b.courseId), cohortId: (b.cohortId as string) || null,
        email: String(b.email), name: (b.name as string) || undefined, phone: (b.phone as string) || undefined,
        status: (b.status as string) || undefined, pricePence: b.pricePence != null ? Number(b.pricePence) : undefined,
        sendLink: !!b.sendLink,
      });
      return r.ok ? ok() : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    }
    case 'recordPayment': {
      // Record a payment collected offline (cash / transfer / phone card / a paid instalment).
      if (!body.id) return bad();
      const KINDS = ['FULL', 'DEPOSIT', 'BALANCE', 'INSTALMENT'];
      const METHODS = ['CARD', 'BNPL', 'BANK_TRANSFER', 'CASH', 'OTHER'];
      const { recordManualPayment } = await import('@/lib/academy-payments');
      const r = await recordManualPayment(String(body.id), {
        amountPence: Math.round(Number(body.amountPence) || 0),
        kind: (KINDS.includes(body.kind) ? body.kind : 'BALANCE') as 'BALANCE',
        method: (METHODS.includes(body.method) ? body.method : 'OTHER') as 'OTHER',
        note: typeof body.note === 'string' ? body.note : undefined,
        staffEmail: session.email,
      });
      return r.ok ? ok() : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    }
    case 'createPlan': {
      // Set up an in-house instalment plan over `count` months from `startDate`.
      if (!body.id || !body.startDate) return bad();
      const { createInstalmentPlan } = await import('@/lib/academy-payments');
      const r = await createInstalmentPlan(String(body.id), { count: Number(body.count) || 3, startDate: String(body.startDate), staffEmail: session.email });
      return r.ok ? ok() : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    }
    case 'markPaymentPaid': {
      if (!body.paymentId) return bad();
      const METHODS = ['CARD', 'BNPL', 'BANK_TRANSFER', 'CASH', 'OTHER'];
      const { markPaymentPaid } = await import('@/lib/academy-payments');
      const r = await markPaymentPaid(String(body.paymentId), (METHODS.includes(body.method) ? body.method : 'OTHER') as 'OTHER', session.email);
      return r.ok ? ok() : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    }
    case 'removePayment': {
      if (!body.paymentId) return bad();
      const { removePayment } = await import('@/lib/academy-payments');
      const r = await removePayment(String(body.paymentId));
      return r.ok ? ok() : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    }
    case 'refundPayment': {
      if (!body.paymentId) return bad();
      const { refundEnrolmentPayment } = await import('@/lib/academy-payments');
      const r = await refundEnrolmentPayment(String(body.paymentId), session.email);
      return r.ok ? ok() : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    }
    case 'sendActivation': {
      // Email a trainee a passwordless link into their portal.
      if (!body.studentId) return bad();
      const { sendAccessLink } = await import('@/lib/academy-auth');
      await sendAccessLink(String(body.studentId));
      return ok();
    }
    case 'resetStudentPassword': {
      // Trigger the trainee's own reset email (only sends if they have a password).
      if (!body.email) return bad();
      const { requestAcademyPasswordReset } = await import('@/lib/academy-auth');
      await requestAcademyPasswordReset(String(body.email));
      return ok();
    }
    case 'linkClient': {
      // Link a trainee to their clinic CRM Client record (by email).
      if (!body.studentId) return bad();
      const { linkStudentToClient } = await import('@/lib/academy-auth');
      const r = await linkStudentToClient(String(body.studentId));
      return r.ok ? ok({ linked: r.linked }) : bad();
    }
    case 'linkFunding': {
      // Attach a funding enquiry to an enrolment (and copy its student link).
      if (!body.id) return bad();
      const eid = (body.enrolmentId as string) || null;
      let studentId: string | null = null;
      if (eid) { const enr = await db.enrolment.findUnique({ where: { id: eid }, select: { studentId: true } }); studentId = enr?.studentId ?? null; }
      await db.fundingApplication.update({ where: { id: String(body.id) }, data: { enrolmentId: eid, ...(eid ? { studentId } : {}) } });
      return ok();
    }
    case 'setModuleRelease': {
      // BLD: per-cohort drip — set (or clear) the release date for a module on a
      // cohort. A future date locks the module until then; clearing it (null) makes
      // the module available immediately.
      const b = body as Record<string, unknown>;
      if (!b.cohortId || !b.moduleId) return bad();
      const cohortId = String(b.cohortId), moduleId = String(b.moduleId);
      const releaseAt = b.releaseAt ? new Date(b.releaseAt as string) : null;
      const existing = await db.cohortModuleRelease.findFirst({ where: { cohortId, moduleId }, select: { id: true } });
      if (!releaseAt || Number.isNaN(+releaseAt)) {
        if (existing) await db.cohortModuleRelease.delete({ where: { id: existing.id } });
        return ok();
      }
      if (existing) await db.cohortModuleRelease.update({ where: { id: existing.id }, data: { releaseAt } });
      else await db.cohortModuleRelease.create({ data: { tenantId, cohortId, moduleId, releaseAt } });
      return ok();
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
