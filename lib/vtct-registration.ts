import 'server-only';
import { db } from '@/lib/db';
import { currentTenantId } from '@/lib/tenant';
import { VTCT_DOCUMENT_RELAY, isVtctBlobUrl } from '@/lib/vtct-blob';

// ── BLD-1794: VTCT Registration Details ──────────────────────────────────────
// A trainee's personal details + identity documents required for registration
// with the Academy's awarding body, collected as a SEPARATE record from the
// student's general account/profile (never overwritten by this form).

export const TITLES = ['Mr', 'Mrs', 'Miss', 'Ms', 'Other'] as const;
export type Title = (typeof TITLES)[number];

// Reuses the existing inclusive Gender enum (see Client.gender in the schema).
export const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'OTHER', label: 'Other (self-describe)' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];
const GENDER_VALUES = new Set(GENDER_OPTIONS.map((g) => g.value));

export const DOCUMENT_KINDS = ['PHOTO_ID', 'PROOF_OF_ADDRESS', 'PRIOR_QUALIFICATION'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  PHOTO_ID: 'Photo ID',
  PROOF_OF_ADDRESS: 'Proof of address',
  PRIOR_QUALIFICATION: 'Previous qualification certificate',
};

export const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted — awaiting review',
  CONFIRMED: 'Confirmed',
  CHANGES_PENDING: 'Changes submitted — awaiting re-review',
};

// The exact wording the ticket requires, verbatim — the single source of truth
// both the student-facing form and (for audit purposes) any export render.
// "Awarding Body" is used deliberately in place of "VTCT Skills" so this stays
// applicable if the Academy registers learners with other awarding bodies later.
export const DECLARATION_TEXT =
  'Please read this declaration carefully before submitting your registration details. '
  + 'I confirm that all information, statements and documents provided by me to KClinics Academy are true, accurate, complete, authentic and up to date at the time of submission. '
  + 'I confirm that I have not knowingly omitted, withheld, altered or misrepresented any information that may be relevant to my enrolment, eligibility, assessment, qualification, registration with the Awarding Body or certification. '
  + 'I confirm that my full legal name, date of birth, residential address and other personal details correspond with my current official identification and supporting documents. '
  + 'I understand that the information I provide may be used for enrolment, identity and eligibility verification, learner registration, qualification administration and certification.';

export type DocumentInput = { kind: string; url: string; filename?: string; contentType?: string; sizeBytes?: number };
export type DocumentView = { id: string; kind: DocumentKind; filename: string; url: string; uploadedAt: string };

export type RegistrationInput = {
  title?: string; firstName?: string; middleNames?: string; lastName?: string; dob?: string;
  gender?: string; genderSelfDescribe?: string; personalEmail?: string; phone?: string;
  addressLine1?: string; addressLine2?: string; addressCity?: string; addressPostcode?: string; addressCountry?: string;
  previouslyRegistered?: unknown; priorLearnerCode?: string;
  documents?: unknown;
  declarationAgreed?: unknown;
};

export type RegistrationView = {
  id: string; status: string;
  title: string; firstName: string; middleNames: string | null; lastName: string; dob: string; gender: string; genderSelfDescribe: string | null;
  personalEmail: string; phone: string;
  addressLine1: string; addressLine2: string | null; addressCity: string; addressPostcode: string; addressCountry: string;
  previouslyRegistered: boolean; priorLearnerCode: string | null;
  documents: DocumentView[];
  declarationAgreedAt: string;
  submittedAt: string; confirmedAt: string | null; confirmedBy: string | null; changeRequestedAt: string | null; adminNotes: string | null;
  createdAt: string; updatedAt: string;
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const parseDate = (v: unknown): Date | null => { const s = str(v); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; };

/** Resolve a submitted document URL to its stored form (an https Vercel-Blob
 *  URL) — mirrors lib/portfolio.ts's storedPhotoUrl. Views render relay URLs,
 *  so an edit round-trips them back here. */
function storedDocUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw, 'https://kclinics.co.uk'); } catch { return null; }
  if (u.pathname === VTCT_DOCUMENT_RELAY) {
    try { u = new URL(u.searchParams.get('u') || ''); } catch { return null; }
  }
  return isVtctBlobUrl(u.toString()) ? u.toString() : null;
}

