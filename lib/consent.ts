import 'server-only';
import crypto from 'node:crypto';
import { encryptJson, integrityHash } from '@/lib/crypto';

// Consent form engine. Templates are editable per category; signatures are
// captured immutably (encrypted body + signature, content hash, timestamps, IP)
// under the Health Data API.

export type ConsentCategory = 'general' | 'laser' | 'injectables' | 'facials' | 'dental';

// ── Audited consent wording ──────────────────────────────────────────────────
// The statements below are the clinic's AUDITED consent language, carried over
// verbatim from the approved Cosmetology Client Consultation Forms. Do not
// reword them without a fresh review — the platform renders them through its own
// UI + e-signature, but the text itself must stay exactly as audited.

// "Informed Consent (Required)" — the required e-signature ticks.
const INFORMED_CONSENT = [
  'I have provided complete, accurate, and truthful information regarding my medical history and current health condition.',
  'The nature, purpose, procedure steps, and expected duration of the treatment have been clearly explained to me.',
  'I understand the possible risks, side effects, and complications associated with this procedure.',
  'I acknowledge that individual results may vary and that no specific outcome or result has been guaranteed.',
  'I understand that additional treatments, touch-ups, or corrective procedures may be required to achieve or maintain the desired result.',
  'I voluntarily consent to undergo the procedure and confirm that I have had the opportunity to ask questions, all of which have been answered to my satisfaction.',
];
// "Legal Disclaimer" — the required e-signature ticks.
const LEGAL_DISCLAIMER = [
  'I acknowledge that I have been informed of all potential risks and possible complications associated with the procedure and release the specialist and/or salon from liability for such outcomes.',
  'I understand that the specialist and/or salon is not responsible for complications or unsatisfactory results resulting from undisclosed, incomplete, or inaccurate medical information provided by me.',
];
const REQUIRED_TICKS = [...INFORMED_CONSENT, ...LEGAL_DISCLAIMER];

// The audited pre-treatment consent narrative (the body the client reads).
const PRE_TREATMENT_BODY = `## Pre-treatment informed consent

Please read the following carefully before your treatment:

- I confirm that I do not have any of the listed contraindications and that I am suitable to receive the selected aesthetic treatment.
- I have disclosed all relevant information about my health to the best of my knowledge, including medical conditions, medications, allergies, skin conditions, recent treatments, and pregnancy or breastfeeding status.
- I understand that withholding medical or health-related information may increase the risk of complications, and I accept full responsibility for any adverse reactions resulting from undisclosed information.
- I understand that results may vary between individuals and that no specific or guaranteed results have been promised to me.
- I agree to immediately inform the esthetician if I experience pain, burning, or unusual discomfort during the procedure so that the treatment can be modified or stopped.
- I understand that proper aftercare is essential for healing and optimal results. I agree to follow all post-treatment instructions provided and understand that failure to follow aftercare instructions may lead to complications for which the esthetician cannot be held responsible.
- I understand that the esthetician reserves the right to refuse or postpone the procedure if a contraindication is suspected or present.
- I release and hold harmless the esthetician and the business from liability for adverse reactions or complications that may occur as a result of the treatment, except in cases of proven negligence.
- I confirm that I have had the opportunity to ask questions and that all my questions have been answered to my satisfaction.
- I voluntarily consent to receive the selected treatment.`;

