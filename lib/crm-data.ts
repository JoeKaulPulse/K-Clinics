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
      // Clinic-local — the server runs in UTC, so an implicit-timezone render put
      // the dashboard's "today" list an hour off during BST (BLD-795).
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

// BLD-1711: `practitionerId`, when passed, restricts the result to consultations
// for a client the given practitioner has actually had a booking with — same
// scoping listClients/listBookings already apply for a PRACTITIONER session
// (BLD-1693). Consultation has no practitionerId of its own, so it goes
// through the client's bookings, same relation getClient checks below.
export async function listConsultations(status?: string, opts: { practitionerId?: string } = {}) {
  const and: Record<string, unknown>[] = [];
  if (status && status !== 'ALL') and.push({ status: status as never });
  if (opts.practitionerId) and.push({ client: { bookings: { some: { practitionerId: opts.practitionerId } } } });
  return db.consultation.findMany({
    where: and.length ? { AND: and } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { client: true },
    take: 100,
  });
}

// BLD-1603: AI "Get My Plan" analyses the model flagged for expert review
// (unclear photos or a genuinely complex case — lib/ai-consultation.ts). Never
// surfaced to staff before; this backs the "Flagged" tab on the consultations
// list. Clinical data (client identity + AI findings) — callers must gate on
// clients.clinical.view, same as the AI section on the client detail page.
export async function listFlaggedAnalyses() {
  return db.aiAnalysis.findMany({
    where: { needsExpert: true, status: 'complete' },
    orderBy: { createdAt: 'desc' },
    // Review fix (BLD-1603): explicit select, not the whole row. The list renders
    // six fields; the default row also drags findingsEnc (encrypted clinical
    // findings) and planJson across the wire for up to 100 rows, neither of which
    // is displayed. Nothing clinical is loaded for a view that cannot show it.
    select: {
      id: true, createdAt: true, summary: true, areas: true,
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 100,
  });
}

export async function countFlaggedAnalyses(): Promise<number> {
  return db.aiAnalysis.count({ where: { needsExpert: true, status: 'complete' } });
}

// BLD-1711: `practitionerId`, when passed, restricts the result to a
// consultation for a client the given practitioner has actually had a
// booking with — mirrors getClient/getBooking's guard below so a
// PRACTITIONER session can't open another Specialist's consultation by id.
export async function getConsultation(id: string, opts: { practitionerId?: string } = {}) {
  const c = await db.consultation.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true, firstName: true, lastName: true, email: true,
          bookings: { select: { practitionerId: true } },
        },
      },
      notes: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (c && opts.practitionerId && !c.client.bookings.some((b) => b.practitionerId === opts.practitionerId)) return null;
  if (c) { c.concerns = decClinical(c.concerns); c.message = decClinical(c.message); c.medicalNotes = decClinical(c.medicalNotes); }
  return c;
}

export const CLIENTS_PER_PAGE = 50;

