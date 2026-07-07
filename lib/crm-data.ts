import 'server-only';
import { db } from './db';
import { decClinical } from './clinical-crypto';
import { CLINIC_TZ } from './clinic-time';

export async function getOverview() {
  const [clients, newConsults, weekConsults, marketingClients, recentConsults, upcomingBirthdays] = await Promise.all([
    db.client.count(),
    db.consultation.count({ where: { status: 'NEW' } }),
    db.consultation.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
    db.client.count({ where: { marketingOptIn: true, unsubscribed: false } }),
    db.consultation.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { client: true },
    }),
    birthdaysInDays(14),
  ]);
  return { clients, newConsults, weekConsults, marketingClients, recentConsults, upcomingBirthdays };
}

/** KPI analytics for the admin overview. */
export async function getAnalytics() {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 864e5);
  const d60 = new Date(now.getTime() - 60 * 864e5);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const [charged30, charged60to30, bookings30, consults30, bookingsFromConsult30, upcomingCount, todays, newClients30] =
    await Promise.all([
      db.booking.aggregate({ _sum: { chargedPence: true, refundedPence: true }, where: { chargedAt: { gte: d30 } } }),
      db.booking.aggregate({ _sum: { chargedPence: true, refundedPence: true }, where: { chargedAt: { gte: d60, lt: d30 } } }),
      db.booking.count({ where: { createdAt: { gte: d30 } } }),
      db.consultation.count({ where: { createdAt: { gte: d30 } } }),
      db.consultation.count({ where: { createdAt: { gte: d30 }, status: 'BOOKED' } }),
      db.booking.count({ where: { status: 'CONFIRMED', startAt: { gte: now } } }),
      db.booking.findMany({
        where: { startAt: { gte: todayStart, lte: todayEnd }, status: { in: ['CONFIRMED', 'PENDING', 'COMPLETED'] } },
        orderBy: { startAt: 'asc' },
        include: { client: true },
      }),
      db.client.count({ where: { createdAt: { gte: d30 } } }),
    ]);

  // Net revenue — refunds reduce the figure for the period the sale was charged.
  const rev30 = (charged30._sum.chargedPence ?? 0) - (charged30._sum.refundedPence ?? 0);
  const revPrev = (charged60to30._sum.chargedPence ?? 0) - (charged60to30._sum.refundedPence ?? 0);
  const revTrend = revPrev > 0 ? Math.round(((rev30 - revPrev) / revPrev) * 100) : null;
  const conversion = consults30 > 0 ? Math.round((bookingsFromConsult30 / consults30) * 100) : 0;

  // Daily revenue series (last 14 days) + top treatments (30 days) for charts.
  const d14 = new Date(now.getTime() - 13 * 864e5); d14.setHours(0, 0, 0, 0);
  const chargedRows = await db.booking.findMany({
    where: { chargedAt: { gte: d14 }, chargedPence: { not: null } },
    select: { chargedAt: true, chargedPence: true, refundedPence: true },
  });
  const series: { label: string; value: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(d14.getTime() + i * 864e5);
    const next = new Date(day.getTime() + 864e5);
    const total = chargedRows
      .filter((r) => r.chargedAt && r.chargedAt >= day && r.chargedAt < next)
      .reduce((s, r) => s + (r.chargedPence ?? 0) - (r.refundedPence ?? 0), 0);
    series.push({ label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), value: total });
  }

  const treatmentRows = await db.booking.groupBy({
    by: ['treatmentTitle'],
    where: { createdAt: { gte: d30 } },
    _count: { treatmentTitle: true },
    orderBy: { _count: { treatmentTitle: 'desc' } },
    take: 5,
  });
  const topTreatments = treatmentRows.map((t) => ({ name: t.treatmentTitle, count: t._count.treatmentTitle }));

  return {
    rev30,
    revTrend,
    bookings30,
    upcomingCount,
    conversion,
    newClients30,
    series,
    topTreatments,
    today: todays.map((b) => ({
      id: b.id,
      time: b.startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: CLINIC_TZ }),
      treatment: b.treatmentTitle,
      client: [b.client.firstName, b.client.lastName].filter(Boolean).join(' '),
      clientId: b.clientId,
      status: b.status,
    })),
  };
}

async function birthdaysInDays(days: number) {
  // DOB stored with arbitrary year; match upcoming month/day window in JS.
  const withDob = await db.client.findMany({
    where: { dob: { not: null } },
    select: { id: true, firstName: true, lastName: true, dob: true },
  });
  const today = new Date();
  const out: { id: string; name: string; date: string; inDays: number }[] = [];
  for (const c of withDob) {
    if (!c.dob) continue;
    const next = new Date(today.getFullYear(), c.dob.getMonth(), c.dob.getDate());
    if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(today.getFullYear() + 1);
    const inDays = Math.round((next.getTime() - today.setHours(0, 0, 0, 0)) / 864e5);
    if (inDays <= days) out.push({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' '), date: next.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), inDays });
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

export async function listConsultations(status?: string) {
  return db.consultation.findMany({
    where: status && status !== 'ALL' ? { status: status as never } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { client: true },
    take: 100,
  });
}

export async function getConsultation(id: string) {
  const c = await db.consultation.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      notes: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (c) { c.concerns = decClinical(c.concerns); c.message = decClinical(c.message); c.medicalNotes = decClinical(c.medicalNotes); }
  return c;
}

export const CLIENTS_PER_PAGE = 50;

