import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { hashPassword } from './security.mjs';
import { initialContent, initialSettings } from './seed.mjs';

const legacySafeSlugs = new Set([
  'ai-transformation', 'agent-systems', 'compute-infrastructure', 'trusted-data',
  'enterprise-knowledge', 'education-intelligence', 'industrial-intelligence', 'low-altitude-ecosystem',
  'from-ai-demo-to-delivery', 'compute-that-fits-the-workload', 'governance-by-design',
]);
const legacySafeContent = initialContent.filter((item) => legacySafeSlugs.has(item.slug));

const serverDirectory = dirname(fileURLToPath(import.meta.url));
export const projectDirectory = resolve(serverDirectory, '..');

export function transaction(db, operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function openDatabase({ dbPath = resolve(projectDirectory, 'data/cct.sqlite'), bootstrapEmail, bootstrapPassword, seed = true } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  let version = db.prepare('PRAGMA user_version').get().user_version;
  const fresh = version === 0;
  const upgraded = version > 0 && version < 2;
  if (version > 2) {
    db.close();
    throw new Error('Database schema is newer than this application. Refusing to downgrade.');
  }
  if (version < 1) {
    transaction(db, () => db.exec(readFileSync(resolve(serverDirectory, 'schema.sql'), 'utf8')));
    version = 2;
  }
  if (version < 2) {
    transaction(db, () => {
      db.exec(`ALTER TABLE content ADD COLUMN claim_scope TEXT NOT NULL DEFAULT 'cct' CHECK (claim_scope IN ('cct', 'market', 'proposal'));
        ALTER TABLE content ADD COLUMN evidence_level TEXT NOT NULL DEFAULT 'internal' CHECK (evidence_level IN ('internal', 'official', 'external', 'unverified'));
        ALTER TABLE content ADD COLUMN source_label TEXT NOT NULL DEFAULT '';
        ALTER TABLE content ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
        ALTER TABLE content ADD COLUMN source_date TEXT NOT NULL DEFAULT '';
        PRAGMA user_version = 2;`);
      db.exec("UPDATE content SET claim_scope = 'cct', evidence_level = 'unverified', source_label = '', source_url = '', source_date = ''");
      const trustExactLegacySeed = db.prepare(`UPDATE content SET evidence_level = 'internal'
        WHERE slug = ? AND type = ? AND title = ? AND title_en = ? AND summary = ? AND summary_en = ?
          AND body = ? AND body_en = ? AND category = ? AND featured = ?`);
      for (const item of legacySafeContent) {
        trustExactLegacySeed.run(item.slug, item.type, item.title, item.titleEn, item.summary, item.summaryEn, item.body, item.bodyEn, item.category, Number(item.featured));
      }
      db.exec("UPDATE content SET status = 'draft' WHERE evidence_level = 'unverified'");
    });
    version = 2;
  }

  transaction(db, () => {
    const now = new Date().toISOString();
    const settingStatement = db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
    for (const [key, value] of Object.entries(initialSettings)) settingStatement.run(key, value, now);
    const legacyDefaults = {
      heroTitle: '让智能，\n成为生产力。',
      heroTitleEn: 'Intelligence.\nPut to work.',
      heroSubtitle: '连接 AI、算力与产业场景。从一个可验证的业务问题出发，构建可部署、可治理、可持续进化的智能系统。',
      heroSubtitleEn: 'Connect AI, compute and industry. Start with a measurable business problem. Build intelligent systems that can be deployed, governed and improved.',
    };
    const upgradeSetting = db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ? AND value = ?');
    for (const [key, oldValue] of Object.entries(legacyDefaults)) upgradeSetting.run(initialSettings[key], now, key, oldValue);

    // Seed only a freshly migrated database. Deleting all content must not resurrect it on restart.
    if (seed && fresh) {
      const insert = db.prepare(`INSERT INTO content
        (id, type, slug, title, title_en, summary, summary_en, body, body_en, category, claim_scope, evidence_level, source_label, source_url, source_date, status, featured, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`);
      for (const item of initialContent) {
        insert.run(randomUUID(), item.type, item.slug, item.title, item.titleEn, item.summary, item.summaryEn, item.body, item.bodyEn, item.category, item.claimScope || 'cct', item.evidenceLevel || 'internal', item.sourceLabel || '', item.sourceUrl || '', item.sourceDate || '', Number(item.featured), now, now);
      }
    } else if (seed && upgraded) {
      const insertNew = db.prepare(`INSERT OR IGNORE INTO content
        (id, type, slug, title, title_en, summary, summary_en, body, body_en, category, claim_scope, evidence_level, source_label, source_url, source_date, status, featured, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`);
      for (const item of initialContent.filter((entry) => !legacySafeSlugs.has(entry.slug))) {
        insertNew.run(randomUUID(), item.type, item.slug, item.title, item.titleEn, item.summary, item.summaryEn, item.body, item.bodyEn, item.category, item.claimScope || 'cct', item.evidenceLevel || 'internal', item.sourceLabel || '', item.sourceUrl || '', item.sourceDate || '', Number(item.featured), now, now);
      }
    }
    if (bootstrapPassword && !db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
      if (typeof bootstrapPassword !== 'string' || bootstrapPassword.length < 12 || bootstrapPassword.length > 128) {
        throw new Error('ADMIN_PASSWORD must contain between 12 and 128 characters.');
      }
      const email = String(bootstrapEmail || 'admin@cct.local').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('ADMIN_EMAIL must be a valid email address.');
      db.prepare(`INSERT INTO users (id, name, email, password_hash, role, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)`).run(randomUUID(), 'CCT Administrator', email, hashPassword(bootstrapPassword), now, now);
    }
  });
  return db;
}

export function publicUser(row) {
  return row ? { id: row.id, name: row.name, email: row.email, role: row.role, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at } : null;
}

export function contentRecord(row) {
  return row ? {
    id: row.id, type: row.type, slug: row.slug, title: row.title, titleEn: row.title_en,
    summary: row.summary, summaryEn: row.summary_en, body: row.body, bodyEn: row.body_en,
    category: row.category, claimScope: row.claim_scope, evidenceLevel: row.evidence_level,
    sourceLabel: row.source_label, sourceUrl: row.source_url, sourceDate: row.source_date,
    status: row.status, featured: Boolean(row.featured),
    createdAt: row.created_at, updatedAt: row.updated_at,
  } : null;
}

export function leadRecord(row) {
  return row ? {
    id: row.id, name: row.name, email: row.email, company: row.company, interest: row.interest,
    message: row.message, consent: Boolean(row.consent), consentVersion: row.consent_version,
    status: row.status, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
  } : null;
}

export function readSettings(db) {
  const allowed = new Set(Object.keys(initialSettings));
  return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().filter((row) => allowed.has(row.key)).map((row) => [row.key, row.value]));
}

export function audit(db, user, action, entityType, entityId, details = {}) {
  db.prepare(`INSERT INTO audit_logs (id, actor_id, actor_email, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), user?.id || null, user?.email || 'system', action, entityType, entityId, JSON.stringify(details), new Date().toISOString());
}
