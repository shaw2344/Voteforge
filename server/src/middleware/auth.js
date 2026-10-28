import { verifyAccessToken } from '../utils/tokens.js';
import config from '../config.js';

const ACCESS_COOKIE = 'vf_at';
const REFRESH_COOKIE = 'vf_rt';

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.security.cookieSecure,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function setAccessCookie(res, token) {
  res.cookie(ACCESS_COOKIE, token, cookieOptions(parseTtl(config.security.accessTokenTtl)));
}

export function setRefreshCookie(res, token, ttlDays) {
  res.cookie(REFRESH_COOKIE, token, cookieOptions(ttlDays * 24 * 60 * 60 * 1000));
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions(0));
  res.clearCookie(REFRESH_COOKIE, cookieOptions(0));
}

export { ACCESS_COOKIE, REFRESH_COOKIE };

function parseTtl(ttl) {
  const m = /^(\d+)(m|h|d|s)$/.exec(String(ttl));
  if (!m) return 30 * 60 * 1000;
  const n = Number(m[1]);
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * map[m[2]];
}

function readAccessToken(req) {
  const fromCookie = req.cookies?.[ACCESS_COOKIE];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function requireAuth(req, res, next) {
  const token = readAccessToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  req.user = {
    id: Number(payload.sub),
    role: payload.role,
    studentId: payload.studentId,
  };
  next();
}

export function optionalAuth(req, _res, next) {
  const token = readAccessToken(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: Number(payload.sub), role: payload.role, studentId: payload.studentId };
    } catch {
      /* ignore invalid optional token */
    }
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  next();
}
