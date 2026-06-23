import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({
  vacancyId: z.string().optional().or(z.literal('')),
  roleTitle: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal('')),
  coverNote: z.string().max(4000).optional().or(z.literal('')),
  cvUrl: z.string().max(500).optional().or(z.literal('')),
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Applications are not available right now.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Check your details.' }, { status: 422 });
  const d = parsed.data;
  if (d.company) return NextResponse.json({ ok: true });

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'careers-apply', 5, 600))) return NextResponse.json({ ok: false, error: 'Too many submissions — please try again shortly.' }, { status: 429 });

  const { db } = await import('@/lib/db');
  const { currentTenantId } = await import('@/lib/tenant');
  const tenantId = await currentTenantId();
  const app = await db.jobApplication.create({
    data: { tenantId, vacancyId: d.vacancyId || null, roleTitle: d.roleTitle, name: d.name, email: d.email.toLowerCase(), phone: d.phone || null, coverNote: d.coverNote || null, cvUrl: d.cvUrl || null },
  });

  try {
    const { sendEmail, emailShell } = await import('@/lib/email');
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
    const notifyTo = process.env.CAREERS_NOTIFY_EMAIL || process.env.CLINIC_NOTIFY_EMAIL || 'support@kclinics.co.uk';
    await Promise.allSettled([
      sendEmail({ to: notifyTo, subject: `New job application — ${d.roleTitle}`, html: emailShell({ preheader: `${d.name} applied for ${d.roleTitle}`, body: `<h1 style="font-size:22px;margin:0 0 16px;">New application</h1><p><strong>${esc(d.name)}</strong> applied for <strong>${esc(d.roleTitle)}</strong>.</p><p>Email: ${esc(d.email)}<br>Phone: ${esc(d.phone || '—')}${d.cvUrl ? `<br>CV: ${esc(d.cvUrl)}` : ''}</p>${d.coverNote ? `<p>${esc(d.coverNote)}</p>` : ''}` }) }),
      sendEmail({ to: d.email, subject: `Your application — ${d.roleTitle}`, html: emailShell({ preheader: `We've received your application`, body: `<h1 style="font-size:24px;margin:0 0 16px;">Thank you, ${esc(d.name.split(' ')[0])}.</h1><p>We've received your application for <strong>${esc(d.roleTitle)}</strong> at KClinics. If your experience matches what we're looking for, our team will be in touch.</p><p>With warmth,<br>The KClinics team</p>` }) }),
    ]);
  } catch { /* email failure must not fail the application */ }

  return NextResponse.json({ ok: true, applicationId: app.id });
}
