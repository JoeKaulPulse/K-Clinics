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
