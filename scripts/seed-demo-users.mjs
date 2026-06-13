// BLD-285: seed one demo AdminUser per non-owner role for QA of role-shaped
// dashboards. Safe to re-run (upsert). Passwords are hard-coded demo values —
// never use on a production DB with a real client-facing password strategy.
// Run: DATABASE_URL=<neon-branch> node scripts/seed-demo-users.mjs
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

const DEMO_USERS = [
  { email: 'demo-developer@kclinics.dev',  name: 'Demo Developer',   role: 'DEVELOPER',   title: 'Developer' },
  { email: 'demo-contractor@kclinics.dev', name: 'Demo Contractor',  role: 'CONTRACTOR',  title: 'Contractor' },
  { email: 'demo-clinician@kclinics.dev',  name: 'Demo Clinician',   role: 'PRACTITIONER',title: 'Aesthetic Clinician' },
  { email: 'demo-reception@kclinics.dev',  name: 'Demo Reception',   role: 'FRONT_DESK',  title: 'Reception' },
];

async function main() {
  if (!pickDirectUrl()) {
    console.log('[seed-demo-users] skipped (no direct postgres URL).');
    return;
  }
  const password = process.env.DEMO_PASSWORD || 'Demo1234!';
  const hash = await bcrypt.hash(password, 11);

  for (const u of DEMO_USERS) {
    await db.adminUser.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, title: u.title, active: true },
      create: { email: u.email, passwordHash: hash, name: u.name, role: u.role, title: u.title, active: true },
    });
    console.log(`  demo user ready: ${u.email}  (${u.role})`);
  }
  console.log(`\nAll demo users provisioned. Password: ${password}`);
}

main().finally(() => db.$disconnect());
