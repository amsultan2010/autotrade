/**
 * One-off: rename the developer account and/or reset its password, preserving
 * all of its data (watchlist, trades, learning). Updates in place rather than
 * creating a new account.
 *
 * Run:
 *   OLD_EMAIL=dev@alphabot.ai NEW_EMAIL=dev@quantara.ai NEW_PASSWORD='...' \
 *     pnpm --filter @alphabot/backend exec tsx scripts/update-dev-login.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const oldEmail = (process.env.OLD_EMAIL ?? 'dev@alphabot.ai').toLowerCase();
  const newEmail = (process.env.NEW_EMAIL ?? oldEmail).toLowerCase();
  const newPassword = process.env.NEW_PASSWORD;
  if (!newPassword) {
    // eslint-disable-next-line no-console
    console.error('NEW_PASSWORD is required');
    process.exit(1);
  }

  let user = await prisma.user.findUnique({ where: { email: oldEmail } });
  if (!user) user = await prisma.user.findFirst({ where: { role: 'DEVELOPER' } });
  if (!user) {
    // eslint-disable-next-line no-console
    console.error('No developer account found to update');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { email: newEmail, passwordHash, role: 'DEVELOPER', status: 'ACTIVE' },
  });
  // Revoke existing sessions so the old password/token can't continue.
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Developer login updated → ${updated.email} (data preserved)`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