function cleanDocuments(input: unknown): { kind: DocumentKind; url: string; filename: string; contentType?: string; sizeBytes?: number }[] {
  if (!Array.isArray(input)) return [];
  const out: ReturnType<typeof cleanDocuments> = [];
  for (const d of input.slice(0, 30) as DocumentInput[]) {
    const kindRaw = typeof d?.kind === 'string' ? d.kind : '';
    if (!DOCUMENT_KINDS.includes(kindRaw as DocumentKind)) continue;
    const url = storedDocUrl(typeof d?.url === 'string' ? d.url : '');
    if (!url) continue;
    out.push({
      kind: kindRaw as DocumentKind,
      url,
      filename: str(d?.filename).slice(0, 200) || 'document',
      contentType: typeof d?.contentType === 'string' ? d.contentType.slice(0, 100) : undefined,
      sizeBytes: typeof d?.sizeBytes === 'number' && Number.isFinite(d.sizeBytes) ? Math.max(0, Math.round(d.sizeBytes)) : undefined,
    });
  }
  return out;
}

const docToView = (d: { id: string; kind: string; filename: string; url: string; uploadedAt: Date }): DocumentView => ({
  id: d.id, kind: d.kind as DocumentKind, filename: d.filename,
  url: `${VTCT_DOCUMENT_RELAY}?u=${encodeURIComponent(d.url)}`,
  uploadedAt: d.uploadedAt.toISOString(),
});

type Row = {
  id: string; status: string;
  title: string; firstName: string; middleNames: string | null; lastName: string; dob: Date; gender: string; genderSelfDescribe: string | null;
  personalEmail: string; phone: string;
  addressLine1: string; addressLine2: string | null; addressCity: string; addressPostcode: string; addressCountry: string;
  previouslyRegistered: boolean; priorLearnerCode: string | null;
  declarationAgreedAt: Date;
  submittedAt: Date; confirmedAt: Date | null; confirmedBy: string | null; changeRequestedAt: Date | null; adminNotes: string | null;
  createdAt: Date; updatedAt: Date;
  documents: { id: string; kind: string; filename: string; url: string; uploadedAt: Date }[];
};

const toView = (r: Row): RegistrationView => ({
  id: r.id, status: r.status,
  title: r.title, firstName: r.firstName, middleNames: r.middleNames, lastName: r.lastName, dob: r.dob.toISOString().slice(0, 10),
  gender: r.gender, genderSelfDescribe: r.genderSelfDescribe,
  personalEmail: r.personalEmail, phone: r.phone,
  addressLine1: r.addressLine1, addressLine2: r.addressLine2, addressCity: r.addressCity, addressPostcode: r.addressPostcode, addressCountry: r.addressCountry,
  previouslyRegistered: r.previouslyRegistered, priorLearnerCode: r.priorLearnerCode,
  documents: r.documents.map(docToView),
  declarationAgreedAt: r.declarationAgreedAt.toISOString(),
  submittedAt: r.submittedAt.toISOString(), confirmedAt: r.confirmedAt?.toISOString() ?? null, confirmedBy: r.confirmedBy,
  changeRequestedAt: r.changeRequestedAt?.toISOString() ?? null, adminNotes: r.adminNotes,
  createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
});

/** The signed-in trainee's own registration, or null if never submitted. */
export async function getMyRegistration(studentId: string): Promise<RegistrationView | null> {
  const row = await db.vtctRegistration.findFirst({ where: { studentId }, include: { documents: { orderBy: { uploadedAt: 'asc' } } } });
  return row ? toView(row) : null;
}

