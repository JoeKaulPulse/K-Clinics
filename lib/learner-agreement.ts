// ── BLD-730 / BLD-1731: Learner (Training) Agreement ─────────────────────────
// The contract for the provision of training services that every new learner
// signs at the pre-course gate before lessons unlock. The wording now lives in
// the LearnerAgreementVersion table, edited and published from K Academy admin
// → Agreements & Policies (app/admin/academy/agreement) — owner-only to
// publish. getCurrentLearnerAgreement() is the live read used by every call
// site that shows or signs the agreement.
//
// The constants below are the ORIGINAL placeholder wording. They are no longer
// the live source — getCurrentLearnerAgreement() only falls back to them if
// the table is genuinely empty, seeding it as the first published row so
// nothing changes for existing learners on deploy (see seedInitialAgreement).
// Kept exported (unchanged name/shape) as that fallback + seed source.

export const LEARNER_AGREEMENT_VERSION = '2026-07-draft-1';

export type AgreementSection = { heading: string; body: string };

export const LEARNER_AGREEMENT_SECTIONS: AgreementSection[] = [
  {
    heading: '1. The parties and the service',
    body: 'This Learner Agreement is between K Clinics Academy ("the Academy") and you, the enrolled learner. It governs the provision of the training course named on your enrolment, including online learning materials, assessments and any in-clinic practical days.',
  },
  {
    heading: '2. Your place and what we provide',
    body: 'Your place on the course is confirmed once your enrolment is accepted and your first payment (or agreed payment plan) is in place. We provide the published course content, tutor support, assessment and — where the course includes them — supervised practical sessions and certification on successful completion.',
  },
  {
    heading: '3. Fees and payment',
    body: 'The course fee is the amount agreed on your enrolment. Where a payment plan has been agreed, instalments are due on the scheduled dates. If an instalment is missed we will contact you to bring the plan up to date; access to course materials may be paused while payments are outstanding.',
  },
  {
    heading: '4. Cancellation and refunds',
    body: 'You may cancel within 14 days of enrolment for a full refund, unless you have already accessed the course materials or attended a practical session, in which case a proportionate deduction applies. After 14 days, fees are refundable only as required by law or at the Academy’s discretion.',
  },
  {
    heading: '5. Your commitments',
    body: 'You agree to complete the pre-course requirements, attend booked practical sessions (or give reasonable notice), conduct yourself professionally, and not to share, copy or resell course materials, which remain the Academy’s intellectual property.',
  },
  {
    heading: '6. Certification and standards',
    body: 'Certification is awarded on successful completion of the required assessments and practical standards. The Academy may require additional practice or reassessment before certifying where standards are not yet met — this protects you, your future clients and the qualification.',
  },
  {
    heading: '7. Health, safety and insurance',
    body: 'You must disclose any condition that could affect your safe participation in practical sessions. Practising on the public after certification requires your own insurance; the Academy’s cover applies only during supervised training.',
  },
  {
    heading: '8. Data protection',
    body: 'Your personal data is processed in line with the K Clinics privacy policy. Training records, assessments and your signed agreement are retained as part of your learner record.',
  },
];

/** The agreement rendered as plain text (for records / future export).
 *  Takes the sections to render — defaults to the placeholder constant above
 *  for backward compatibility, but callers showing the LIVE agreement should
 *  pass `(await getCurrentLearnerAgreement()).sections`. */
export function agreementPlainText(sections: AgreementSection[] = LEARNER_AGREEMENT_SECTIONS): string {
  return sections.map((s) => `${s.heading}\n${s.body}`).join('\n\n');
}

function asAgreementSections(value: unknown): AgreementSection[] {
  if (!Array.isArray(value)) return LEARNER_AGREEMENT_SECTIONS;
  const out: AgreementSection[] = [];
  for (const s of value) {
    const heading = typeof (s as { heading?: unknown })?.heading === 'string' ? (s as { heading: string }).heading : '';
    const body = typeof (s as { body?: unknown })?.body === 'string' ? (s as { body: string }).body : '';
    if (heading && body) out.push({ heading, body });
  }
  return out.length ? out : LEARNER_AGREEMENT_SECTIONS;
}

export type LearnerAgreement = { version: string; sections: AgreementSection[] };

/** Idempotent lazy seed (BLD-1731): the first read of an empty
 *  LearnerAgreementVersion table publishes the original placeholder wording as
 *  the initial version, so existing/new learners see exactly what they saw
 *  before this table existed — nothing changes on deploy. Mirrors the
 *  seeded-on-read style already used for consent templates
 *  (ensureDefaultTemplates in lib/build-backlog.ts). */
async function seedInitialAgreement() {
  const { db } = await import('@/lib/db');
  return db.learnerAgreementVersion.create({
    data: {
      version: LEARNER_AGREEMENT_VERSION,
      sections: LEARNER_AGREEMENT_SECTIONS,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      createdBy: 'system',
    },
  }).catch(() => null);
}

/** The agreement every call site should show/sign against — the most recently
 *  PUBLISHED row in LearnerAgreementVersion, falling back to the original
 *  placeholder constants only if the table can't be read or is empty (and
 *  the lazy seed itself fails, e.g. no DB configured). Whatever this returns
 *  is safe to stamp onto an enrolment as `agreementVersion` — that string is
 *  immutable and traceable back to this exact wording forever, since
 *  publishing only ever adds a new row. */
export async function getCurrentLearnerAgreement(): Promise<LearnerAgreement> {
  try {
    const { db } = await import('@/lib/db');
    const current = await db.learnerAgreementVersion.findFirst({
      where: { status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (current) return { version: current.version, sections: asAgreementSections(current.sections) };
    const seeded = await seedInitialAgreement();
    if (seeded) return { version: seeded.version, sections: asAgreementSections(seeded.sections) };
  } catch {
    // DB unavailable (e.g. no DATABASE_URL in this environment) — fall back below.
  }
  return { version: LEARNER_AGREEMENT_VERSION, sections: LEARNER_AGREEMENT_SECTIONS };
}

/** The in-progress draft (if any) an admin is editing, kept as at most one
 *  DRAFT row — used to prefill the admin editor across sessions. */
export async function getDraftLearnerAgreement() {
  const { db } = await import('@/lib/db');
  return db.learnerAgreementVersion.findFirst({ where: { status: 'DRAFT' }, orderBy: { updatedAt: 'desc' } });
}

/** Recent versions (published and draft), newest first — the admin history list. */
export async function listLearnerAgreementVersions(limit = 20) {
  const { db } = await import('@/lib/db');
  return db.learnerAgreementVersion.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}
