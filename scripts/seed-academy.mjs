// First-run seed for K Academy — a few representative courses so the section is
// populated on launch. Runs once (only when no courses exist); the owner then
// manages everything in the CRM.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const pence = (n) => Math.round(n * 100);

function pickDirectUrl() {
  return [process.env.POSTGRES_URL_NON_POOLING, process.env.DATABASE_URL_UNPOOLED, process.env.POSTGRES_PRISMA_URL, process.env.DATABASE_URL, process.env.POSTGRES_URL]
    .filter(Boolean).find((u) => /^postgres(ql)?:\/\//.test(u)) || null;
}

const COURSES = [
  {
    slug: 'level-2-foundation-skin-laser', title: 'Level 2 Foundation in Skin & Laser', level: 'Level 2', price: 1495, featured: false,
    summary: 'Your first step into aesthetics — skin science, safety and supervised laser fundamentals.',
    description: 'A regulated foundation award covering anatomy and physiology, skin types and conditions, health & safety, consultation skills and supervised laser fundamentals. The ideal entry point for a career in aesthetics.',
    durationText: 'Online theory + 2 practical days + assessment', format: 'Blended: online theory & tests + practical + VTCT exam',
    accreditations: ['OFQUAL', 'VTCT', 'CPD'],
    outcomes: ['Skin anatomy, types and conditions', 'Client consultation and contraindications', 'Health, safety and infection control', 'Supervised laser fundamentals'],
    prerequisites: 'None — open to newcomers aged 18+.',
  },
  {
    slug: 'level-3-laser-aesthetic-therapies', title: 'Level 3 Certificate in Laser & Aesthetic Therapies', level: 'Level 3', price: 2495, featured: false,
    summary: 'Core laser and light therapies — hair removal, skin rejuvenation and pigmentation.',
    description: 'Build clinical competence across laser hair removal, IPL, skin rejuvenation and pigmentation treatments, with hands-on practice on live models in a working clinic.',
    durationText: 'Online theory + 3 practical days + assessment', format: 'Blended: online theory & tests + practical + VTCT exam',
    accreditations: ['OFQUAL', 'VTCT', 'CPD'],
    outcomes: ['Laser & IPL hair removal', 'Skin rejuvenation and pigmentation', 'Device settings and skin typing', 'Treatment planning and aftercare'],
    prerequisites: 'Level 2 or relevant experience.',
  },
  {
    slug: 'level-4-certificate-aesthetic-practice', title: 'Level 4 Certificate in Aesthetic Practice', level: 'Level 4', price: 3500, featured: true,
    summary: 'Our flagship qualification — advanced laser and aesthetic practice to professional standard.',
    description: 'The qualification employers and insurers look for. Advanced laser and aesthetic practice, complex case management, and the clinical judgement to work independently. Delivered in a live Islington clinic on professional equipment.',
    durationText: 'Online theory + practical days + VTCT exam', format: 'Blended: online theory & tests + practical + VTCT exam',
    accreditations: ['OFQUAL', 'VTCT', 'CPD'],
    outcomes: ['Advanced laser & light treatments', 'Complex skin and case management', 'Clinical decision-making and risk', 'Professional practice and accountability'],
    prerequisites: 'Level 3 or equivalent clinical/beauty experience.',
    cohorts: [45, 90], // days from now
  },
  {
    slug: 'advanced-aesthetics-level-5-7', title: 'Advanced Aesthetics — Levels 5–7', level: 'Levels 5–7', price: 0, featured: true,
    summary: 'Advanced injectables and beyond — premium pathways launching soon.',
    description: 'Our advanced pathways (Levels 5–7) take qualified practitioners to the highest level of aesthetic practice. Currently in accreditation — register your interest to be first to enrol.',
    durationText: 'Premium, modular delivery', format: 'Blended: online theory & tests + practical + exam',
    accreditations: ['CPD'],
    outcomes: ['Advanced injectables', 'Complications management', 'Aesthetic medicine principles'],
    prerequisites: 'Level 4 qualification.',
  },
];

async function main() {
  if (process.env.GHPAGES === 'true' || !pickDirectUrl()) { console.log('[seed-academy] skipped (no DB).'); return; }
  if ((await db.course.count()) > 0) { console.log('[seed-academy] skipped (courses exist).'); return; }

  for (let i = 0; i < COURSES.length; i++) {
    const c = COURSES[i];
    const course = await db.course.create({
      data: {
        slug: c.slug, title: c.title, level: c.level, summary: c.summary, description: c.description,
        pricePence: pence(c.price), durationText: c.durationText, format: c.format,
        accreditations: c.accreditations, outcomes: c.outcomes, prerequisites: c.prerequisites,
        featured: c.featured, active: true, order: i,
      },
    });
    for (const days of c.cohorts ?? []) {
      const start = new Date(); start.setDate(start.getDate() + days); start.setHours(9, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      await db.cohort.create({ data: { courseId: course.id, startAt: start, endAt: end, capacity: 8, location: 'Islington, London', status: 'OPEN' } });
    }
  }
  console.log(`[seed-academy] created ${COURSES.length} courses.`);
}

main().catch((e) => console.error('[seed-academy] failed (non-fatal):', e?.message || e)).finally(() => db.$disconnect());
