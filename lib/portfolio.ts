import 'server-only';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';
import { PORTFOLIO_PHOTO_RELAY } from '@/lib/portfolio-blob';

// ── BLD-534: learner portfolio ───────────────────────────────────────────────
// A trainee's evidence log of practical case studies, reviewed by tutors.

export const PORTFOLIO_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'NEEDS_WORK'] as const;
export type PortfolioStatus = (typeof PORTFOLIO_STATUSES)[number];
export const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', SUBMITTED: 'Submitted for review', APPROVED: 'Approved', NEEDS_WORK: 'Changes requested' };

// Suggestions only (UI datalist) — NOT seeded data.
export const TREATMENT_SUGGESTIONS = ['Anti-wrinkle injections', 'Dermal filler', 'Lip filler', 'Skin booster', 'Chemical peel', 'Microneedling', 'Skin consultation', 'PRP', 'Fat dissolving', 'Other'];

export type PortfolioPhoto = { url: string; caption?: string; kind: 'before' | 'after' | 'other' };
export type PortfolioEntryView = {
  id: string; title: string; treatmentType: string; treatmentDate: string | null; clientRef: string | null;
  notes: string; photos: PortfolioPhoto[]; status: string; feedback: string | null; consentAttestedAt: string | null;
  courseId: string | null; courseTitle: string | null; createdAt: string; updatedAt: string; reviewedAt: string | null;
};

const KIND = new Set(['before', 'after', 'other']);
// BLD-740: new uploads land in the PRIVATE blob store; entries saved before
// the switch still hold public-store URLs until the daily sweep re-homes them.
const BLOB_HOST = /\.(public|private)\.blob\.vercel-storage\.com$/;
/** Resolve a submitted photo URL to its stored form: an https Vercel-Blob URL.
 *  Views render relay URLs (BLD-740), so an edit round-trips them back here —
 *  unwrap `/api/academy/portfolio/photo?u=…` to the underlying blob URL. */
function storedPhotoUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw, 'https://kclinics.co.uk'); } catch { return null; }
  if (u.pathname === PORTFOLIO_PHOTO_RELAY) {
    try { u = new URL(u.searchParams.get('u') || ''); } catch { return null; }
  }
  return u.protocol === 'https:' && BLOB_HOST.test(u.hostname) ? u.toString() : null;
}
/** Validate + normalise the photos array: only https Vercel-Blob URLs, capped. */
function cleanPhotos(input: unknown): PortfolioPhoto[] {
  if (!Array.isArray(input)) return [];
  const out: PortfolioPhoto[] = [];
  for (const p of input.slice(0, 24)) {
    const raw = typeof (p as { url?: unknown })?.url === 'string' ? (p as { url: string }).url : '';
    const url = storedPhotoUrl(raw);
    if (!url) continue;
    const kindRaw = (p as { kind?: unknown })?.kind;
    const kind = (typeof kindRaw === 'string' && KIND.has(kindRaw) ? kindRaw : 'other') as PortfolioPhoto['kind'];
    const captionRaw = (p as { caption?: unknown })?.caption;
    const caption = typeof captionRaw === 'string' ? captionRaw.slice(0, 200) : undefined;
    out.push({ url, kind, ...(caption ? { caption } : {}) });
  }
  return out;
}

type Row = {
  id: string; title: string; treatmentType: string; treatmentDate: Date | null; clientRef: string | null;
  notes: string; photos: unknown; status: string; feedback: string | null; consentAttestedAt: Date | null; courseId: string | null;
  createdAt: Date; updatedAt: Date; reviewedAt: Date | null; course?: { title: string } | null;
};
const toView = (e: Row): PortfolioEntryView => ({
  id: e.id, title: e.title, treatmentType: e.treatmentType, treatmentDate: e.treatmentDate?.toISOString() ?? null, clientRef: e.clientRef,
  notes: e.notes,
  // BLD-740: never hand a raw blob URL to the UI — every photo reads through
  // the authenticated relay (owner trainee or signed-in staff only).
  photos: cleanPhotos(e.photos).map((p) => ({ ...p, url: `${PORTFOLIO_PHOTO_RELAY}?u=${encodeURIComponent(p.url)}` })),
  status: e.status, feedback: e.feedback, consentAttestedAt: e.consentAttestedAt?.toISOString() ?? null,
  courseId: e.courseId, courseTitle: e.course?.title ?? null, createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(), reviewedAt: e.reviewedAt?.toISOString() ?? null,
});

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const parseDate = (v: unknown): Date | null => { const s = str(v).trim(); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; };