// The audited Patch Testing declaration (laser / patch-test treatments).
const PATCH_TEST_BODY = `## Patch testing

Patch Testing is a procedure for testing a customer's skin for an allergic reaction from a substance that will be used for the procedure that he or she desires to undergo. It involves placing a few drops or a small amount of the substance on the skin. Potential reactions including rashes, infections or skin irritation can occur within 24-48 hours of application.

Patch Testing is one of the classic methods within the industry for identifying if a client would develop a reaction to any creams, dyes or skin applications that shall be applied to the skin during the treatment. If no reaction occurs within 24-48 hours post application then the treatment procedure can safely proceed. Although a patch test is conducted, this does not guarantee that a client will not develop a reaction in the future due to the skin at that time only being exposed to a limited amount of product. Allergies are cumulative, meaning they can build over a period of time.

If you have any known allergies, please alert your practitioner before continuing your procedure.

**Laser hair removal**

Test patches are carried out to determine the treatment parameters and to judge how the skin might react to full treatment. A test patch is a small trial in the area to be treated and allows the practitioner to assess how well the laser light energy is absorbed and whether the skin is responding as would be expected.

Clients are asked to follow all aftercare advice provided whilst observing the skins reaction post treatment taking note of any redness, swelling or heat located in the area alongside the length of time taken for symptoms to subside. Not adhering to aftercare instructions may increase the risks of complications developing.

**Declaration**

I hereby declare that I was recommended to undergo a patch test. It was explained to me the risks involved should I choose not to go with the patch test before the procedure. I have had the opportunity to ask questions and have been provided with relevant information regarding the treatment procedure. The information was explained to me to my satisfaction and understanding. I understand that I must notify KClinics team if any adverse reactions occur post treatment to receive proper instructions on the subsequent measures.

I understand that in the case of an adverse reaction to my skin, I shall not hold KClinics team responsible.`;

export const DEFAULT_TEMPLATES: { key: string; title: string; category: string; version: number; bodyMd: string; acknowledgements: string[] }[] = [
  {
    key: 'general', title: 'Treatment consent', category: 'general', version: 2,
    bodyMd: PRE_TREATMENT_BODY,
    acknowledgements: REQUIRED_TICKS,
  },
  {
    key: 'laser', title: 'Laser treatment consent', category: 'laser', version: 2,
    bodyMd: `${PRE_TREATMENT_BODY}\n\n${PATCH_TEST_BODY}`,
    acknowledgements: REQUIRED_TICKS,
  },
  {
    key: 'injectables', title: 'Injectable treatment consent', category: 'injectables', version: 2,
    bodyMd: PRE_TREATMENT_BODY,
    acknowledgements: REQUIRED_TICKS,
  },
  {
    key: 'facials', title: 'Facial / skin treatment consent', category: 'facials', version: 2,
    bodyMd: PRE_TREATMENT_BODY,
    acknowledgements: REQUIRED_TICKS,
  },
  {
    key: 'dental', title: 'Dental treatment consent', category: 'dental', version: 1,
    // Dentistry is outside the audited cosmetology forms — keep the dental-specific wording.
    bodyMd: `## Consent to dental treatment\n\nThe proposed dental treatment, alternatives, benefits and risks have been explained to me by the treating dentist, and I have had the opportunity to ask questions.\n\nI understand that results can vary between individuals and that no specific outcome has been guaranteed. I confirm the medical and dental history I have provided is accurate and complete to the best of my knowledge.`,
    acknowledgements: ['I have read and understood the information above', 'My medical/dental history is accurate and complete', 'I consent to proceed with this treatment'],
  },
  {
    key: 'photo_opt_out', title: 'Photography & video consent', category: 'laser', version: 2,
    // Audited Photo & Video Consent wording. The platform's before-photo system
    // records the client's choice; the audited options are reproduced here.
    bodyMd: `## Photo & video consent\n\nPlease confirm your choice regarding photography and video. A before photograph is standard practice for laser treatments — it documents the treatment area and supports safe, correct treatment and any future clinical or insurance review.\n\n- I consent to photographs and/or videos being taken before and after the procedure for medical documentation purposes.\n- I consent to the use of my photographs and/or videos for marketing and promotional purposes (website, social media, educational materials).\n- I do NOT consent to any photography or videography.`,
    acknowledgements: ['I have read and understood the photography & video options above', 'The selection I have made with the clinic reflects my wishes'],
  },
];

