import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, publicUser, audit, nowUtc, toIso } from '../db.js';
import { recordAndBroadcastSecurityEvent } from '../securityCopilotService.js';
import config from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setAccessCookie,
  setRefreshCookie,
  clearAuthCookies,
} from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../utils/tokens.js';

const router = Router();

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

const registerSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(3, 'Student ID must be at least 3 characters.')
    .max(32)
    .regex(/^[A-Za-z0-9._-]+$/, 'Student ID contains invalid characters.'),
  name: z.string().trim().min(2, 'Name is required.').max(100),
  email: z.string().trim().email('Invalid email.').max(120).optional().or(z.literal('')),
  password: passwordSchema,
});

const loginSchema = z.object({
  studentId: z.string().trim().min(1, 'Student ID is required.').max(32),
  password: z.string().min(1, 'Password is required.').max(72),
});

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(100).optional(),
  email: z
    .string()
    .trim()
    .email('Invalid email.')
    .max(120)
    .optional()
    .or(z.literal('')),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.').max(72),
  newPassword: passwordSchema,
});

function issueTokens(res, user, ip) {
  const access = signAccessToken(user);
  setAccessCookie(res, access);

  const refresh = generateRefreshToken();
  const expires = new Date(
    Date.now() + config.security.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  const result = db
    .prepare(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_ip)
       VALUES (?, ?, ?, ?)`
    )
    .run(user.id, hashRefreshToken(refresh), expires, ip);
  setRefreshCookie(res, refresh, config.security.refreshTokenTtlDays);

  audit(user.id, 'auth.issue_tokens', `new refresh token #${result.lastInsertRowid}`, ip);
}

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req, res) => {
    const { studentId, name, email, password } = req.body;

    const existing = db
      .prepare('SELECT id FROM users WHERE student_id = ? OR (email IS NOT NULL AND email = ?)')
      .get(studentId, email || null);
    if (existing) {
      return res.status(409).json({ error: 'A user with this student ID or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
    const result = db
      .prepare(
        `INSERT INTO users (student_id, name, email, password_hash)
         VALUES (?, ?, ?, ?)`
      )
      .run(studentId, name, email || null, passwordHash);

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    audit(row.id, 'auth.register', `student ${studentId}`, req.ip);
    issueTokens(res, row, req.ip);
    return res.status(201).json({ user: publicUser(row) });
  }
);

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { studentId, password } = req.body;

  const row = db.prepare('SELECT * FROM users WHERE student_id = ?').get(studentId);
  if (!row) {
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinva');
    recordAndBroadcastSecurityEvent({
      userId: null,
      eventType: 'auth.failed_login',
      severity: 'MEDIUM',
      ip: req.ip,
      details: { studentId, reason: 'Unknown student ID' }
    });
    return res.status(401).json({ error: 'Invalid student ID or password.' });
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    recordAndBroadcastSecurityEvent({
      userId: row.id,
      eventType: 'auth.failed_login',
      severity: 'MEDIUM',
      ip: req.ip,
      details: { studentId, reason: 'Invalid password' }
    });
    return res.status(401).json({ error: 'Invalid student ID or password.' });
  }

  audit(row.id, 'auth.login', `student ${studentId}`, req.ip);
  issueTokens(res, row, req.ip);
  return res.json({ user: publicUser(row) });
});

router.post('/refresh', authLimiter, (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'No refresh token provided.' });

  const tokenHash = hashRefreshToken(token);
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);

  if (!row) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Invalid session. Please sign in again.' });
  }

  if (row.revoked) {
    // Reuse of a rotated token => possible theft. Revoke the whole chain.
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(row.user_id);
    clearAuthCookies(res);
    audit(row.user_id, 'auth.refresh_reuse', 'refresh token reuse detected; chain revoked', req.ip);
    recordAndBroadcastSecurityEvent({
      userId: row.user_id,
      eventType: 'auth.token_replay_detected',
      severity: 'CRITICAL',
      ip: req.ip,
      details: { tokenId: row.id, action: 'Token reuse detected; session chain revoked' }
    });
    return res.status(401).json({ error: 'Session revoked for security. Please sign in again.' });
  }

  const expired = new Date(toIso(row.expires_at)).getTime() <= Date.now();
  if (expired) {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(row.id);
    clearAuthCookies(res);
    audit(row.user_id, 'auth.refresh_expired', 'expired refresh token', req.ip);
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Account no longer exists.' });
  }

  // Rotate: revoke current, issue new.
  const refresh = generateRefreshToken();
  const expires = new Date(
    Date.now() + config.security.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  const newResult = db
    .prepare(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_ip)
       VALUES (?, ?, ?, ?)`
    )
    .run(user.id, hashRefreshToken(refresh), expires, req.ip);
  db.prepare('UPDATE refresh_tokens SET revoked = 1, replaced_by = ? WHERE id = ?').run(
    newResult.lastInsertRowid,
    row.id
  );

  setAccessCookie(res, signAccessToken(user));
  setRefreshCookie(res, refresh, config.security.refreshTokenTtlDays);
  audit(user.id, 'auth.refresh', `rotated refresh token`, req.ip);
  return res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(
      hashRefreshToken(token)
    );
  }
  clearAuthCookies(res);
  return res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Account no longer exists.' });
  }
  return res.json({ user: publicUser(row) });
});

router.patch('/profile', requireAuth, validate(profileSchema), (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'Account not found.' });

  const fields = [];
  const values = [];
  if (req.body.name !== undefined) {
    fields.push('name = ?');
    values.push(req.body.name);
  }
  if (req.body.email !== undefined) {
    const email = req.body.email || null;
    const dup = db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(email, req.user.id);
    if (dup) return res.status(409).json({ error: 'That email is already in use.' });
    fields.push('email = ?');
    values.push(email);
  }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  audit(req.user.id, 'auth.profile_update', `updated ${fields.map((f) => f.split(' ')[0]).join(', ')}`, req.ip);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return res.json({ user: publicUser(updated) });
});

router.post('/password', requireAuth, validate(changePasswordSchema), async (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'Account not found.' });

  const ok = await bcrypt.compare(req.body.currentPassword, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

  const newHash = await bcrypt.hash(req.body.newPassword, config.security.bcryptRounds);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

  // Revoke all existing sessions; re-issue fresh tokens so this session stays alive.
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(req.user.id);
  audit(req.user.id, 'auth.password_change', 'password updated; sessions rotated', req.ip);
  issueTokens(res, row, req.ip);
  return res.json({ message: 'Password updated.' });
});

export default router;
export { ACCESS_COOKIE, REFRESH_COOKIE };
