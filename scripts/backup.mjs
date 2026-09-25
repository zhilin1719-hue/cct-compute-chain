import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
if (existsSync(resolve(root, '.env'))) process.loadEnvFile(resolve(root, '.env'));
const path = resolve(root, process.env.DATABASE_PATH || './data/cct.sqlite');
if (!existsSync(path)) throw new Error('Database does not exist yet. Start the application first.');
mkdirSync(resolve(root, 'backups'), { recursive: true });
const target = resolve(root, 'backups', `cct-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
const db = new DatabaseSync(path, { readOnly: true });
try {
  await backup(db, target);
  console.log(`Consistent SQLite backup created: ${target}`);
} finally { db.close(); }
