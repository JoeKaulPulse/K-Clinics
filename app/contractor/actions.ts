'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { randomSecret, secretMatches } from '@/lib/kiosk';
import { rateLimit } from '@/lib/security/rate-limit';

// PRJ-63 — PUBLIC contractor reception self-onboarding.
//
// SECURITY: this surface is deliberately isolated from auth. It NEVER creates an
// AdminUser, never mints a session/JWT, never grants a permission. A Contractor
// is a plain data row. Visit auth is a capability secret carried in an httpOnly
// cookie ("<visitId>.<secret>"); we look the visit up by its PK and compare the
// secret in timing-safe fashion (lib/kiosk secretMatches). We never trust a
// contractorId supplied by the client. The on-site view exposes ONLY the
// contractor's own name, their own assigned ContractorTask rows, FacilityDoc
// rows and the visit timer — never client, clinical, financial or staff data.

const VISIT_COOKIE = 'kc_contractor_visit';
// A visit cookie lives for the working day; the on-site view re-verifies the
// secret and the open/closed state on every load, so this is only an outer cap.
const VISIT_COOKIE_MAX_AGE = 60 * 60 * 16; // 16h

const MAX_FIELD = 120;
const cap = (s: unknown, n = MAX_FIELD) => String(s ?? '').trim().slice(0, n);
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Best-effort client IP for abuse rate-limiting only. Never stored. */
async function clientIpKey(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || 'unknown';
  return h.get('x-real-ip') || 'unknown';
}

export type ContractorMatch = { id: string; name: string; company: string | null };

