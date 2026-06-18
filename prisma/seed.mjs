// Seeds an initial admin user from SEED_ADMIN_* env vars.
// Run: npm run db:push && node prisma/seed.mjs
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'Admin';
  if (!email || !password) {
    console.log('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to seed an admin user.');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 11);
  const user = await db.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, name },
    create: { email: email.toLowerCase(), passwordHash, name, role: 'OWNER' },
  });
  console.log(`✓ Admin ready: ${user.email}`);

  // BLD-285: QA demo users — one per role for dashboard and permission testing.
  // Only created when SEED_QA_ROLES=true (never run in production by default).
  if (process.env.SEED_QA_ROLES !== 'true') return;
  const QA_PASSWORD = process.env.SEED_QA_PASSWORD || 'QaDemo!2025';
  const qaHash = await bcrypt.hash(QA_PASSWORD, 10);
  const qaRoles = [
    { email: 'qa-practitioner@kaulindustries.com', name: 'QA Practitioner', role: 'PRACTITIONER' },
    { email: 'qa-reception@kaulindustries.com',    name: 'QA Reception',    role: 'RECEPTION' },
    { email: 'qa-developer@kaulindustries.com',    name: 'QA Developer',    role: 'DEVELOPER' },
    { email: 'qa-contractor@kaulindustries.com',   name: 'QA Contractor',   role: 'CONTRACTOR' },
  ];
  for (const u of qaRoles) {
    await db.adminUser.upsert({
      where: { email: u.email },
      update: { passwordHash: qaHash, name: u.name },
      create: { email: u.email, passwordHash: qaHash, name: u.name, role: u.role },
    });
    console.log(`✓ QA demo ready: ${u.email} (${u.role})`);
  }
}

main().finally(() => db.$disconnect());
