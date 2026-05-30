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
}

main().finally(() => db.$disconnect());
