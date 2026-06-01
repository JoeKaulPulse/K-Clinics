// Idempotent first-run seed for the CRM service catalogue, built from the
// published price matrix (mirrors lib/pricing.ts). Runs once — only when no
// services exist — then prices/costs/offers are managed in the CRM.
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
const gbp = (v) => (typeof v === 'number' ? Math.round(v * 100) : 0); // £ → pence; non-numeric → on consultation

function pickDirectUrl() {
  return [process.env.POSTGRES_URL_NON_POOLING, process.env.DATABASE_URL_UNPOOLED, process.env.POSTGRES_PRISMA_URL, process.env.DATABASE_URL, process.env.POSTGRES_URL]
    .filter(Boolean).find((u) => /^postgres(ql)?:\/\//.test(u)) || null;
}

// [heading, treatmentSlug, category, defaultDurationMin, rows[]]
// rows: [name, sessionPrice(£ or string), courses?[[sessions,total£]...]]
const GROUPS = [
  ['Laser Hair Removal — Women', 'laser-hair-removal', 'aesthetics', 15, [
    ['Eyebrows', 11, [[3, 28], [6, 49], [10, 69]]], ['Lip', 29, [[3, 78], [6, 135], [10, 213]]],
    ['Chin', 28, [[3, 78], [6, 135], [10, 213]]], ['Lip & Chin', 32, [[3, 80], [6, 145], [10, 225]]],
    ['Sides of Face', 29, [[3, 76], [6, 138], [10, 207]]], ['Jawline & Chin', 45, [[3, 130], [6, 228], [10, 340]]],
    ['Full Face', 64, [[3, 180], [6, 311], [10, 449]]], ['Full Face & Neck', 66, [[3, 190], [6, 345], [10, 518]]],
    ['Underarms', 17, [[3, 44], [6, 76], [10, 115]]], ['Bikini Line', 27, [[3, 73], [6, 115], [10, 196]]],
    ['Brazilian', 35, [[3, 92], [6, 161], [10, 200]]], ['Hollywood Brazilian (incl. Peri-Anal)', 41, [[3, 104], [6, 184], [10, 276]]],
    ['½ Arms', 58, [[3, 166], [6, 304], [10, 449]]], ['Full Arms', 104, [[3, 294], [6, 546], [10, 804]]],
    ['Full Back', 115, [[3, 328], [6, 587], [10, 863]]], ['Lower Leg', 84, [[3, 242], [6, 449], [10, 679]]],
    ['Full Legs', 101, [[3, 290], [6, 552], [10, 863]]], ['Full Body', 218, [[3, 570], [6, 828], [10, 1139]]],
  ]],
  ['Laser Hair Removal — Men', 'laser-hair-removal-for-men', 'aesthetics', 15, [
    ['Centre Brow', 17, [[3, 45], [6, 72], [10, 100]]], ['Full Beard', 75, [[3, 207], [6, 373], [10, 588]]],
    ['Full Beard & Neck', 90, [[3, 256], [6, 449], [10, 679]]], ['Underarms', 33, [[3, 90], [6, 159], [10, 229]]],
    ['Chest', 105, [[3, 297], [6, 539], [10, 817]]], ['Full Arms', 105, [[3, 297], [6, 539], [10, 817]]],
    ['Full Back & Shoulders', 158, [[3, 449], [6, 863], [10, 1254]]], ['Male Brazilian', 95, [[3, 273], [6, 497], [10, 771]]],
    ['Full Legs', 147, [[3, 418], [6, 773], [10, 1139]]], ['Full Body (excl. face)', 321, [[3, 894], [6, 1650], [10, 2519]]],
  ]],
  ['SMAS HIFU Lifting', 'smas-hifu-lifting', 'aesthetics', 30, [
    ['Eyebrow Lift', 349, [[3, 975]]], ['Forehead Lift', 349, [[3, 975]]], ['Neck Lift', 349, [[3, 975]]],
    ['Jawline Lift', 399, [[3, 1125]]], ['Full Face', 479, [[3, 1305]]], ['Full Face & Neck', 559, [[3, 1485]]],
    ['Stomach', 399, [[3, 1125]]], ['Arms (bingo wings)', 349, [[3, 975]]], ['Buttock', 349, [[3, 975]]],
  ]],
  ['HydraFacial', 'hydraglow-facial', 'aesthetics', 30, [
    ['Signature Express (30 min)', 95, [[3, 267], [6, 474]]], ['Full Face Deluxe (50 min)', 145, [[3, 399], [6, 708]]],
    ['Platinum (60 min)', 185, [[3, 519], [6, 948]]],
  ]],
  ['Carbon Laser Facial (Hollywood Peel)', 'carbon-laser-peel', 'aesthetics', 40, [
    ['Full Face', 121, [[3, 331], [6, 599]]], ['Face & Neck', 205, [[3, 552], [6, 977]]],
    ['Face, Neck & Décolleté', 237, [[3, 624], [6, 1122]]],
  ]],
  ['Skin & Rejuvenation', 'laser-skin-rejuvenation', 'aesthetics', 45, [
    ['RF Lifting', 260, [[3, 690], [5, 1075]]], ['IPL Phototherapy', 200, [[3, 540], [5, 800]]],
    ['Laser Skin Rejuvenation (Face & Neck)', 210, [[3, 570], [5, 850]]], ['Laser Skin Resurfacing', 180, [[3, 480], [5, 450]]],
    ['Cosmetic Peel — Full Face', 115, [[3, 315], [6, 570]]], ['Cosmetic Peel — Face & Neck', 155, [[3, 435], [6, 810]]],
  ]],
  ['Body Contouring', 'body-contouring', 'aesthetics', 60, [
    ['Endosphere', 110, [[3, 300], [6, 540], [10, 800]]],
    ['Face Fat-Dissolving Injections (per vial)', 150], ['Body Fat-Dissolving Injections (per vial)', 150],
  ]],
  ['Laser Tattoo Removal', 'laser-tattoo-removal', 'aesthetics', 15, [
    ['Very Small (1–3 cm)', 44, [[6, 245], [10, 385]]], ['Small (4–6 cm)', 66, [[6, 245], [10, 385]]],
    ['Medium (7–15 cm)', 116, [[6, 627], [10, 935]]], ['Large (16–20 cm)', 165, [[6, 957], [10, 1485]]],
    ['X-Large (21 cm+)', 'On consultation'],
  ]],
  ['Laser Pigmentation Removal', 'pigmentation-correction', 'aesthetics', 20, [
    ['Nose', 18, [[3, 54], [6, 104]]], ['½ Face', 52, [[3, 147], [6, 273]]], ['Full Face', 64, [[3, 182], [6, 342]]],
    ['Face, Neck & Décolletage', 206, [[3, 584], [6, 1098]]], ['Full Back', 161, [[3, 473], [6, 884]]], ['Full Legs', 282, [[3, 825], [6, 1581]]],
  ]],
  ['Vascular & Thread Veins', 'vascular-lesions-treatment', 'aesthetics', 20, [
    ['Single Vein', 18, [[3, 53], [6, 98]]], ['Small Area', 42, [[3, 125], [6, 242]]], ['Large Area', 66, [[3, 197], [6, 386]]],
    ['Nose Thread Vein', 230, [[2, 416]]], ['Cheek Thread Vein', 296, [[2, 537]]], ['Leg Thread Vein', 417, [[2, 801], [3, 1149]]],
  ]],
  ['Intimate Rejuvenation', 'intimate-rejuvenation', 'aesthetics', 40, [
    ['CO2 Laser Rejuvenation', 690, [[3, 1890], [6, 3420]]], ['Intimate Area Whitening', 690, [[3, 1890]]],
  ]],
  ['Non-Surgical Toning (CACI) & More', 'face-treatments', 'aesthetics', 45, [
    ['CACI Eye Lift', 70, [[3, 198], [6, 378], [10, 590]]], ['CACI Face & Neck Lift', 140, [[3, 405], [6, 780], [10, 1260]]],
    ['CACI with Hydra Mask', 150, [[3, 438], [6, 852], [10, 1380]]], ['Red Carpet Lift', 200, [[3, 576]]],
    ['Laser Fungal Nail — 1 Foot', 79, [[6, 372], [10, 515]]], ['Laser Fungal Nail — 2 Feet', 100, [[6, 498], [10, 620]]],
    ['Permanent Make-Up Removal — Eyebrows', 275, [[4, 1060], [6, 1530]]],
  ]],
];

async function main() {
  if (process.env.GHPAGES === 'true' || !pickDirectUrl()) { console.log('[seed-services] skipped (no DB).'); return; }
  const existing = await db.service.count();
  if (existing > 0) { console.log(`[seed-services] skipped — ${existing} service(s) already exist.`); return; }

  let services = 0, variants = 0;
  for (let gi = 0; gi < GROUPS.length; gi++) {
    const [heading, treatmentSlug, category, dur, rows] = GROUPS[gi];
    const service = await db.service.create({
      data: { slug: slugify(heading), treatmentSlug, name: heading, category, order: gi, active: true },
    });
    services++;
    for (let ri = 0; ri < rows.length; ri++) {
      const [name, session, courses] = rows[ri];
      const minMatch = /\((\d+)\s*min\)/.exec(name);
      await db.serviceVariant.create({
        data: {
          serviceId: service.id, name, order: ri,
          durationMin: minMatch ? Number(minMatch[1]) : dur,
          pricePence: gbp(session),
          courses: courses ? courses.map(([sessions, total]) => ({ sessions, totalPence: gbp(total) })) : undefined,
        },
      });
      variants++;
    }
  }
  console.log(`[seed-services] created ${services} services, ${variants} variants.`);
}

main().catch((e) => console.error('[seed-services] failed (non-fatal):', e?.message || e)).finally(() => db.$disconnect());