export type EntryInput = { title: string; treatmentType: string; treatmentDate?: string; clientRef?: string; notes?: string; courseId?: string; photos?: unknown; consentPhotos?: unknown };

// BLD-740: an entry carrying photos of a treatment subject is only saved with
// the trainee's attestation that the subject consented to storage and review.
const CONSENT_ERROR = 'Please tick the consent confirmation — an entry with photos can only be saved once you confirm the person photographed consented.';

/** The signed-in trainee's own entries, newest first. */
export async function listMyEntries(studentId: string): Promise<PortfolioEntryView[]> {
  const rows = await db.portfolioEntry.findMany({
    where: { studentId }, orderBy: { updatedAt: 'desc' }, take: 200,
    include: { course: { select: { title: true } } },
  });
  return rows.map(toView);
}

/** Courses the trainee is enrolled on (for the optional course picker). */
export async function myCourses(studentId: string): Promise<{ id: string; title: string }[]> {
  const rows = await db.enrolment.findMany({
    where: { studentId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } },
    select: { course: { select: { id: true, title: true } } },
  });
  const seen = new Map<string, string>();
  for (const r of rows) if (r.course) seen.set(r.course.id, r.course.title);
  return [...seen].map(([id, title]) => ({ id, title }));
}

// BLD-538: per-course completion targets (staff set how many approved cases a
// course needs). Only courses with a target the trainee is enrolled on appear.
export type PortfolioProgress = { courseId: string; courseTitle: string; target: number; approved: number; submitted: number };
export async function portfolioProgress(studentId: string): Promise<PortfolioProgress[]> {
  const enrols = await db.enrolment.findMany({
    where: { studentId, status: { in: ['PAID', 'ENROLLED', 'COMPLETED'] } },
    select: { course: { select: { id: true, title: true, portfolioTarget: true } } },
  });
  const targeted = new Map<string, { title: string; target: number }>();
  for (const e of enrols) if (e.course?.portfolioTarget && e.course.portfolioTarget > 0) targeted.set(e.course.id, { title: e.course.title, target: e.course.portfolioTarget });
  if (targeted.size === 0) return [];
  const entries = await db.portfolioEntry.findMany({ where: { studentId, courseId: { in: [...targeted.keys()] } }, select: { courseId: true, status: true } });
  const tally = new Map<string, { approved: number; submitted: number }>();
  for (const e of entries) {
    if (!e.courseId) continue;
    const t = tally.get(e.courseId) ?? { approved: 0, submitted: 0 };
    if (e.status === 'APPROVED') t.approved++; else if (e.status === 'SUBMITTED') t.submitted++;
    tally.set(e.courseId, t);
  }
  return [...targeted].map(([courseId, { title, target }]) => ({ courseId, courseTitle: title, target, approved: tally.get(courseId)?.approved ?? 0, submitted: tally.get(courseId)?.submitted ?? 0 }));
}

async function ownedCourseId(studentId: string, courseId: string | undefined): Promise<string | null> {
  const id = str(courseId).trim();
  if (!id) return null;
  const ok = await db.enrolment.findFirst({ where: { studentId, courseId: id }, select: { id: true } });
  return ok ? id : null;
}

export async function createEntry(studentId: string, input: EntryInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const title = str(input.title).trim();
  const treatmentType = str(input.treatmentType).trim();
  if (title.length < 3) return { ok: false, error: 'Give the case a title.' };
  if (!treatmentType) return { ok: false, error: 'Choose a treatment type.' };
  const photos = cleanPhotos(input.photos);
  if (photos.length > 0 && input.consentPhotos !== true) return { ok: false, error: CONSENT_ERROR };
  const tenantId = await currentTenantId();
  const e = await db.portfolioEntry.create({
    data: {
      tenantId, studentId, title: title.slice(0, 160), treatmentType: treatmentType.slice(0, 80),
      treatmentDate: parseDate(input.treatmentDate), clientRef: str(input.clientRef).trim().slice(0, 80) || null,
      notes: str(input.notes).slice(0, 8000), courseId: await ownedCourseId(studentId, input.courseId),
      photos: photos as unknown as object, consentAttestedAt: photos.length > 0 ? new Date() : null, status: 'DRAFT',
    },
  });
  return { ok: true, id: e.id };
}