const VALIDATION_ERROR = {
  title: 'Please choose a title.',
  firstName: 'Please enter your legal first name.',
  lastName: 'Please enter your legal last name.',
  dob: 'Please enter a valid date of birth.',
  gender: 'Please choose a gender.',
  personalEmail: 'Please enter a valid personal email address.',
  phone: 'Please enter a phone number.',
  address: 'Please enter your full residential address (address line, city and postcode).',
  priorLearnerCode: 'Please enter your existing VTCT Skills learner code / registration number.',
  photoId: 'Please upload a photo ID (passport, driving licence, or other photo ID).',
  proofOfAddress: 'Please upload a proof of address.',
  declaration: 'Please read and agree to the Student Declaration before submitting.',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate + submit (create, or update-and-flag) the trainee's own VTCT
 *  registration. Mandatory-field and mandatory-document checks are enforced
 *  here too (never trust the client-side gating alone). */
export async function submitRegistration(studentId: string, input: RegistrationInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const title = str(input.title);
  if (!TITLES.includes(title as Title)) return { ok: false, error: VALIDATION_ERROR.title };
  const firstName = str(input.firstName);
  if (firstName.length < 1) return { ok: false, error: VALIDATION_ERROR.firstName };
  const lastName = str(input.lastName);
  if (lastName.length < 1) return { ok: false, error: VALIDATION_ERROR.lastName };
  const middleNames = str(input.middleNames) || null;
  const dob = parseDate(input.dob);
  if (!dob || dob > new Date()) return { ok: false, error: VALIDATION_ERROR.dob };
  const gender = str(input.gender);
  if (!GENDER_VALUES.has(gender)) return { ok: false, error: VALIDATION_ERROR.gender };
  const genderSelfDescribe = gender === 'OTHER' ? (str(input.genderSelfDescribe) || null) : null;
  const personalEmail = str(input.personalEmail).toLowerCase();
  if (!EMAIL_RE.test(personalEmail)) return { ok: false, error: VALIDATION_ERROR.personalEmail };
  const phone = str(input.phone);
  if (phone.length < 5) return { ok: false, error: VALIDATION_ERROR.phone };
  const addressLine1 = str(input.addressLine1);
  const addressCity = str(input.addressCity);
  const addressPostcode = str(input.addressPostcode);
  if (!addressLine1 || !addressCity || !addressPostcode) return { ok: false, error: VALIDATION_ERROR.address };
  const addressLine2 = str(input.addressLine2) || null;
  const addressCountry = str(input.addressCountry) || 'United Kingdom';

  const previouslyRegistered = input.previouslyRegistered === true;
  const priorLearnerCode = previouslyRegistered ? str(input.priorLearnerCode) : '';
  if (previouslyRegistered && !priorLearnerCode) return { ok: false, error: VALIDATION_ERROR.priorLearnerCode };

  const documents = cleanDocuments(input.documents);
  if (!documents.some((d) => d.kind === 'PHOTO_ID')) return { ok: false, error: VALIDATION_ERROR.photoId };
  if (!documents.some((d) => d.kind === 'PROOF_OF_ADDRESS')) return { ok: false, error: VALIDATION_ERROR.proofOfAddress };

  if (input.declarationAgreed !== true) return { ok: false, error: VALIDATION_ERROR.declaration };

  const existing = await db.vtctRegistration.findFirst({ where: { studentId }, include: { documents: true } });
  const now = new Date();
  const tenantId = await currentTenantId();
  const documentsToCreate = documents.map((d) => ({ ...d, tenantId }));

  const fields = {
    title: title.slice(0, 20), firstName: firstName.slice(0, 120), middleNames: middleNames?.slice(0, 160) ?? null, lastName: lastName.slice(0, 120),
    dob, gender: gender as never, genderSelfDescribe: genderSelfDescribe?.slice(0, 120) ?? null,
    personalEmail: personalEmail.slice(0, 200), phone: phone.slice(0, 40),
    addressLine1: addressLine1.slice(0, 200), addressLine2: addressLine2?.slice(0, 200) ?? null, addressCity: addressCity.slice(0, 120), addressPostcode: addressPostcode.slice(0, 20), addressCountry: addressCountry.slice(0, 80),
    previouslyRegistered, priorLearnerCode: priorLearnerCode ? priorLearnerCode.slice(0, 80) : null,
    declarationAgreedAt: now, submittedAt: now,
  };

  if (!existing) {
    const created = await db.vtctRegistration.create({
      data: {
        tenantId, studentId, status: 'SUBMITTED', ...fields,
        documents: { create: documentsToCreate },
      },
    });
    return { ok: true, id: created.id };
  }

  // Confirmed data is never silently overwritten: editing it flags for admin
  // re-review (CHANGES_PENDING) instead. A pre-confirmation edit (SUBMITTED or
  // already CHANGES_PENDING) just updates in place — nothing has been
  // confirmed yet, so there's nothing to protect.
  const nextStatus = existing.status === 'CONFIRMED' ? 'CHANGES_PENDING' : existing.status;
  const changeRequestedAt = existing.status === 'CONFIRMED' ? now : existing.changeRequestedAt;

  // Documents: replace the set, but only touch Blob storage for what actually
  // changed — delete blobs for documents the student removed, best-effort.
  const keptUrls = new Set(documents.map((d) => d.url));
  const removedUrls = existing.documents.filter((d) => !keptUrls.has(d.url)).map((d) => d.url);

  await db.$transaction([
    db.vtctRegistration.update({
      where: { id: existing.id },
      data: { ...fields, status: nextStatus, changeRequestedAt, documents: { deleteMany: {}, create: documentsToCreate } },
    }),
  ]);

  if (removedUrls.length && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import('@vercel/blob');
      await del(removedUrls);
    } catch (e) {
      console.error('[vtct-registration] blob cleanup for removed document(s) failed (continuing):', (e as Error)?.message);
    }
  }

  return { ok: true, id: existing.id };
}

