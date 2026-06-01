// Idempotent first-run seed for the Islington clinic's rooms & equipment.
// Runs on deploy AFTER db-sync, but only when NO rooms exist yet — so it
// provisions the floor plan once and never fights manual edits afterwards.
//
// Floor plan (from the owner):
//  • Ground (G):       3 aesthetics rooms + 2 dental rooms
//                      (sterilisation room, 2 WCs — not bookable)
//  • Lower ground (LG): 6 treatment rooms
//                      (office/storage, kitchenette, 2 WCs — not bookable)
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function pickDirectUrl() {
  return [
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
  ].filter(Boolean).find((u) => /^postgres(ql)?:\/\//.test(u)) || null;
}

async function main() {
  if (process.env.GHPAGES === 'true' || !pickDirectUrl()) {
    console.log('[seed-rooms] skipped (no direct postgres URL / static export).');
    return;
  }
  const existing = await db.resource.count({ where: { kind: 'ROOM' } });
  if (existing > 0) {
    console.log(`[seed-rooms] skipped — ${existing} room(s) already configured.`);
    return;
  }

  // Attach to the primary location if one exists, else leave site-agnostic.
  const primary = await db.location.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  const locationId = primary?.id ?? null;

  const rooms = [
    // Ground floor
    { slug: 'g-aesthetics-1', name: 'Aesthetics 1', floor: 'G', tags: ['aesthetics'] },
    { slug: 'g-aesthetics-2', name: 'Aesthetics 2', floor: 'G', tags: ['aesthetics'] },
    { slug: 'g-aesthetics-3', name: 'Aesthetics 3', floor: 'G', tags: ['aesthetics'] },
    { slug: 'g-dental-1', name: 'Dental 1', floor: 'G', tags: ['dental'] },
    { slug: 'g-dental-2', name: 'Dental 2', floor: 'G', tags: ['dental'] },
    // Lower ground — flexible treatment rooms (aesthetics)
    ...Array.from({ length: 6 }, (_, i) => ({
      slug: `lg-treatment-${i + 1}`, name: `Treatment ${i + 1}`, floor: 'LG', tags: ['aesthetics'],
    })),
  ];

  for (const r of rooms) {
    await db.resource.create({ data: { kind: 'ROOM', capacity: 1, active: true, locationId, ...r } });
  }

  // Shared equipment — one of each by default; edit units/availability in admin.
  const equipment = [
    { slug: 'laser', name: 'Laser machine', capacity: 1 },
    { slug: 'hifu', name: 'HIFU machine', capacity: 1 },
  ];
  for (const e of equipment) {
    const has = await db.resource.findFirst({ where: { kind: 'EQUIPMENT', slug: e.slug } });
    if (!has) await db.resource.create({ data: { kind: 'EQUIPMENT', tags: [], active: true, locationId, ...e } });
  }

  console.log(`[seed-rooms] created ${rooms.length} rooms + ${equipment.length} equipment.`);
}

main().catch((e) => { console.error('[seed-rooms] failed (non-fatal):', e?.message || e); }).finally(() => db.$disconnect());
