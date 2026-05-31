import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-time setup helper to create reviewable accounts WITHOUT email/Resend.
 * Guarded by the CRON_SECRET. Idempotent — safe to call repeatedly; it sets the
 * given passwords each time. Call from the browser:
 *
 *   /api/setup?secret=YOUR_CRON_SECRET
 *
 * Optionally pass &clientPw=… &adminPw=… &clinicianPw=… &email=… to customise.
 */
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'CRM not enabled.' }, { status: 503 });

  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const expected = process.env.CRON_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorised. Pass ?secret=<your CRON_SECRET>.' }, { status: 401 });
  }

  const clientEmail = (url.searchParams.get('email') || 'client@kclinics.test').toLowerCase();
  const clientPw = url.searchParams.get('clientPw') || 'ClientDemo123!';
  const adminEmail = (url.searchParams.get('adminEmail') || 'admin@kclinics.test').toLowerCase();
  const adminPw = url.searchParams.get('adminPw') || 'AdminDemo123!';
  const clinEmail = (url.searchParams.get('clinicianEmail') || 'clinician@kclinics.test').toLowerCase();
  const clinPw = url.searchParams.get('clinicianPw') || 'ClinicianDemo123!';

  const { db } = await import('@/lib/db');
  const { hashPassword } = await import('@/lib/auth');

  // ── Client portal account ──
  await db.client.upsert({
    where: { email: clientEmail },
    update: { passwordHash: await hashPassword(clientPw), portalActive: true, firstName: 'Demo', lastName: 'Client' },
    create: { email: clientEmail, firstName: 'Demo', lastName: 'Client', passwordHash: await hashPassword(clientPw), portalActive: true, source: 'setup' },
  });

  // ── Admin (OWNER) ──
  await db.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash: await hashPassword(adminPw), role: 'OWNER', active: true, name: 'Clinic Owner' },
    create: { email: adminEmail, name: 'Clinic Owner', role: 'OWNER', passwordHash: await hashPassword(adminPw), active: true, createdBy: 'setup' },
  });

  // ── Clinician (PRACTITIONER) with a Mon–Sat 09:00–18:00 schedule ──
  const clinician = await db.adminUser.upsert({
    where: { email: clinEmail },
    update: { passwordHash: await hashPassword(clinPw), role: 'PRACTITIONER', active: true, isClinician: true, name: 'Dr Demo Clinician', title: 'Aesthetic Doctor', color: '#a98a6d' },
    create: { email: clinEmail, name: 'Dr Demo Clinician', role: 'PRACTITIONER', passwordHash: await hashPassword(clinPw), active: true, isClinician: true, title: 'Aesthetic Doctor', color: '#a98a6d', createdBy: 'setup' },
  });
  // Give them a default weekly schedule if none exists.
  const existing = await db.staffSchedule.count({ where: { staffId: clinician.id } });
  if (existing === 0) {
    await db.staffSchedule.createMany({
      data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ staffId: clinician.id, dayOfWeek, startMin: 9 * 60, endMin: 18 * 60 })),
    });
  }

  return NextResponse.json({
    ok: true,
    message: 'Accounts ready. Sign in with the details below.',
    client: { url: '/account/login', email: clientEmail, password: clientPw },
    admin: { url: '/admin/login', email: adminEmail, password: adminPw, role: 'OWNER' },
    clinician: { url: '/admin/login', email: clinEmail, password: clinPw, role: 'PRACTITIONER (bookable clinician)' },
    note: 'Delete this endpoint or rotate CRON_SECRET before real launch.',
  });
}
