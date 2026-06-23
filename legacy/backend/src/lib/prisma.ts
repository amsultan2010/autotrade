/** Singleton Prisma client. */
import { PrismaClient } from '@prisma/client';
import { isDev } from '../config/env.js';

export const prisma = new PrismaClient({
  log: isDev ? ['warn', 'error'] : ['error'],
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
