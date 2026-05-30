import 'server-only';
import { db } from './db';

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
      db.booking.aggregate({ _sum: { chargedPence: true }, where: { chargedAt: { gte: d30 } } }),
      db.booking.aggregate({ _sum: { chargedPence: true }, where: { chargedAt: { gte: d60, lt: d30 } } }),
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

  const rev30 = charged30._sum.chargedPence ?? 0;
  const revPrev = charged60to30._sum.chargedPence ?? 0;
  const revTrend = revPrev > 0 ? Math.round(((rev30 - revPrev) / revPrev) * 100) : null;
  const conversion = consults30 > 0 ? Math.round((bookingsFromConsult30 / consults30) * 100) : 0;

  return {
    rev30,
    revTrend,
    bookings30,
    upcomingCount,
    conversion,
    newClients30,
    today: todays.map((b) => ({
      id: b.id,
      time: b.startAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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

export async function listClients(q?: string) {
  return db.client.findMany({
    where: q
      ? { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function getClient(id: string) {
  return db.client.findUnique({
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
    },
  });
}

export async function listBookings(filter?: string) {
  const now = new Date();
  let where: Record<string, unknown> | undefined;
  if (filter === 'upcoming') where = { startAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } };
  else if (filter === 'past') where = { startAt: { lt: now } };
  else if (filter && filter !== 'ALL') where = { status: filter };
  return db.booking.findMany({
    where,
    orderBy: { startAt: filter === 'past' ? 'desc' : 'asc' },
    include: { client: true },
    take: 200,
  });
}

export async function getBooking(id: string) {
  return db.booking.findUnique({ where: { id }, include: { client: true } });
}