// Paginated client list. Returns the page of rows plus the total count and page
// metadata so the admin list can show "X–Y of Z" and Prev/Next instead of
// rendering hundreds of rows in one ~9500px-tall scroll (BLD-621).
export async function listClients(opts: { q?: string; sort?: string; dir?: 'asc' | 'desc'; flag?: string; page?: number; perPage?: number; includeTest?: boolean } = {}) {
  const { q, sort = 'created', dir = 'desc', flag } = opts;
  const perPage = Math.min(Math.max(opts.perPage ?? CLIENTS_PER_PAGE, 1), 200);
  const and: Record<string, unknown>[] = [];
  if (q) and.push({ OR: [
    { firstName: { contains: q, mode: 'insensitive' } },
    { lastName: { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
    { phone: { contains: q, mode: 'insensitive' } },
  ] });
  if (flag === 'optin') and.push({ marketingOptIn: true });
  else if (flag === 'review') and.push({ tags: { has: 'needs-name-review' } });
  else if (flag === 'likelytest') and.push({ tags: { has: 'likely-test' } });
  else if (flag === 'wordpress') and.push({ source: 'wordpress' });
  // BLD-561: hide records tagged as likely test/junk by default so they don't
  // clutter the list, search or count. Skipped when explicitly reviewing them
  // (the "Likely test/junk" filter) or when the caller opts to include them.
  const hidingTest = !opts.includeTest && flag !== 'likelytest';
  if (hidingTest) and.push({ NOT: { tags: { has: 'likely-test' } } });
  const SORTS: Record<string, string> = { name: 'firstName', email: 'email', created: 'createdAt', visit: 'lastVisitAt' };
  const field = SORTS[sort] || 'createdAt';
  const where = and.length ? { AND: and } : undefined;
  const total = await db.client.count({ where });
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(opts.page ?? 1, 1), pages);
  const rows = await db.client.findMany({
    where,
    orderBy: { [field]: dir },
    skip: (page - 1) * perPage,
    take: perPage,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, marketingOptIn: true, source: true, tags: true, createdAt: true, lastVisitAt: true },
  });
  // Count of records being hidden, so the list can offer a one-click reveal.
  const hiddenTest = hidingTest ? await db.client.count({ where: { tags: { has: 'likely-test' } } }) : 0;
  return { rows, total, page, perPage, pages, hiddenTest };
}

export async function getClient(id: string) {
  const c = await db.client.findUnique({
    where: { id },
    include: {
      consultations: { orderBy: { createdAt: 'desc' } },
      interactions: { orderBy: { createdAt: 'desc' } },
      appointments: { orderBy: { scheduledAt: 'desc' } },
      bookings: { orderBy: { startAt: 'desc' } },
      emails: { orderBy: { createdAt: 'desc' }, take: 20 },
      assessments: {
        orderBy: { submittedAt: 'desc' },
        select: { id: true, type: true, version: true, submittedAt: true, questionnaireKey: true, supersedesId: true },
      },
      discountClaims: { orderBy: { createdAt: 'desc' } },
      tasks: {
        where: { status: 'OPEN' },
        orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        include: { assignee: { select: { name: true, email: true } } },
      },
    },
  });
  if (c) {
    // Decrypt the at-rest clinical/contact free-text for display (tolerant of legacy plaintext).
    c.medicalFlag = decClinical(c.medicalFlag);
    c.allergies = decClinical(c.allergies);
    for (const con of c.consultations) { con.concerns = decClinical(con.concerns); con.message = decClinical(con.message); con.medicalNotes = decClinical(con.medicalNotes); }
    for (const b of c.bookings) { b.allergyNote = decClinical(b.allergyNote); }
    // BLD-127: interaction notes (free-text, special-category) are encrypted at rest.
    for (const it of c.interactions) { it.detail = decClinical(it.detail); }
  }
  return c;
}

export async function listBookings(opts: { filter?: string; q?: string; from?: string; to?: string } = {}) {
  const { filter = 'upcoming', q, from, to } = opts;
  const now = new Date();
  const and: Record<string, unknown>[] = [];
  if (filter === 'upcoming') { and.push({ startAt: { gte: now } }, { status: { in: ['PENDING', 'CONFIRMED'] } }); }
  else if (filter === 'past') and.push({ startAt: { lt: now } });
  else if (filter && filter !== 'ALL') and.push({ status: filter });
  if (from) { const d = new Date(from); if (!isNaN(+d)) and.push({ startAt: { gte: d } }); }
  if (to) { const d = new Date(to); if (!isNaN(+d)) { d.setHours(23, 59, 59, 999); and.push({ startAt: { lte: d } }); } }
  if (q) and.push({ OR: [
    { treatmentTitle: { contains: q, mode: 'insensitive' } },
    { client: { firstName: { contains: q, mode: 'insensitive' } } },
    { client: { lastName: { contains: q, mode: 'insensitive' } } },
    { client: { email: { contains: q, mode: 'insensitive' } } },
  ] });
  return db.booking.findMany({
    where: and.length ? { AND: and } : undefined,
    orderBy: { startAt: filter === 'past' ? 'desc' : 'asc' },
    // Include the primary line item's booked session count so the list can flag courses.
    include: { client: true, items: { where: { isAddon: false }, select: { sessions: true }, take: 1 } },
    take: 300,
  });
}

export async function getBooking(id: string) {
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          assessments: {
            where: { supersedesId: null },
            orderBy: { submittedAt: 'desc' },
            select: { id: true, type: true, questionnaireKey: true, submittedAt: true },
          },
        },
      },
      practitioner: { select: { name: true, email: true } },
      auditEvents: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (b) {
    b.allergyNote = decClinical(b.allergyNote);
    if (b.client) { b.client.medicalFlag = decClinical(b.client.medicalFlag); b.client.allergies = decClinical(b.client.allergies); }
  }
  return b;
}
