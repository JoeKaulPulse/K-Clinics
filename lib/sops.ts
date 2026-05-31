import 'server-only';
import { db } from '@/lib/db';

// Standard Operating Procedures per treatment. Stored in the DB (editable in
// admin) but seeded from these sensible defaults so every treatment has a base
// SOP from day one. `getSop` returns the DB version if present, else the default.

type SopDef = { title: string; content: string };

// A compact, safe default SOP applied to any treatment without a specific one.
const GENERIC: SopDef = {
  title: 'General treatment SOP',
  content: [
    '1. Confirm client identity, consent and that all pre-treatment forms are complete.',
    '2. Review the client medical flag and health assessment; confirm no contraindications.',
    '3. Confirm the treatment plan, expected outcome and aftercare with the client.',
    '4. Prepare the treatment area; ensure equipment is clean, calibrated and single-use items are sealed.',
    '5. Take before photos (with consent) for the clinical record.',
    '6. Deliver the treatment per protocol, checking client comfort throughout.',
    '7. Provide aftercare guidance, book any follow-up, and record notes.',
    '8. Complete the appointment in the system and process payment.',
  ].join('\n'),
};

const DEFAULTS: Record<string, SopDef> = {
  'laser-hair-removal': {
    title: 'Laser Hair Removal SOP',
    content: [
      '1. Confirm patch test completed (≥24–48h prior) with no adverse reaction.',
      '2. Verify skin type (Fitzroy) and select appropriate settings; review recent sun exposure.',
      '3. Confirm the area is shaved and product-free; review medications (photosensitising).',
      '4. Protective eyewear for client and clinician.',
      '5. Apply cooling; deliver pulses with consistent overlap, monitoring skin response.',
      '6. Post-treatment cooling; advise SPF, no heat/exercise 48h, no waxing between sessions.',
      '7. Record settings used and schedule the next session (4–6 weeks).',
    ].join('\n'),
  },
  'cosmetic-injections': {
    title: 'Anti-Wrinkle / Injectables SOP',
    content: [
      '1. Confirm medical history, allergies, pregnancy/breastfeeding status and consent.',
      '2. Review contraindications (neuromuscular disorders, infection at site, recent treatments).',
      '3. Mark injection points; photograph at rest and in animation (with consent).',
      '4. Aseptic technique; reconstitute/prepare product per protocol.',
      '5. Administer agreed units precisely; monitor for immediate reactions.',
      '6. Aftercare: stay upright 4h, no rubbing, no exercise 24h; advise review at 2 weeks.',
      '7. Record product, batch, units and sites in the clinical note.',
    ].join('\n'),
  },
  'veneers': {
    title: 'Porcelain Veneers SOP',
    content: [
      '1. Confirm treatment plan, shade and consent; review oral health and any sensitivities.',
      '2. Photograph and confirm the agreed smile design / mock-up.',
      '3. Prepare teeth per plan; take impressions/scans.',
      '4. Fit temporaries; confirm comfort and bite.',
      '5. At fit: check fit, shade and margins; bond per protocol; check occlusion.',
      '6. Aftercare: care instructions, night guard if indicated; book review.',
      '7. Record materials, shade and lab details.',
    ].join('\n'),
  },
};

export async function getSop(treatmentSlug: string): Promise<{ title: string; content: string; source: 'db' | 'default' }> {
  const row = await db.treatmentSop.findUnique({ where: { treatmentSlug } });
  if (row) return { title: row.title, content: row.content, source: 'db' };
  const def = DEFAULTS[treatmentSlug] ?? GENERIC;
  return { ...def, source: 'default' };
}

export function defaultSop(treatmentSlug: string): SopDef {
  return DEFAULTS[treatmentSlug] ?? GENERIC;
}

export type SopStep = {
  /** Display label (numbering stripped). */
  step: string;
  /** Steps that capture a client answer get a free-text response field. */
  capture: boolean;
};

// Parse SOP content (one step per line, optionally numbered) into checklist
// items. A step captures a response when it reads like a question/confirmation.
const CAPTURE_HINTS = /(confirm|ask|check|patch test|contraindication|medical|allerg|pregn|medication|consent|response|how (did|does)|any |reports)/i;

export function parseSopSteps(content: string): SopStep[] {
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const step = line.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim();
      const capture = /\?\s*$/.test(step) || CAPTURE_HINTS.test(step);
      return { step, capture };
    })
    .filter((s) => s.step.length > 0);
}