/** Update an owned entry. Approved entries are locked (resubmit not needed). */
export async function updateEntry(studentId: string, id: string, input: EntryInput): Promise<{ ok: boolean; error?: string }> {
  const existing = await db.portfolioEntry.findFirst({ where: { id, studentId }, select: { id: true, status: true } });
  if (!existing) return { ok: false, error: 'Not found.' };
  if (existing.status === 'APPROVED') return { ok: false, error: 'This case has been approved and can no longer be edited.' };
  const title = str(input.title).trim();
  const treatmentType = str(input.treatmentType).trim();
  if (title.length < 3) return { ok: false, error: 'Give the case a title.' };
  if (!treatmentType) return { ok: false, error: 'Choose a treatment type.' };
  const photos = cleanPhotos(input.photos);
  if (photos.length > 0 && input.consentPhotos !== true) return { ok: false, error: CONSENT_ERROR };
  await db.portfolioEntry.update({
    where: { id },
    data: {
      title: title.slice(0, 160), treatmentType: treatmentType.slice(0, 80), treatmentDate: parseDate(input.treatmentDate),
      clientRef: str(input.clientRef).trim().slice(0, 80) || null, notes: str(input.notes).slice(0, 8000),
      courseId: await ownedCourseId(studentId, input.courseId), photos: photos as unknown as object,
      consentAttestedAt: photos.length > 0 ? new Date() : null,
    },
  });
  return { ok: true };
}

/** Submit an owned draft / revised entry for tutor review. */
export async function submitEntry(studentId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const e = await db.portfolioEntry.findFirst({ where: { id, studentId }, select: { id: true, status: true, photos: true, consentAttestedAt: true } });
  if (!e) return { ok: false, error: 'Not found.' };
  if (e.status === 'SUBMITTED') return { ok: true };
  if (e.status === 'APPROVED') return { ok: false, error: 'Already approved.' };
  // BLD-740: a pre-attestation entry with photos can't go for review until the
  // trainee edits it and ticks the consent confirmation.
  if (!e.consentAttestedAt && cleanPhotos(e.photos).length > 0) return { ok: false, error: CONSENT_ERROR };
  await db.portfolioEntry.update({ where: { id }, data: { status: 'SUBMITTED' } });
  return { ok: true };
}

/** Delete an owned entry (not once approved). */
export async function deleteEntry(studentId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const e = await db.portfolioEntry.findFirst({ where: { id, studentId }, select: { id: true, status: true } });
  if (!e) return { ok: false, error: 'Not found.' };
  if (e.status === 'APPROVED') return { ok: false, error: 'Approved cases cannot be deleted.' };
  await db.portfolioEntry.delete({ where: { id } });
  return { ok: true };
}

// ── Admin / tutor review ─────────────────────────────────────────────────────
export type AdminPortfolioEntry = PortfolioEntryView & { studentName: string; studentEmail: string; reviewedBy: string | null };

/** All entries for review — submitted first, then needs-work, approved, drafts. */
export async function adminListEntries(): Promise<AdminPortfolioEntry[]> {
  const rows = await db.portfolioEntry.findMany({
    orderBy: { updatedAt: 'desc' }, take: 400,
    include: { course: { select: { title: true } }, student: { select: { firstName: true, lastName: true, email: true } } },
  });
  const order: Record<string, number> = { SUBMITTED: 0, NEEDS_WORK: 1, APPROVED: 2, DRAFT: 3 };
  return rows
    .map((e) => ({
      ...toView(e), reviewedBy: e.reviewedBy,
      studentName: [e.student?.firstName, e.student?.lastName].filter(Boolean).join(' ') || e.student?.email || 'Trainee',
      studentEmail: e.student?.email ?? '',
    }))
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Tutor sets a review outcome + feedback. */
export async function reviewEntry(staffEmail: string, id: string, status: string, feedback: string): Promise<{ ok: boolean; error?: string }> {
  if (status !== 'APPROVED' && status !== 'NEEDS_WORK') return { ok: false, error: 'Invalid status.' };
  const e = await db.portfolioEntry.findUnique({ where: { id }, select: { id: true } });
  if (!e) return { ok: false, error: 'Not found.' };
  await db.portfolioEntry.update({ where: { id }, data: { status, feedback: feedback.trim().slice(0, 4000) || null, reviewedBy: staffEmail, reviewedAt: new Date() } });
  return { ok: true };
}
