import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({
  courseId: z.string().min(1),
  cohortId: z.string().optional().or(z.literal('')),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal('')),
  experience: z.string().max(2000).optional().or(z.literal('')),
  financeInterest: z.boolean().default(false),
  // BLD-1393: pathway-bundle claim carried from the bundle page's CTA. Server-
  // validated below — an unknown slug or one that doesn't contain this course
  // is ignored, never parroted into staff-facing notes.
  bundleSlug: z.string().max(80).optional().or(z.literal('')),
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Applications are not available right now.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Check your details.' }, { status: 422 });
  const d = parsed.data;
  if (d.company) return NextResponse.json({ ok: true }); // honeypot

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'academy-apply', 5, 600, 'academy'))) return NextResponse.json({ ok: false, error: 'Too many submissions — please try again shortly.' }, { status: 429 });

  const { db } = await import('@/lib/db');
  const course = await db.course.findUnique({ where: { id: d.courseId }, select: { id: true, title: true, pricePence: true, tenantId: true } });
  if (!course) return NextResponse.json({ ok: false, error: 'That course is unavailable.' }, { status: 404 });

  // Link to a signed-in trainee account if present.
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);

  // The enrolment belongs to the course's tenant (ClinicOS Ring 0).
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = course.tenantId ?? (await currentTenantId());

  // BLD-1393: the bundle page advertises a pathway price, but applications are
  // per-course — without recording the claim here, the "Save £X" promise
  // evaporated and the applicant would be enrolled at the full single-course
  // price. Validate the claimed bundle really exists and contains THIS course,
  // then record it in the enrolment notes so the team applies the bundle
  // pricing via the agreed-fee field when confirming the place.
  let bundleNote: string | null = null;
  let bundleTitle: string | null = null;
  if (d.bundleSlug) {
    try {
      const { getBundle } = await import('@/lib/academy');
      const bundle = await getBundle(d.bundleSlug);
      if (bundle) {
        const inBundle = await db.course.findFirst({ where: { id: course.id, slug: { in: bundle.courses.map((c) => c.slug) } }, select: { id: true } });
        if (inBundle) {
          bundleTitle = bundle.title;
          bundleNote = `Applied via the "${bundle.title}" pathway bundle${bundle.pricePence != null ? ` — bundle price £${(bundle.pricePence / 100).toLocaleString('en-GB')}` : ''}. Apply the pathway pricing (agreed course fee) when offering the place. (BLD-1393)`;
        }
      }
    } catch { /* invalid claim — ignore */ }
  }

  const enrolment = await db.enrolment.create({
    data: {
      tenantId,
      courseId: course.id,
      cohortId: d.cohortId || null,
      studentId: student?.id ?? null,
      applicantName: d.name, applicantEmail: d.email.toLowerCase(), applicantPhone: d.phone || null,
      experience: d.experience || null, financeInterest: d.financeInterest,
      status: 'APPLIED', pricePence: course.pricePence,
      notes: bundleNote,
    },
  });

  // In-app staff notification so applications surface in the admin (not just email).
  try {
    const { notifyStaffByPermission } = await import('@/lib/notifications');
    await notifyStaffByPermission('settings.manage', {
      kind: 'status', category: 'academy', priority: 'high',
      title: 'New academy application',
      body: `${d.name} applied for ${course.title}${bundleTitle ? ` via the "${bundleTitle}" pathway bundle — apply the bundle price` : ''}${d.financeInterest ? ' (interested in finance)' : ''}`,
      href: '/admin/academy/enrolments',
      groupKey: `academy-apply-${enrolment.id}`,
    });
  } catch { /* non-fatal */ }

  // Notify the academy + acknowledge the applicant (best-effort).
  try {
    const { sendEmail, emailShell } = await import('@/lib/email');
    const notifyTo = process.env.ACADEMY_NOTIFY_EMAIL || process.env.CLINIC_NOTIFY_EMAIL || 'support@kclinics.co.uk';
    await Promise.allSettled([
      sendEmail({ to: notifyTo, subject: `New academy application — ${course.title}`, html: emailShell({ preheader: `${d.name} applied for ${course.title}`, body: `<h1 style="font-size:22px;margin:0 0 16px;">New academy application</h1><p><strong>${escapeHtml(d.name)}</strong> applied for <strong>${escapeHtml(course.title)}</strong>.</p><p>Email: ${escapeHtml(d.email)}<br>Phone: ${escapeHtml(d.phone || '—')}<br>Finance (Clearpay) interest: ${d.financeInterest ? 'Yes' : 'No'}</p>${bundleTitle ? `<p><strong>Pathway bundle:</strong> ${escapeHtml(bundleTitle)} — apply the bundle price when offering the place.</p>` : ''}<p>Experience:<br>${escapeHtml(d.experience || '—')}</p>` }) }),
      sendEmail({ to: d.email, subject: `Your application — ${course.title}`, html: emailShell({ preheader: `We've received your application for ${course.title}`, body: `<h1 style="font-size:24px;margin:0 0 16px;">Thank you, ${escapeHtml(d.name.split(' ')[0])}.</h1><p>We've received your application for <strong>${escapeHtml(course.title)}</strong> at K Academy. Our team will be in touch shortly to confirm your place${d.financeInterest ? ', discuss Clearpay financing' : ''} and next steps.</p><p>With warmth,<br>The K Academy team</p>` }) }),
    ]);
  } catch { /* email failure must not fail the application */ }

  return NextResponse.json({ ok: true, enrolmentId: enrolment.id });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
}
