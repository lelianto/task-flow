import { PrismaClient } from '@prisma/client';

export function createPrisma(databaseUrl = process.env.DATABASE_URL ?? 'file:./taskflow.db') {
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

export const prisma = createPrisma();
