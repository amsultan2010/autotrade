/**
 * Seed a DEVELOPER account so you can log in without paying (req #3).
 * Configure via env: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Run: pnpm --filter @autotrade/backend db:seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'dev@autotrade.ai').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'DEVELOPER', status: 'ACTIVE' },
    create: {
      email,
      passwordHash,
      role: 'DEVELOPER',
      status: 'ACTIVE',
      paperAccount: { create: {} },
      botSettings: { create: {} },
      subscription: { create: { status: 'NONE' } },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Seeded DEVELOPER account: ${user.email} (password from env or default)`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
