import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';
import { ROUTE_BY_KEY, COURSE_LEVEL_LABEL, type FundingRouteKey, type CourseLevelBand } from '@/lib/funding';

export const runtime = 'nodejs';

const ROUTE_KEYS = Object.keys(ROUTE_BY_KEY) as [FundingRouteKey, ...FundingRouteKey[]];
const LEVELS = Object.keys(COURSE_LEVEL_LABEL) as [CourseLevelBand, ...CourseLevelBand[]];

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal('')),
  message: z.string().max(2000).optional().or(z.literal('')),
  route: z.enum(ROUTE_KEYS).default('course_finance'),
  eligibleRoutes: z.array(z.enum(ROUTE_KEYS)).max(8).default([]),
  courseLevel: z.enum(LEVELS).optional().or(z.literal('')),
  age19Plus: z.boolean().optional(),
  residencyOk: z.boolean().optional(),
  lowIncome: z.boolean().optional(),
  priorLevel3: z.boolean().optional(),
  location: z.enum(['islington', 'london', 'england', 'other']).optional(),
  employment: z.enum(['unemployed', 'employed', 'self_employed', 'other']).optional(),
  source: z.string().max(120).optional().or(z.literal('')),
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Funding applications are not available right now.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Check your details.' }, { status: 422 });
  const d = parsed.data;
  if (d.company) return NextResponse.json({ ok: true }); // honeypot

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'academy-funding', 5, 600, 'academy'))) return NextResponse.json({ ok: false, error: 'Too many submissions — please try again shortly.' }, { status: 429 });

  const { db } = await import('@/lib/db');
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = await currentTenantId();

  const app = await db.fundingApplication.create({
    data: {
      tenantId,
      name: d.name,
      email: d.email.toLowerCase(),
      phone: d.phone || null,
      message: d.message || null,
      route: d.route,
      eligibleRoutes: d.eligibleRoutes,
      courseLevel: d.courseLevel ? COURSE_LEVEL_LABEL[d.courseLevel] : null,
      age19Plus: d.age19Plus ?? null,
      residencyOk: d.residencyOk ?? null,
      londonResident: d.location ? d.location === 'london' || d.location === 'islington' : null,
      islingtonResident: d.location ? d.location === 'islington' : null,
      employmentStatus: d.employment ?? null,
      lowIncome: d.lowIncome ?? null,
      priorLevel3: d.priorLevel3 ?? null,
      source: d.source || null,
    },
  });

  // Notify the academy + acknowledge the applicant (best-effort).
  try {
    const { sendEmail, emailShell } = await import('@/lib/email');
    const notifyTo = process.env.ACADEMY_NOTIFY_EMAIL || process.env.CLINIC_NOTIFY_EMAIL || 'info@kclinics.co.uk';
    const routeName = ROUTE_BY_KEY[d.route]?.name ?? d.route;
    const eligible = d.eligibleRoutes.map((k) => ROUTE_BY_KEY[k]?.name ?? k).join(', ') || '—';
    await Promise.allSettled([
      sendEmail({
        to: notifyTo,
        subject: `New funding enquiry — ${routeName}`,
        html: emailShell({
          preheader: `${d.name} asked about funding (${routeName})`,
          body: `<h1 style="font-size:22px;margin:0 0 16px;">New academy funding enquiry</h1><p><strong>${escapeHtml(d.name)}</strong> asked about <strong>${escapeHtml(routeName)}</strong>.</p><p>Email: ${escapeHtml(d.email)}<br>Phone: ${escapeHtml(d.phone || '—')}<br>Course level: ${escapeHtml(d.courseLevel ? COURSE_LEVEL_LABEL[d.courseLevel] : '—')}</p><p><strong>Self-check:</strong><br>Aged 19+: ${yn(d.age19Plus)}<br>UK/EU residency 3yr+: ${yn(d.residencyOk)}<br>Location: ${escapeHtml(d.location || '—')}<br>Employment: ${escapeHtml(d.employment || '—')}<br>Low income/unemployed: ${yn(d.lowIncome)}<br>Already holds Level 3: ${yn(d.priorLevel3)}</p><p>Routes flagged as a likely fit: ${escapeHtml(eligible)}</p><p>Message:<br>${escapeHtml(d.message || '—')}</p>`,
        }),
      }),
      sendEmail({
        to: d.email,
        subject: 'Your funding enquiry — K Academy',
        html: emailShell({
          preheader: 'We have received your funding enquiry',
          body: `<h1 style="font-size:24px;margin:0 0 16px;">Thank you, ${escapeHtml(d.name.split(' ')[0])}.</h1><p>We have received your enquiry about help to pay for your training at K Academy. Our team will be in touch shortly to talk through your options${routeName ? ` — starting with <strong>${escapeHtml(routeName)}</strong>` : ''} and what happens next.</p><p>In the meantime, there is nothing more you need to do.</p><p>With warmth,<br>The K Academy team</p>`,
        }),
      }),
    ]);
  } catch { /* email failure must not fail the application */ }

  return NextResponse.json({ ok: true, id: app.id });
}

function yn(v: boolean | undefined) {
  return v === undefined ? '—' : v ? 'Yes' : 'No';
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
}