function setVisitCookie(visitId: string, secret: string) {
  // httpOnly + Secure (prod) + SameSite=Lax. The value is the capability secret;
  // it is never logged and never exposed to client JS.
  return cookies().then((c) =>
    c.set(VISIT_COOKIE, `${visitId}.${secret}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: VISIT_COOKIE_MAX_AGE,
    }),
  );
}

/** Read + verify the visit cookie. Returns the OPEN visit + contractor, or null.
 *  Looks up by PK then timing-safe-compares the secret — contractorId is taken
 *  from the row, never the client. Used by the on-site view and write actions. */
export async function currentVisit(): Promise<
  | { visit: { id: string; contractorId: string; checkedInAt: Date }; contractor: { id: string; name: string; status: 'PENDING' | 'APPROVED' | 'BLOCKED' } }
  | null
> {
  const raw = (await cookies()).get(VISIT_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const provided = raw.slice(dot + 1);
  if (!id || !provided) return null;

  const visit = await db.contractorVisit.findUnique({
    where: { id },
    select: { id: true, contractorId: true, secret: true, checkedInAt: true, checkedOutAt: true },
  });
  if (!visit) return null;
  if (visit.checkedOutAt) return null; // ended visits no longer authorise the view
  if (!secretMatches(visit.secret, provided)) return null;

  const contractor = await db.contractor.findUnique({
    where: { id: visit.contractorId },
    select: { id: true, name: true, status: true },
  });
  if (!contractor) return null;
  if (contractor.status === 'BLOCKED') return null; // barred mid-visit -> locked out

  return {
    visit: { id: visit.id, contractorId: visit.contractorId, checkedInAt: visit.checkedInAt },
    contractor,
  };
}

/** Anti-enumeration identify search. Requires >= 2 chars; matches email exact
 *  (case-insensitive) OR name contains; excludes BLOCKED; caps at 8; returns
 *  ONLY { id, name, company } — never email/phone. */
export async function searchContractors(query: string): Promise<ContractorMatch[]> {
  if (!(await getSetting('contractor_checkin_enabled'))) return [];
  // Anti-enumeration / scraping: cap public searches per IP (fails open).
  const rl = await rateLimit(`contractor-search:${await clientIpKey()}`, 30, 60);
  if (!rl.allowed) return [];
  const q = cap(query, 80);
  if (q.length < 2) return [];
  const rows = await db.contractor.findMany({
    where: {
      status: { not: 'BLOCKED' },
      OR: [
        { email: { equals: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, company: true },
    take: 8,
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, company: r.company }));
}

async function openVisit(contractorId: string): Promise<{ id: string; secret: string }> {
  const secret = randomSecret();
  const visit = await db.contractorVisit.create({
    data: { contractorId, secret },
    select: { id: true },
  });
  return { id: visit.id, secret };
}

/** Check in an existing (PENDING or APPROVED) contractor by id. BLOCKED may not. */
export async function checkInExisting(contractorId: string): Promise<void> {
  if (!(await getSetting('contractor_checkin_enabled'))) redirect('/contractor');
  // Cap visit creation per IP so the public QR can't be used to flood visits.
  const rl = await rateLimit(`contractor-checkin:${await clientIpKey()}`, 20, 60);
  if (!rl.allowed) redirect('/contractor?e=busy');
  const id = cap(contractorId, 60);
  const contractor = await db.contractor.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!contractor || contractor.status === 'BLOCKED') redirect('/contractor?e=blocked');
  const { id: visitId, secret } = await openVisit(contractor.id);
  await setVisitCookie(visitId, secret);
  redirect('/contractor/site');
}

/** Register a brand-new contractor (status PENDING) and check them in. */
export async function registerAndCheckIn(formData: FormData): Promise<void> {
  if (!(await getSetting('contractor_checkin_enabled'))) redirect('/contractor');
  // Cap new-profile creation per IP so registration can't be used to spam rows.
  const rl = await rateLimit(`contractor-register:${await clientIpKey()}`, 8, 60 * 60);
  if (!rl.allowed) redirect('/contractor?e=busy');

  const name = cap(formData.get('name'));
  const emailRaw = cap(formData.get('email'));
  const phone = cap(formData.get('phone'));
  const company = cap(formData.get('company'));
  const tradeType = cap(formData.get('tradeType'));

  if (!name) redirect('/contractor?e=name');
  const email = emailRaw.toLowerCase();
  if (email && !emailOk(email)) redirect('/contractor?e=email');

  const contractor = await db.contractor.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      tradeType: tradeType || null,
      status: 'PENDING', // every self-registration awaits admin approval
    },
    select: { id: true },
  });

  const { id: visitId, secret } = await openVisit(contractor.id);
  await setVisitCookie(visitId, secret);
  redirect('/contractor/site');
}

/** End the current visit (check out) and clear the cookie. */
export async function checkOut(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(VISIT_COOKIE)?.value;
  if (raw) {
    const dot = raw.indexOf('.');
    const id = dot > 0 ? raw.slice(0, dot) : '';
    const provided = dot > 0 ? raw.slice(dot + 1) : '';
    if (id && provided) {
      const visit = await db.contractorVisit.findUnique({ where: { id }, select: { id: true, secret: true, checkedOutAt: true } });
      // Only close a visit whose secret we actually hold, and only once.
      if (visit && !visit.checkedOutAt && secretMatches(visit.secret, provided)) {
        await db.contractorVisit.update({ where: { id: visit.id }, data: { checkedOutAt: new Date() } });
      }
    }
  }
  cookieStore.set(VISIT_COOKIE, '', { path: '/', maxAge: 0 });
  redirect('/contractor');
}

/** Contractor sets the status of one of THEIR OWN tasks. Status only — never a
 *  reassignment or any other field. The task must belong to the verified visit's
 *  contractor (checked against the row, not the client). */
export async function setMyTaskStatus(taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE'): Promise<{ ok: boolean }> {
  if (!(await getSetting('contractor_checkin_enabled'))) return { ok: false };
  const session = await currentVisit();
  if (!session) return { ok: false };
  if (!['OPEN', 'IN_PROGRESS', 'DONE'].includes(status)) return { ok: false };

  const id = cap(taskId, 60);
  const task = await db.contractorTask.findUnique({ where: { id }, select: { id: true, contractorId: true } });
  // Ownership gate: only tasks assigned to THIS contractor may be touched.
  if (!task || task.contractorId !== session.contractor.id) return { ok: false };

  await db.contractorTask.update({
    where: { id: task.id },
    data: { status, completedAt: status === 'DONE' ? new Date() : null },
  });
  return { ok: true };
}
