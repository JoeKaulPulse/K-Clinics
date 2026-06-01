import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

type Hit = { id: string; title: string; sub?: string; href: string };
type Group = { type: string; label: string; results: Hit[] };

// Global admin search across every parsable entity in the database. Each entity
// group is only searched if the signed-in user holds the relevant permission,
// and each query degrades to [] on error so one bad source never breaks search.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, groups: [] }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, groups: [] }, { status: 403 });

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ ok: true, groups: [] });

  const { db } = await import('@/lib/db');
  const ci = { contains: q, mode: 'insensitive' as const };
  const nameOr = { OR: [{ firstName: ci }, { lastName: ci }] };
  const can = (p: string) => sessionCan(session, p);
  const safe = async (allowed: boolean, fn: () => Promise<Hit[]>): Promise<Hit[]> => (allowed ? fn().catch(() => []) : []);
  const fullName = (a?: string | null, b?: string | null, fallback = '') => [a, b].filter(Boolean).join(' ') || fallback;
  const snip = (s?: string | null, n = 60) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : undefined);

  const [clients, bookings, consultations, reviews, vouchers, discounts, staff, students, courses, services, stock, vacancies, applications] = await Promise.all([
    safe(can('clients.view'), async () =>
      (await db.client.findMany({ where: { OR: [{ firstName: ci }, { lastName: ci }, { email: ci }, { phone: { contains: q } }] }, orderBy: { updatedAt: 'desc' }, take: 6, select: { id: true, firstName: true, lastName: true, email: true, medicalFlag: true } }))
        .map((c) => ({ id: c.id, title: fullName(c.firstName, c.lastName, c.email) + (c.medicalFlag ? ' ⚠' : ''), sub: c.email, href: `/admin/clients/${c.id}` }))),
    safe(can('bookings.view'), async () =>
      (await db.booking.findMany({ where: { OR: [{ treatmentTitle: ci }, { client: nameOr }, { client: { email: ci } }] }, orderBy: { startAt: 'desc' }, take: 6, select: { id: true, treatmentTitle: true, startAt: true, status: true, client: { select: { firstName: true, lastName: true } } } }))
        .map((b) => ({ id: b.id, title: b.treatmentTitle, sub: `${fullName(b.client.firstName, b.client.lastName)} · ${b.startAt.toLocaleDateString('en-GB')} · ${b.status.toLowerCase()}`, href: `/admin/bookings/${b.id}` }))),
    safe(can('consultations.view'), async () =>
      (await db.consultation.findMany({ where: { OR: [{ client: nameOr }, { concerns: ci }, { message: ci }] }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, concerns: true, client: { select: { firstName: true, lastName: true } } } }))
        .map((c) => ({ id: c.id, title: fullName(c.client.firstName, c.client.lastName, 'Consultation'), sub: snip(c.concerns), href: `/admin/consultations` }))),
    safe(can('reviews.manage'), async () =>
      (await db.review.findMany({ where: { OR: [{ title: ci }, { body: ci }, { client: nameOr }] }, orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, rating: true, body: true, client: { select: { firstName: true, lastName: true } } } }))
        .map((r) => ({ id: r.id, title: `${fullName(r.client.firstName, r.client.lastName, 'Review')}${r.rating ? ` · ${r.rating}★` : ''}`, sub: snip(r.body), href: `/admin/reviews` }))),
    safe(can('finance.view'), async () =>
      (await db.giftVoucher.findMany({ where: { OR: [{ code: ci }, { purchaserName: ci }, { purchaserEmail: ci }, { recipientName: ci }, { recipientEmail: ci }] }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, code: true, purchaserName: true, status: true } }))
        .map((v) => ({ id: v.id, title: v.code, sub: `${v.purchaserName} · ${v.status.toLowerCase()}`, href: `/admin/gift-vouchers` }))),
    safe(can('discounts.manage'), async () =>
      (await db.discountClaim.findMany({ where: { OR: [{ code: ci }, { emailNorm: ci }] }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, code: true, percent: true, status: true } }))
        .map((d: { id: string; code: string; percent: number; status: string }) => ({ id: d.id, title: d.code, sub: `${d.percent}% · ${d.status.toLowerCase()}`, href: `/admin/discounts` }))),
    safe(can('staff.view'), async () =>
      (await db.adminUser.findMany({ where: { OR: [{ name: ci }, { email: ci }] }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, email: true, role: true } }))
        .map((u) => ({ id: u.id, title: u.name || u.email, sub: `${u.email} · ${u.role.toLowerCase()}`, href: `/admin/staff` }))),
    safe(can('settings.manage'), async () =>
      (await db.academyStudent.findMany({ where: { OR: [{ firstName: ci }, { lastName: ci }, { email: ci }] }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, firstName: true, lastName: true, email: true } }))
        .map((s) => ({ id: s.id, title: fullName(s.firstName, s.lastName, s.email), sub: s.email, href: `/admin/academy` }))),
    safe(can('settings.manage'), async () =>
      (await db.course.findMany({ where: { OR: [{ title: ci }, { level: ci }] }, orderBy: { order: 'asc' }, take: 5, select: { id: true, title: true, level: true } }))
        .map((c) => ({ id: c.id, title: c.title, sub: c.level || undefined, href: `/admin/academy/${c.id}` }))),
    safe(can('settings.manage'), async () =>
      (await db.service.findMany({ where: { name: ci }, orderBy: { order: 'asc' }, take: 5, select: { id: true, name: true, category: true } }))
        .map((s) => ({ id: s.id, title: s.name, sub: s.category || undefined, href: `/admin/services` }))),
    safe(can('inventory.view'), async () =>
      (await db.stockItem.findMany({ where: { OR: [{ name: ci }, { brand: ci }, { sku: ci }] }, orderBy: { name: 'asc' }, take: 5, select: { id: true, name: true, brand: true, sku: true } }))
        .map((s) => ({ id: s.id, title: s.name, sub: [s.brand, s.sku].filter(Boolean).join(' · ') || undefined, href: `/admin/inventory` }))),
    safe(can('settings.manage'), async () =>
      (await db.vacancy.findMany({ where: { OR: [{ title: ci }, { department: ci }] }, orderBy: { order: 'asc' }, take: 4, select: { id: true, title: true, department: true } }))
        .map((v) => ({ id: v.id, title: v.title, sub: v.department || 'Vacancy', href: `/admin/careers` }))),
    safe(can('settings.manage'), async () =>
      (await db.jobApplication.findMany({ where: { OR: [{ name: ci }, { email: ci }] }, orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, name: true, email: true } }))
        .map((a) => ({ id: a.id, title: a.name, sub: a.email, href: `/admin/careers` }))),
  ]);

  const groups: Group[] = [
    { type: 'clients', label: 'Clients', results: clients },
    { type: 'bookings', label: 'Bookings', results: bookings },
    { type: 'consultations', label: 'Consultations', results: consultations },
    { type: 'reviews', label: 'Reviews', results: reviews },
    { type: 'vouchers', label: 'Gift vouchers', results: vouchers },
    { type: 'discounts', label: 'Discounts', results: discounts },
    { type: 'staff', label: 'Staff', results: staff },
    { type: 'students', label: 'Academy students', results: students },
    { type: 'courses', label: 'Courses', results: courses },
    { type: 'services', label: 'Services', results: services },
    { type: 'stock', label: 'Inventory', results: stock },
    { type: 'vacancies', label: 'Vacancies', results: vacancies },
    { type: 'applications', label: 'Applications', results: applications },
  ].filter((g) => g.results.length > 0);

  return NextResponse.json({ ok: true, groups });
}
