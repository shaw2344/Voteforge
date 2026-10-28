import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';

fs.mkdirSync(config.server.dataDir, { recursive: true });

export const db = new DatabaseSync(config.server.dbFile);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

const SCHEMA_VERSION = 2;

export function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  if (current >= SCHEMA_VERSION) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id    TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
      is_simulated  INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS elections (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type        TEXT NOT NULL CHECK (type IN ('candidate','proposal')),
      starts_at   TEXT NOT NULL,
      ends_at     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
      created_by  INTEGER REFERENCES users(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS positions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      bio         TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS options (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
      text        TEXT NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS votes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id  INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
      voter_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position_id  INTEGER REFERENCES positions(id) ON DELETE CASCADE,
      candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
      option_id    INTEGER REFERENCES options(id) ON DELETE CASCADE,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- One person, one vote per position (candidate elections)
    CREATE UNIQUE INDEX IF NOT EXISTS uq_vote_candidate
      ON votes(election_id, voter_id, position_id) WHERE position_id IS NOT NULL;

    -- One person, one vote per election (proposal elections)
    CREATE UNIQUE INDEX IF NOT EXISTS uq_vote_proposal
      ON votes(election_id, voter_id) WHERE position_id IS NULL;

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT NOT NULL UNIQUE,
      expires_at  TEXT NOT NULL,
      revoked     INTEGER NOT NULL DEFAULT 0,
      replaced_by INTEGER,
      created_ip  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      action     TEXT NOT NULL,
      detail     TEXT,
      ip         TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS security_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER,
      event_type  TEXT NOT NULL,
      severity    TEXT NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW','INFO')),
      ip          TEXT,
      details     TEXT,
      resolved    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS security_ip_blocks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ip         TEXT NOT NULL UNIQUE,
      reason     TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS security_analysis_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER,
      query         TEXT NOT NULL,
      analysis_type TEXT NOT NULL DEFAULT 'general',
      event_count   INTEGER NOT NULL DEFAULT 0,
      result_severity TEXT,
      status        TEXT NOT NULL DEFAULT 'completed',
      token_usage   INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

export function nowUtc() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function toIso(dbDate) {
  if (!dbDate) return dbDate;
  return dbDate.replace(' ', 'T') + 'Z';
}

export function isUtcExpired(dbDate) {
  if (!dbDate) return true;
  return new Date(toIso(dbDate)).getTime() <= Date.now();
}

export function audit(userId, action, detail = null, ip = null) {
  db.prepare(
    `INSERT INTO audit_log (user_id, action, detail, ip) VALUES (?, ?, ?, ?)`
  ).run(userId ?? null, action, detail, ip);
}

export function recordSecurityEvent({ userId = null, eventType, severity = 'INFO', ip = null, details = null }) {
  const detailStr = typeof details === 'object' ? JSON.stringify(details) : details;
  const result = db.prepare(
    `INSERT INTO security_events (user_id, event_type, severity, ip, details) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, eventType, severity, ip, detailStr);
  return result.lastInsertRowid;
}

export function isIpBlocked(ip) {
  if (!ip) return false;
  const cleanIp = ip.replace(/^::ffff:/, '');
  const row = db.prepare(`SELECT id FROM security_ip_blocks WHERE ip = ? OR ip = ?`).get(ip, cleanIp);
  return !!row;
}

export function blockIp(ip, reason = 'Administrative block', createdBy = null) {
  if (!ip) return false;
  const cleanIp = ip.replace(/^::ffff:/, '');
  try {
    db.prepare(`INSERT OR IGNORE INTO security_ip_blocks (ip, reason, created_by) VALUES (?, ?, ?)`).run(cleanIp, reason, createdBy);
    recordSecurityEvent({
      userId: createdBy,
      eventType: 'security.ip_blocked',
      severity: 'HIGH',
      ip: cleanIp,
      details: { reason, createdBy }
    });
    return true;
  } catch (err) {
    return false;
  }
}

export function unblockIp(ip) {
  if (!ip) return false;
  const cleanIp = ip.replace(/^::ffff:/, '');
  const res = db.prepare(`DELETE FROM security_ip_blocks WHERE ip = ? OR ip = ?`).run(ip, cleanIp);
  return res.changes > 0;
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    email: row.email,
    role: row.role,
    isSimulated: !!row.is_simulated,
    createdAt: toIso(row.created_at),
  };
}

