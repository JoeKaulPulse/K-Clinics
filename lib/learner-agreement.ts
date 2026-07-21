// ── BLD-730: Learner (Training) Agreement ────────────────────────────────────
// The contract for the provision of training services that every new learner
// signs at the pre-course gate before lessons unlock. The wording below is a
// PLACEHOLDER DRAFT approved for structure only — the owner replaces it with
// the final reviewed wording (see the owner action list), then bumps the
// version so the enrolment record shows exactly which wording was signed.

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

/** The agreement rendered as plain text (for records / future export). */
export function agreementPlainText(): string {
  return LEARNER_AGREEMENT_SECTIONS.map((s) => `${s.heading}\n${s.body}`).join('\n\n');
}