/** Which consent template applies to a treatment, by its marketing group/slug. */
export async function categoryForTreatment(slug: string): Promise<ConsentCategory> {
  try {
    const { getTreatment } = await import('@/lib/treatments');
    const t = getTreatment(slug);
    if (!t) return 'general';
    if (/laser|tattoo|ipl/i.test(slug) || t.group === 'Laser & Skin') return /laser|tattoo|ipl/i.test(slug) ? 'laser' : 'facials';
    if (t.group === 'Body & Injectables') return 'injectables';
    if (t.category === 'dentistry') return 'dental';
    if (t.group === 'Face & Lifting') return 'facials';
  } catch { /* fall through */ }
  return 'general';
}

export const isLaserTreatment = (slug: string) => /laser|tattoo|ipl/i.test(slug);

/** Canonical string of exactly what was signed → SHA-256 (the certificate id). */
export function contentHashOf(payload: { templateKey: string; templateVersion: number; bodyMd: string; acknowledgements: { label: string; checked: boolean }[]; signerName: string; signedAt: string; declined: boolean }): string {
  const canonical = JSON.stringify({
    k: payload.templateKey, v: payload.templateVersion, b: payload.bodyMd,
    a: payload.acknowledgements.map((x) => `${x.checked ? '1' : '0'}:${x.label}`),
    n: payload.signerName, t: payload.signedAt, d: payload.declined,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

type SignInput = {
  clientId: string; bookingId?: string | null; templateKey: string; templateVersion: number; title: string;
  kind: string; declined: boolean; signerName: string; bodyMd: string;
  acknowledgements: { label: string; checked: boolean }[]; signatureDataUrl: string;
  openedAt?: string | null; ip?: string | null; userAgent?: string | null;
};

/** Create the immutable signed record (encrypted) + its tamper-evident hash. */
export async function createSignedConsent(input: SignInput) {
  const { db } = await import('@/lib/db');
  const signedAt = new Date();
  const contentHash = contentHashOf({ templateKey: input.templateKey, templateVersion: input.templateVersion, bodyMd: input.bodyMd, acknowledgements: input.acknowledgements, signerName: input.signerName, signedAt: signedAt.toISOString(), declined: input.declined });
  const cipher = encryptJson({
    bodyMd: input.bodyMd, acknowledgements: input.acknowledgements, signatureDataUrl: input.signatureDataUrl,
    signerName: input.signerName, signedAt: signedAt.toISOString(), openedAt: input.openedAt ?? null,
    ip: input.ip ?? null, userAgent: input.userAgent ?? null, contentHash,
  });
  const ih = integrityHash(cipher, { clientId: input.clientId, templateKey: input.templateKey, contentHash });
  return db.signedConsent.create({
    data: {
      clientId: input.clientId, bookingId: input.bookingId ?? null, templateKey: input.templateKey,
      templateVersion: input.templateVersion, title: input.title, kind: input.kind, declined: input.declined,
      signerName: input.signerName.slice(0, 120), cipher, integrityHash: ih, contentHash, signedAt, ip: input.ip ?? null,
    },
  });
}

/** Ensure the audited templates exist, and keep system-seeded rows in sync with
 *  the audited wording. Rows a human has edited in Admin (updatedBy set) are left
 *  untouched; only rows still on an older system version are refreshed — so the
 *  audited language lands on go-live and on any environment seeded earlier,
 *  without ever overwriting a deliberate clinical edit. */
export async function ensureDefaultTemplates() {
  const { db } = await import('@/lib/db');
  for (const t of DEFAULT_TEMPLATES) {
    const existing = await db.consentTemplate.findUnique({ where: { key: t.key }, select: { version: true, updatedBy: true } });
    if (!existing) {
      await db.consentTemplate.create({ data: { ...t } });
    } else if (!existing.updatedBy && existing.version < t.version) {
      // System-seeded and behind the audited version → refresh in place.
      await db.consentTemplate.update({
        where: { key: t.key },
        data: { title: t.title, category: t.category, version: t.version, bodyMd: t.bodyMd, acknowledgements: t.acknowledgements },
      });
    }
  }
}