// Paginated client list. Returns the page of rows plus the total count and page
// metadata so the admin list can show "X–Y of Z" and Prev/Next instead of
// rendering hundreds of rows in one ~9500px-tall scroll (BLD-621).
export async function listClients(opts: { q?: string; sort?: string; dir?: 'asc' | 'desc'; flag?: string; page?: number; perPage?: number; includeTest?: boolean; practitionerId?: string } = {}) {
  const { q, sort = 'created', dir = 'desc', flag } = opts;
  const perPage = Math.min(Math.max(opts.perPage ?? CLIENTS_PER_PAGE, 1), 200);
  const and: Record<string, unknown>[] = [];
  // BLD-1693: a PRACTITIONER session passes its own id here so a Specialist's
  // client list (and its total/count) is limited to clients they've actually
  // had a booking with — never the whole clinic roster. Matches the
  // practitionerId scoping BLD-1652 already applies to the calendar/dashboard.
  if (opts.practitionerId) and.push({ bookings: { some: { practitionerId: opts.practitionerId } } });
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
  const select = { id: true, firstName: true, lastName: true, email: true, phone: true, marketingOptIn: true, source: true, tags: true, createdAt: true, lastVisitAt: true } as const;
  // Requested page, clamped only to a sane minimum here — the upper bound
  // (against total pages) isn't known until the count below resolves. Fire
  // it off speculatively alongside the counts (matches getOverview's
  // Promise.all pattern above) rather than serialising on the count first.
  const reqPage = Math.max(opts.page ?? 1, 1);
  const [total, rows, hiddenTest] = await Promise.all([
    db.client.count({ where }),
    db.client.findMany({
      where,
      orderBy: { [field]: dir },
      skip: (reqPage - 1) * perPage,
      take: perPage,
      select,
    }),
    // Count of records being hidden, so the list can offer a one-click reveal.
    // BLD-1693: scoped by the same practitioner filter as the list itself —
    // otherwise a Specialist is told how many likely-test records exist
    // clinic-wide, and the "Show" link then reveals far fewer than promised.
    hidingTest
      ? db.client.count({ where: { AND: [{ tags: { has: 'likely-test' } }, ...(opts.practitionerId ? [{ bookings: { some: { practitionerId: opts.practitionerId } } }] : [])] } })
      : Promise.resolve(0),
  ]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(reqPage, pages);
  // Rare edge case: the requested page landed past the last page (e.g. the
  // result set shrank between loads). The speculative fetch above is now
  // known to be empty/wrong, so re-fetch the true last page instead of
  // returning a mismatched (page, rows) pair.
  const finalRows = page === reqPage ? rows : await db.client.findMany({
    where,
    orderBy: { [field]: dir },
    skip: (page - 1) * perPage,
    take: perPage,
    select,
  });
  return { rows: finalRows, total, page, perPage, pages, hiddenTest };
}

// BLD-1464: the caller hides CLINICAL interactions from staff without
// `clients.clinical.view` AFTER this query returns. With the row cap below
// that filter would silently empty the timeline: on a clinical-heavy client
// the 30 most recent interactions can be all-CLINICAL, so front-desk staff
// would see nothing where they used to see every non-clinical note. Apply the
// same restriction here instead, so the cap counts only rows the viewer can
// actually be shown. Defaults to the restricted view — a caller must opt in.
//
// BLD-1693: `practitionerId`, when passed, restricts the result to a client the
// given practitioner has actually had a booking with — a PRACTITIONER session
// must not be able to open another Specialist's client by guessing/typing the
// URL. Returns null (same as "not found") rather than a 403 so the detail page
// 404s exactly as it already does for a bad id, without confirming the id exists.
export async function getClient(id: string, opts: { clinical?: boolean; practitionerId?: string } = {}) {
  const c = await db.client.findUnique({
    where: { id },
    include: {
      // BLD-1464: a long-tenured client's profile used to decrypt every
      // consultation/interaction/appointment/booking on every open — capped
      // most-recent-first, mirroring the `emails: { take: 20 }` pattern below.
      consultations: { orderBy: { createdAt: 'desc' }, take: 30 },
      interactions: {
        where: opts.clinical ? undefined : { type: { not: 'CLINICAL' as const } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
      appointments: { orderBy: { scheduledAt: 'desc' }, take: 30 },
      bookings: { orderBy: { startAt: 'desc' }, take: 50 },
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
  if (c && opts.practitionerId && !c.bookings.some((b) => b.practitionerId === opts.practitionerId)) return null;
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

export async function listBookings(opts: { filter?: string; q?: string; from?: string; to?: string; practitionerId?: string } = {}) {
  const { filter = 'upcoming', q, from, to } = opts;
  const now = new Date();
  const and: Record<string, unknown>[] = [];
  // BLD-1693: same practitioner scoping as listClients above — a PRACTITIONER
  // session only ever sees its own bookings in the clinic-wide list.
  if (opts.practitionerId) and.push({ practitionerId: opts.practitionerId });
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
    // BLD-1517: the list row only renders firstName/lastName -- select just those
    // instead of pulling the full Client row (tags, notes, concerns, marketing/
    // portal/loyalty fields, decrypted special-category health fields) per booking.
    include: { client: { select: { firstName: true, lastName: true } }, items: { where: { isAddon: false }, select: { sessions: true }, take: 1 } },
    take: 300,
  });
}

// BLD-1693: `practitionerId`, when passed, restricts the result to a booking
// owned by that practitioner — mirrors getClient's guard above so a
// PRACTITIONER session can't open another Specialist's booking by id.
export async function getBooking(id: string, opts: { practitionerId?: string } = {}) {
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
  if (b && opts.practitionerId && b.practitionerId !== opts.practitionerId) return null;
  if (b) {
    b.allergyNote = decClinical(b.allergyNote);
    if (b.client) { b.client.medicalFlag = decClinical(b.client.medicalFlag); b.client.allergies = decClinical(b.client.allergies); }
  }
  return b;
}

// BLD-1211: retail orders — a flat "latest 200, non-pending" take made a past
// order unfindable once volume passed that cap. Same paginated/queryable shape
// as listClients above: search across order number/name/email, a status tab,
// and real skip/take pagination instead of a fixed row cap.
export const ORDERS_PER_PAGE = 50;

// `status` arrives straight off the query string, and Prisma throws a
// validation error (not an empty result) for a value outside the OrderStatus
// enum — which would 500 the whole Orders page on a hand-edited or stale URL.
// Anything unrecognised falls back to the default view instead.
const ORDER_STATUSES = ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED'] as const;

export async function listOrders(opts: { q?: string; status?: string; page?: number; perPage?: number } = {}) {
  const { q } = opts;
  const raw = (opts.status || '').toUpperCase();
  const status = (ORDER_STATUSES as readonly string[]).includes(raw) || raw === 'ALL' ? raw : '';
  const perPage = Math.min(Math.max(opts.perPage ?? ORDERS_PER_PAGE, 1), 200);
  const and: Record<string, unknown>[] = [];
  // Default view (no status tab picked) keeps the original behaviour of
  // hiding PENDING (abandoned/unpaid) orders; "Pending" is its own explicit tab.
  if (status && status !== 'ALL') and.push({ status });
  else if (!status) and.push({ status: { not: 'PENDING' } });
  if (q) and.push({ OR: [
    { number: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
  ] });
  const where = and.length ? { AND: and } : undefined;
  const reqPage = Math.max(opts.page ?? 1, 1);
  const [total, rows] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (reqPage - 1) * perPage,
      take: perPage,
      include: { items: true },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(reqPage, pages);
  // Same rare edge case as listClients: the requested page landed past the
  // last page (e.g. the result set shrank between loads) — re-fetch the true
  // last page rather than return a mismatched (page, rows) pair.
  const finalRows = page === reqPage ? rows : await db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * perPage,
    take: perPage,
    include: { items: true },
  });
  return { rows: finalRows, total, page, perPage, pages };
}
