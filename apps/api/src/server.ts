import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const port = Number(process.env.PORT ?? 3001);
await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
createApp().listen(port, () => console.log(`TaskFlow API listening on http://localhost:${port}`));
