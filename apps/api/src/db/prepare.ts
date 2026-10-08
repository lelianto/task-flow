import { DatabaseSync } from 'node:sqlite';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const value = process.env.DATABASE_URL ?? 'file:./taskflow.db';
const relativePath = value.replace(/^file:/, '');
const schemaDirectory = resolve('prisma');
const path = resolve(schemaDirectory, relativePath);
mkdirSync(dirname(path), { recursive: true });
new DatabaseSync(path).close();
