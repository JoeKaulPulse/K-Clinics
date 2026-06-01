// Authoritative service catalogue, transcribed from the clinic's price matrix.
// Runs ONCE (guarded by a Setting marker): clears any bootstrap catalogue and
// loads the full set of services, variants, course pricing and the category
// discount offers. After this, everything is managed in the CRM. Durations use
// the matrix "minutes + doc" column (chair time incl. documentation).
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const MARKER = 'catalogue_v2_loaded';

function pickDirectUrl() {
  return [process.env.POSTGRES_URL_NON_POOLING, process.env.DATABASE_URL_UNPOOLED, process.env.POSTGRES_PRISMA_URL, process.env.DATABASE_URL, process.env.POSTGRES_URL]
    .filter(Boolean).find((u) => /^postgres(ql)?:\/\//.test(u)) || null;
}
const pence = (n) => Math.round(n * 100);
const courses = (arr) => (arr && arr.length ? arr.map(([sessions, total]) => ({ sessions, totalPence: pence(total) })) : undefined);

// service: [slug, name, treatmentSlug, category, rows]
// row: [name, price£, [[sessions,total£]...] | 0, durationMin]
const CATALOGUE = [
  ['lhr-women', 'Laser Hair Removal — Women', 'laser-hair-removal', 'aesthetics', [
    ['Bikini Line', 27, [[3,73],[6,115],[10,196]], 25], ['Brazilian', 35, [[3,92],[6,161],[10,200]], 30],
    ['Hollywood Brazilian (incl. Peri-Anal)', 41, [[3,104],[6,184],[10,276]], 40], ['Behind (Peri-Anal)', 26, [[3,71],[6,127],[10,184]], 20],
    ['Brazilian/Bikini & Underarms', 43, [[3,121],[6,214],[10,334]], 50], ['Hollywood Brazilian (incl. Peri-Anal) & Underarms', 49, [[3,138],[6,263],[10,403]], 50],
    ['Hollywood Brazilian (incl. Peri-Anal) & Full Legs', 119, [[3,345],[6,660],[10,1080]], 50], ['Full Leg & Underarms', 115, [[3,333],[6,594],[10,930]], 30],
    ['Lower Leg, Brazilian/Bikini & Underarms', 95, [[3,256],[6,456],[10,679]], 60], ['Full Legs, Brazilian/Bikini & Underarms', 121, [[3,328],[6,518],[10,794]], 70],
    ['Full Legs, Hollywood Brazilian (incl. Peri-Anal) & Underarms', 149, [[3,397],[6,656],[10,1024]], 70],
    ['Eyebrows (middle, above bridge of nose)', 11, [[3,28],[6,49],[10,69]], 20], ['Lip', 29, [[3,78],[6,135],[10,213]], 10],
    ['Chin', 28, [[3,78],[6,135],[10,213]], 10], ['Sides of Face', 29, [[3,76],[6,138],[10,207]], 25],
    ['Lip & Chin', 32, [[3,80],[6,145],[10,225]], 25], ['Jawline & Chin', 45, [[3,130],[6,228],[10,340]], 30],
    ['½ Face (forehead–nose or upper lip–chin)', 46, [[3,130],[6,228],[10,351]], 30], ['Front of Neck', 34, [[3,94],[6,173],[10,253]], 20],
    ['Back of Neck', 34, [[3,94],[6,173],[10,253]], 20], ['Full Face', 64, [[3,180],[6,311],[10,449]], 35], ['Full Face & Neck', 66, [[3,190],[6,345],[10,518]], 40],
    ['Underarms', 17, [[3,44],[6,76],[10,115]], 20], ['Snail Trail / Naval', 30, [[3,80],[6,138],[10,202]], 20], ['Areola', 32, [[3,87],[6,152],[10,225]], 20],
    ['Stomach', 43, [[3,114],[6,201],[10,288]], 25], ['Shoulders', 43, [[3,114],[6,201],[10,288]], 25], ['½ Arms', 58, [[3,166],[6,304],[10,449]], 30],
    ['Chest', 69, [[3,190],[6,325],[10,483]], 30], ['½ Back', 81, [[3,225],[6,380],[10,564]], 30], ['Chest & Stomach', 87, [[3,239],[6,449],[10,656]], 35],
    ['Full Arms', 104, [[3,294],[6,546],[10,804]], 35], ['Full Back', 115, [[3,328],[6,587],[10,863]], 40],
    ['Fingers & Toes', 23, [[3,59],[6,104],[10,150]], 20], ['Feet & Toes', 23, [[3,59],[6,104],[10,150]], 20], ['Buttocks', 68, [[3,187],[6,349],[10,541]], 25],
    ['Lower Leg', 84, [[3,242],[6,449],[10,679]], 30], ['Full Legs', 101, [[3,290],[6,552],[10,863]], 40], ['Full Body', 218, [[3,570],[6,828],[10,1139]], 70],
  ]],
  ['lhr-men', 'Laser Hair Removal — Men', 'laser-hair-removal-for-men', 'aesthetics', [
    ['Centre Brow', 17, [[3,45],[6,72],[10,100]], 20], ['Front of Neck', 57, [[3,159],[6,297],[10,449]], 20], ['Back of Neck', 57, [[3,159],[6,297],[10,449]], 20],
    ['Full Beard', 75, [[3,207],[6,373],[10,588]], 30], ['Full Beard & Neck', 90, [[3,256],[6,449],[10,679]], 40],
    ['Underarms', 33, [[3,90],[6,159],[10,229]], 20], ['½ Arms', 90, [[3,242],[6,442],[10,679]], 30], ['Shoulders', 90, [[3,242],[6,442],[10,679]], 30],
    ['Lower Back', 90, [[3,242],[6,442],[10,679]], 30], ['Full Arms', 105, [[3,297],[6,539],[10,817]], 40], ['Chest', 105, [[3,297],[6,539],[10,817]], 30],
    ['Stomach', 105, [[3,297],[6,539],[10,817]], 30], ['Chest & Stomach', 115, [[3,321],[6,601],[10,909]], 40], ['Full Back', 147, [[3,325],[6,590],[10,825]], 40],
    ['Full Back & Shoulders', 158, [[3,449],[6,863],[10,1254]], 50], ['Full Back, Shoulders, Chest & Stomach', 219, [[3,618],[6,1132],[10,1714]], 70],
    ['Full Body (excl. face)', 321, [[3,894],[6,1650],[10,2519]], 70],
    ['Feet & Toes', 61, [[3,170],[6,304],[10,472]], 20], ['Buttocks', 63, [[3,170],[6,311],[10,472]], 30], ['Male Brazilian', 95, [[3,273],[6,497],[10,771]], 40],
    ['Lower Legs', 110, [[3,308],[6,594],[10,909]], 40], ['Any Male Bikini (incl. Peri-Anal)', 118, [[3,314],[6,580],[10,897]], 50], ['Full Legs', 147, [[3,418],[6,773],[10,1139]], 60],
  ]],
  ['intimate-rejuvenation', 'Intimate Rejuvenation', 'intimate-rejuvenation', 'aesthetics', [
    ['CO2 Laser Rejuvenation', 690, [[3,1890],[6,3420]], 40], ['Intimate Area Whitening', 690, [[3,1890]], 40],
  ]],
  ['laser-pigmentation', 'Laser Pigmentation Removal', 'pigmentation-correction', 'aesthetics', [
    ['Nose', 18, [[3,54],[6,104]], 20], ['½ Face', 52, [[3,147],[6,273]], 30], ['¾ Face', 63, [[3,182],[6,342]], 35], ['Full Face', 64, [[3,182],[6,342]], 50],
    ['Front of Neck', 52, [[3,147],[6,273]], 25], ['Back of Neck', 52, [[3,147],[6,273]], 25], ['Décolletage', 52, [[3,147],[6,273]], 30],
    ['Face, Neck & Décolletage', 206, [[3,584],[6,1098]], 60], ['Shoulders', 63, [[3,182],[6,342]], 30], ['Hands & Fingers', 52, [[3,147],[6,273]], 25],
    ['¼ Arms', 63, [[3,182],[6,273]], 30], ['½ Arms', 98, [[3,297],[6,549]], 40], ['Full Arms', 145, [[3,411],[6,787]], 50],
    ['¼ Back', 98, [[3,285],[6,549]], 30], ['½ Back', 121, [[3,352],[6,642]], 40], ['¾ Back', 138, [[3,404],[6,746]], 50], ['Full Back', 161, [[3,473],[6,884]], 60],
    ['Back & Shoulders', 219, [[3,646],[6,1229]], 60], ['Stomach', 121, [[3,352],[6,642]], 40],
    ['¼ Legs', 121, [[3,352],[6,642]], 30], ['½ Legs', 190, [[3,549],[6,1029]], 50], ['¾ Legs', 225, [[3,653],[6,1236]], 55], ['Full Legs', 282, [[3,825],[6,1581]], 70],
  ]],
  ['vascular-lesions', 'Vascular Lesions Treatment', 'vascular-lesions-treatment', 'aesthetics', [
    ['Single Vein', 18, [[3,53],[6,98]], 20], ['Small Area', 42, [[3,125],[6,242]], 25], ['Medium Area', 54, [[3,161],[6,314]], 30], ['Large Area', 66, [[3,197],[6,386]], 40],
  ]],
  ['spider-veins', 'Spider Veins Removal', 'spider-veins-removal', 'aesthetics', [
    ['Nose Thread Vein', 230, [[2,416]], 25], ['Cheek Thread Vein', 296, [[2,537]], 30], ['Leg Thread Vein', 417, [[2,801],[3,1149]], 40],
  ]],
  ['carbon-laser-peel', 'Carbon Laser Facial (Hollywood Peel)', 'carbon-laser-peel', 'aesthetics', [
    ['Neck', 90, [[3,256],[6,479]], 30], ['Full Face', 121, [[3,331],[6,599]], 50], ['Face & Neck', 205, [[3,552],[6,977]], 60], ['Face, Neck & Décolleté', 237, [[3,624],[6,1122]], 70],
  ]],
  ['fungal-nail', 'Laser Fungal Nail Treatment', 'fungal-nail-infection-treatment', 'aesthetics', [
    ['1 Foot', 79, [[6,372],[10,515]], 30], ['2 Feet', 100, [[6,498],[10,620]], 40],
  ]],
  ['laser-tattoo-removal', 'Laser Tattoo Removal', 'laser-tattoo-removal', 'aesthetics', [
    ['Very Small (1–3 cm)', 44, [[6,245],[10,385]], 20], ['Small (4–6 cm)', 66, [[6,245],[10,385]], 20], ['Medium (7–15 cm)', 116, [[6,627],[10,935]], 25],
    ['Large (16–20 cm)', 165, [[6,957],[10,1485]], 35], ['X-Large (21 cm+)', 237, [[6,1314],[10,2035]], 45],
  ]],
  ['pmu-removal', 'Permanent Make-Up Removal', 'laser-tattoo-removal', 'aesthetics', [
    ['Eyebrows', 275, [[4,1060],[6,1530]], 30],
  ]],
  ['hydrafacial', 'HydraFacial', 'hydraglow-facial', 'aesthetics', [
    ['Signature Express (30 min)', 95, [[3,267],[6,474]], 40], ['Full Face Deluxe (50 min)', 145, [[3,399],[6,708]], 60],
    ['Platinum — Anti-Acne (60 min)', 185, [[3,519],[6,948]], 70], ['Platinum — Collagen (60 min)', 185, [[3,519],[6,948]], 70],
    ['Platinum — Pigmentation & Sun Damage (60 min)', 185, [[3,519],[6,948]], 70], ['Platinum — Anti-Ageing (60 min)', 185, [[3,519],[6,948]], 70],
    ['Platinum — Brightening (60 min)', 185, [[3,519],[6,948]], 70],
  ]],
  ['smas-hifu', 'SMAS HIFU Lifting', 'smas-hifu-lifting', 'aesthetics', [
    ['Eyebrow Lift', 349, [[3,975]], 30], ['Forehead Lift', 349, [[3,975]], 30], ['Neck Lift', 349, [[3,975]], 40], ['Jawline Lift', 399, [[3,1125]], 40],
    ['Full Face', 479, [[3,1305]], 70], ['Full Face & Neck', 559, [[3,1485]], 80], ['Stomach', 399, [[3,1125]], 70], ['Outer Thighs', 329, [[3,915]], 70],
    ['Inner Thighs', 349, [[3,975]], 70], ['Back & Flanks', 329, [[3,915]], 80], ['Buttock', 349, [[3,975]], 70], ['Skin Above the Knee Caps', 309, [[3,885]], 40],
    ['Arms (bingo wings)', 349, [[3,975]], 50],
  ]],
  ['cosmetic-peels', 'Cosmetic Peels', 'face-treatments', 'aesthetics', [
    ['Full Face', 115, [[3,315],[6,570]], 40], ['Face & Neck', 155, [[3,435],[6,810]], 50],
  ]],
  ['fat-dissolving', 'Fat-Dissolving Injections', 'cosmetic-injections', 'aesthetics', [
    ['Face (per vial)', 150, 0, 40], ['Body (per vial)', 150, 0, 55],
  ]],
  ['rf-lifting', 'RF Lifting', 'rf-lifting', 'aesthetics', [['RF Lifting', 260, [[3,690],[5,1075]], 45]]],
  ['ipl-phototherapy', 'IPL Phototherapy', 'ipl-phototherapy', 'aesthetics', [['IPL Phototherapy', 200, [[3,540],[5,800]], 45]]],
  ['laser-skin-rejuvenation', 'Laser Skin Rejuvenation', 'laser-skin-rejuvenation', 'aesthetics', [['Face & Neck', 210, [[3,570],[5,850]], 45]]],
  ['laser-skin-resurfacing', 'Laser Skin Resurfacing', 'laser-skin-resurfacing', 'aesthetics', [['Laser Skin Resurfacing', 180, [[3,480],[5,450]], 45]]],
  ['endosphere', 'Endosphere Body Contouring', 'body-contouring', 'aesthetics', [['Endosphere', 110, [[3,300],[6,540],[10,800]], 60]]],
  ['caci', 'CACI Treatment', 'face-treatments', 'aesthetics', [
    ['CACI Eye Lift', 70, [[3,198],[6,378],[10,590],[12,684]], 40], ['CACI Face & Neck Lift', 140, [[3,405],[6,780],[10,1260],[12,1440]], 70],
    ['CACI with Hydra Mask', 150, [[3,438],[6,852],[10,1380],[12,1596]], 70], ['CACI Jaw Line Lift', 70, [[3,198],[6,378],[10,590],[12,684]], 40],
  ]],
  ['red-carpet-lift', 'Red Carpet Lift', 'face-treatments', 'aesthetics', [['Red Carpet Lift', 200, [[3,576]], 70]]],
];

// Category discount offers (promoted): [serviceSlug, percentOff, label]
const OFFERS = [
  ['lhr-women', 15, 'Laser Hair Removal — Women'],
  ['lhr-men', 15, 'Laser Hair Removal — Men'],
  ['laser-pigmentation', 15, 'Laser Pigmentation Removal'],
  ['vascular-lesions', 20, 'Vascular Lesions Treatment'],
  ['spider-veins', 10, 'Spider Veins Removal'],
  ['carbon-laser-peel', 5, 'Carbon Laser Facial'],
  ['laser-tattoo-removal', 10, 'Laser Tattoo Removal'],
];

// Strip a trailing discount phrase ("— 10% off") from a name.
const cleanLabel = (s) => s.replace(/\s*[—–-]+\s*£?\d+%?\s*off\s*$/i, '').trim() || s;

async function main() {
  if (process.env.GHPAGES === 'true' || !pickDirectUrl()) { console.log('[seed-catalogue] skipped (no DB).'); return; }

  // Always-run, idempotent: tidy any offer names that embed a discount phrase
  // (so they don't render as "… — 10% off — 10% off"). Runs even after load.
  try {
    const existing = await db.serviceOffer.findMany({ select: { id: true, name: true } });
    for (const o of existing) {
      const cleaned = cleanLabel(o.name);
      if (cleaned !== o.name) await db.serviceOffer.update({ where: { id: o.id }, data: { name: cleaned } });
    }
  } catch { /* table may not exist yet on first sync */ }

  const marker = await db.setting.findUnique({ where: { key: MARKER } }).catch(() => null);
  if (marker) { console.log('[seed-catalogue] offer names normalized; catalogue already loaded.'); return; }

  // Clear any bootstrap catalogue, then load the authoritative one.
  await db.serviceOffer.deleteMany({});
  await db.serviceVariant.deleteMany({});
  await db.service.deleteMany({});

  const slugToId = {};
  let nServices = 0, nVariants = 0;
  for (let i = 0; i < CATALOGUE.length; i++) {
    const [slug, name, treatmentSlug, category, rows] = CATALOGUE[i];
    const svc = await db.service.create({ data: { slug, name, treatmentSlug, category, order: i, active: true } });
    slugToId[slug] = svc.id;
    nServices++;
    await db.serviceVariant.createMany({
      data: rows.map((r, j) => ({ serviceId: svc.id, name: r[0], pricePence: pence(r[1]), courses: courses(r[2] || undefined), durationMin: r[3] || 30, order: j })),
    });
    nVariants += rows.length;
  }

  for (const [slug, pct, label] of OFFERS) {
    if (slugToId[slug]) await db.serviceOffer.create({ data: { name: label, scope: 'SERVICE', serviceId: slugToId[slug], percentOff: pct, promoted: true, active: true, createdBy: 'seed' } });
  }

  await db.setting.upsert({ where: { key: MARKER }, update: { value: 'true' }, create: { key: MARKER, value: 'true' } });
  console.log(`[seed-catalogue] loaded ${nServices} services, ${nVariants} variants, ${OFFERS.length} offers.`);
}

main().catch((e) => console.error('[seed-catalogue] failed (non-fatal):', e?.message || e)).finally(() => db.$disconnect());
