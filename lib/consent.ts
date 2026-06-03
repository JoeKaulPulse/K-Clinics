import 'server-only';
import crypto from 'node:crypto';
import { encryptJson, integrityHash } from '@/lib/crypto';

// Consent form engine. Templates are editable per category; signatures are
// captured immutably (encrypted body + signature, content hash, timestamps, IP)
// under the Health Data API.

export type ConsentCategory = 'general' | 'laser' | 'injectables' | 'facials' | 'dental';

const REVIEW = '\n\n> **Note for the clinic:** this is a professional starter template — review and approve the exact wording with your clinical lead and insurer before going live. Edit it in Admin → Consent forms.';

export const DEFAULT_TEMPLATES: { key: string; title: string; category: string; bodyMd: string; acknowledgements: string[] }[] = [
  {
    key: 'general', title: 'Treatment consent', category: 'general',
    bodyMd: `## Consent to treatment\n\nI confirm that the nature of the treatment, its intended benefits, the likely results and the common and serious risks have been explained to me, and I have had the opportunity to ask questions.\n\nI understand that results can vary between individuals and that no specific outcome has been guaranteed. I confirm the medical history I have provided is accurate and complete to the best of my knowledge.${REVIEW}`,
    acknowledgements: ['I have read and understood the information above', 'My medical history is accurate and complete', 'I consent to proceed with this treatment'],
  },
  {
    key: 'laser', title: 'Laser treatment consent', category: 'laser',
    bodyMd: `## Consent to laser treatment\n\nI understand this treatment uses medical laser/IPL energy. The benefits, expected number of sessions and risks — including redness, swelling, temporary pigment change, blistering and, rarely, scarring or burns — have been explained to me.\n\nI confirm I am not pregnant, have disclosed any photosensitising medication, and have avoided sun exposure / tanning as advised. I understand a patch test and a pre-treatment photograph may be required.${REVIEW}`,
    acknowledgements: ['I have read and understood the laser-specific risks', 'I have disclosed relevant medication and sun exposure', 'I consent to proceed with laser treatment'],
  },
  {
    key: 'injectables', title: 'Injectable treatment consent', category: 'injectables',
    bodyMd: `## Consent to injectable treatment\n\nI understand this treatment involves injection of product(s) by a qualified, prescriber-led clinician. The benefits, duration and risks — including bruising, swelling, asymmetry, infection and, rarely, vascular complications — have been explained to me.${REVIEW}`,
    acknowledgements: ['I have read and understood the risks of injectable treatment', 'My medical history is accurate and complete', 'I consent to proceed with this treatment'],
  },
  {
    key: 'facials', title: 'Facial / skin treatment consent', category: 'facials',
    bodyMd: `## Consent to facial / skin treatment\n\nThe nature of this skin treatment, its benefits and common reactions — including redness, sensitivity and temporary purging — have been explained to me.${REVIEW}`,
    acknowledgements: ['I have read and understood the information above', 'My medical history is accurate and complete', 'I consent to proceed with this treatment'],
  },
  {
    key: 'dental', title: 'Dental treatment consent', category: 'dental',
    bodyMd: `## Consent to dental treatment\n\nThe proposed dental treatment, alternatives, benefits and risks have been explained to me by the treating dentist, and I have had the opportunity to ask questions.${REVIEW}`,
    acknowledgements: ['I have read and understood the information above', 'My medical/dental history is accurate and complete', 'I consent to proceed with this treatment'],
  },
  {
    key: 'photo_opt_out', title: 'Before-photo opt-out (laser)', category: 'laser',
    bodyMd: `## Declining the pre-treatment photograph\n\nA before photograph is standard practice for laser treatments — it protects both you and the clinic by documenting the treatment area and supporting safe, correct treatment and any future insurance or clinical review.\n\nBy signing below I confirm that I have been offered a before photograph and I am **choosing to decline it**. I understand this is my decision and that the clinic has recommended the photograph be taken.${REVIEW}`,
    acknowledgements: ['I was offered a pre-treatment photograph and understand why it is recommended', 'I am choosing to decline the photograph of my own accord'],
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

/** Ensure the starter templates exist (idempotent). */
export async function ensureDefaultTemplates() {
  const { db } = await import('@/lib/db');
  for (const t of DEFAULT_TEMPLATES) {
    await db.consentTemplate.upsert({ where: { key: t.key }, create: { ...t }, update: {} });
  }
}
