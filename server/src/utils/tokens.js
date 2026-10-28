import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, studentId: user.student_id },
    config.security.jwtSecret,
    { expiresIn: config.security.accessTokenTtl, issuer: 'voteforge', audience: 'voteforge-client' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.security.jwtSecret, {
    issuer: 'voteforge',
    audience: 'voteforge-client',
  });
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
