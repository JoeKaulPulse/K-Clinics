import 'server-only';
import { db } from '@/lib/db';

// Hand-authored bite-size flows for flagship lessons — tighter than auto-chunk,
// with mascot lines, illustrations and interspersed checks (incl. the new
// "select the right word"). Applied to Lesson.steps only where it's still null,
// so they never overwrite admin edits and auto-chunk still covers everything else.

type Step =
  | { kind: 'teach'; title?: string; text: string; art?: string }
  | { kind: 'say'; text: string; mood?: 'happy' | 'think' | 'cheer' }
  | { kind: 'ask'; prompt: string; qtype?: 'SINGLE' | 'MULTI' | 'TRUEFALSE' | 'WORD'; options: string[]; correct: number[]; explanation?: string; tip?: string; art?: string };

export const AUTHORED_FLOWS: { courseSlug: string; lessonTitle: string; steps: Step[] }[] = [
  {
    courseSlug: 'level-2-foundation-skin-laser',
    lessonTitle: 'Structure of the Skin: Epidermis, Dermis & Hypodermis',
    steps: [
      { kind: 'say', text: 'Welcome! Let’s start with the skin itself — the canvas for everything you’ll do.', mood: 'happy' },
      { kind: 'teach', title: 'Three layers', text: 'Skin has three layers. From the surface down: the epidermis, the dermis, and the hypodermis.', art: 'skin-layers' },
      { kind: 'teach', title: 'Epidermis', text: 'The epidermis is the outer layer. It has no blood supply of its own — it’s fed by the dermis below.', art: 'skin-layers' },
      { kind: 'ask', prompt: 'Which layer is the outermost?', qtype: 'SINGLE', options: ['Epidermis', 'Dermis', 'Hypodermis'], correct: [0], explanation: 'The epidermis is the surface layer you see and touch.', tip: 'It’s the one you’d touch first.' },
      { kind: 'say', text: 'Nice. Here’s a detail examiners love…', mood: 'think' },
      { kind: 'teach', text: 'Cells in the epidermis travel up from the base to the surface over about 28 days, then flake away.' },
      { kind: 'ask', prompt: 'New skin cells reach the surface in about ___ days.', qtype: 'WORD', options: ['14', '28', '90'], correct: [1], explanation: 'Around 28 days — a key figure to remember.' },
      { kind: 'teach', title: 'Dermis', text: 'Below sits the dermis — rich in collagen and elastin, with blood vessels, nerves and hair follicles.', art: 'collagen' },
      { kind: 'ask', prompt: 'Which layer contains the blood vessels and hair follicles?', qtype: 'SINGLE', options: ['Epidermis', 'Dermis', 'Stratum corneum'], correct: [1], explanation: 'The dermis holds the blood supply, nerves and follicles.' },
      { kind: 'teach', title: 'Hypodermis', text: 'The deepest layer is the hypodermis — mostly fat. It cushions, insulates and anchors the skin.' },
      { kind: 'say', text: 'That’s the structure. Quick recap…', mood: 'happy' },
      { kind: 'ask', prompt: 'Which is the deepest layer?', qtype: 'SINGLE', options: ['Epidermis', 'Dermis', 'Hypodermis'], correct: [2], explanation: 'The hypodermis sits beneath the dermis.' },
      { kind: 'say', text: 'Brilliant — you’ve got the three layers down.', mood: 'cheer' },
    ],
  },
  {
    courseSlug: 'level-2-foundation-skin-laser',
    lessonTitle: 'Functions of the Skin & Wound Healing',
    steps: [
      { kind: 'say', text: 'Now — what does skin actually do?', mood: 'happy' },
      { kind: 'teach', title: 'The skin’s jobs', text: 'Skin protects you, controls temperature, senses the world, makes vitamin D, and supports your immune defence.' },
      { kind: 'ask', prompt: 'Which of these are jobs of the skin?', qtype: 'MULTI', options: ['Thermoregulation', 'Vitamin D', 'Making insulin', 'Protection'], correct: [0, 1, 3], explanation: 'Skin regulates temperature, makes vitamin D and protects — insulin comes from the pancreas.' },
      { kind: 'teach', title: 'Acid mantle', text: 'A thin acidic film (pH ~4.5–5.5) sits on the surface — the acid mantle — keeping microbes at bay.', art: 'safety' },
      { kind: 'ask', prompt: 'Healthy skin’s surface is slightly ___.', qtype: 'WORD', options: ['acidic', 'alkaline', 'neutral'], correct: [0], explanation: 'Around pH 4.5–5.5 — slightly acidic.' },
      { kind: 'say', text: 'Treatments create controlled injury, so healing matters. Four phases coming up…', mood: 'think' },
      { kind: 'teach', title: 'Healing, in order', text: '1) Haemostasis — bleeding stops.\n2) Inflammation — redness and cleanup.\n3) Proliferation — new collagen.\n4) Remodelling — it strengthens over weeks.' },
      { kind: 'ask', prompt: 'In which phase do fibroblasts lay down new collagen?', qtype: 'SINGLE', options: ['Haemostasis', 'Inflammation', 'Proliferation', 'Remodelling'], correct: [2], explanation: 'Proliferation — new collagen and vessels form.', tip: 'It’s the building phase.' },
      { kind: 'teach', text: 'Smoking, diabetes, poor nutrition and some medicines all slow healing — worth noting in a consultation.' },
      { kind: 'say', text: 'Great work — you can explain what skin does and how it heals.', mood: 'cheer' },
    ],
  },
];

/** Apply authored flows to matching lessons whose steps are still null. Idempotent;
 *  safe to run from the daily cron. */
export async function enrichAuthoredStepsIfNeeded(): Promise<{ updated: number }> {
  let updated = 0;
  for (const f of AUTHORED_FLOWS) {
    const course = await db.course.findFirst({ where: { slug: f.courseSlug }, select: { id: true } }).catch(() => null);
    if (!course) continue;
    const lessons = await db.lesson.findMany({ where: { title: f.lessonTitle, module: { courseId: course.id } }, select: { id: true, steps: true } });
    for (const l of lessons) {
      if (l.steps == null) { await db.lesson.update({ where: { id: l.id }, data: { steps: f.steps as object } }).catch(() => {}); updated++; }
    }
  }
  return { updated };
}
