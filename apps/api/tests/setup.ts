import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = resolve('prisma/test.db');
for (const suffix of ['', '-journal', '-shm', '-wal']) {
  if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
}
process.env.DATABASE_URL = `file:${dbPath.replaceAll('\\', '/')}`;
new DatabaseSync(dbPath).close();
execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { env: process.env, stdio: 'ignore', shell: process.platform === 'win32' });
