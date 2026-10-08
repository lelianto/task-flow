import { prisma } from '../lib/prisma.js';

await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
await prisma.workflowSettings.upsert({
  where: { id: 1 },
  create: { id: 1 },
  update: {},
});
await prisma.$disconnect();
console.log('TaskFlow database is ready.');