// ── Admin / staff review ─────────────────────────────────────────────────────

export type AdminRegistrationRow = RegistrationView & { studentId: string; studentName: string; studentEmail: string };

/** All registrations for the review queue — pending review first. */
export async function adminListRegistrations(): Promise<AdminRegistrationRow[]> {
  const rows = await db.vtctRegistration.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { documents: { orderBy: { uploadedAt: 'asc' } }, student: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  const order: Record<string, number> = { CHANGES_PENDING: 0, SUBMITTED: 1, CONFIRMED: 2 };
  return rows
    .map((r) => ({
      ...toView(r), studentId: r.student.id,
      studentName: [r.student.firstName, r.student.lastName].filter(Boolean).join(' ') || r.student.email,
      studentEmail: r.student.email,
    }))
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** A single student's registration, for the admin student-profile view. */
export async function adminGetRegistrationForStudent(studentId: string): Promise<RegistrationView | null> {
  return getMyRegistration(studentId);
}

/** Admin confirms a registration: the details have been checked against the
 *  uploaded documents and are ready to submit to the Awarding Body. */
export async function confirmRegistration(staffEmail: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await db.vtctRegistration.findUnique({ where: { id }, select: { id: true, status: true, studentId: true } });
  if (!r) return { ok: false, error: 'Not found.' };
  if (r.status === 'CONFIRMED') return { ok: true };
  await db.vtctRegistration.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy: staffEmail, changeRequestedAt: null } });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'NOTE_ADDED', actor: staffEmail, summary: `VTCT registration details confirmed for academy student ${r.studentId} (BLD-1794)`, meta: { studentId: r.studentId, vtctRegistrationId: id } }).catch(() => {});
  return { ok: true };
}

// ── GDPR: erasure + subject-access export ────────────────────────────────────

/** Erase a student's VTCT registration (Art. 17): deletes the row (and its
 *  documents, cascaded) plus the underlying Blob files. Called from
 *  eraseStudentData (app/admin/actions.ts). Never silently drops the blob
 *  cleanup failure — the caller surfaces it like every other erasure step. */
export async function eraseVtctRegistrationForStudent(studentId: string): Promise<{ erased: boolean; blobsFailed: number }> {
  const existing = await db.vtctRegistration.findFirst({ where: { studentId }, include: { documents: { select: { url: true } } } });
  if (!existing) return { erased: false, blobsFailed: 0 };
  const urls = existing.documents.map((d) => d.url);
  await db.vtctRegistration.delete({ where: { id: existing.id } });
  let blobsFailed = 0;
  if (urls.length && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import('@vercel/blob');
      await del(urls);
    } catch (e) {
      blobsFailed = urls.length;
      console.error('[vtct-registration] blob deletion during erasure failed (row already deleted):', (e as Error)?.message);
    }
  } else if (urls.length) {
    blobsFailed = urls.length;
  }
  return { erased: true, blobsFailed };
}

/** SAR export (Art. 15): the full registration record, minus raw document
 *  bytes and storage URLs (the export is a JSON dump, not a document bundle) —
 *  document kind/filename/upload date are included so the subject can see
 *  what was submitted. */
export async function exportVtctRegistrationForStudent(studentId: string) {
  const row = await db.vtctRegistration.findFirst({
    where: { studentId },
    include: { documents: { select: { kind: true, filename: true, contentType: true, sizeBytes: true, uploadedAt: true } } },
  });
  if (!row) return null;
  const { documents, ...rest } = row;
  return { ...rest, dob: rest.dob.toISOString().slice(0, 10), documents: documents.map((d) => ({ ...d, uploadedAt: d.uploadedAt.toISOString() })) };
}
