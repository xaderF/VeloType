import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = env.DATABASE_URL ? new PrismaClient() : null;
export const isDatabaseEnabled = prisma !== null;

async function disconnectPrisma() {
  if (!prisma) return;
  await prisma.$disconnect();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectPrisma();
  process.exit(0);
});
