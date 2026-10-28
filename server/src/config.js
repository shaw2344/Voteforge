import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadDotEnv() {
  const envFile = path.join(rootDir, '.env');
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadDotEnv();

const bool = (v, fallback) => {
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  server: {
    port: Number(process.env.PORT || 4000),
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    dataDir: path.join(rootDir, 'data'),
    dbFile: path.join(rootDir, 'data', 'voteforge.db'),
    clientDist: path.resolve(rootDir, '..', 'client', 'dist'),
  },

  security: {
    jwtSecret:
      process.env.JWT_SECRET ||
      'dev-only-secret-change-me-in-production-0123456789abcdef',
    accessTokenTtl: process.env.ACCESS_TTL || '30m',
    refreshTokenTtlDays: Number(process.env.REFRESH_TTL_DAYS || 7),
    cookieSecure: bool(process.env.COOKIE_SECURE, false),
    bcryptRounds: 10,
    maxBodySize: process.env.MAX_BODY_SIZE || '64kb',
    corsAllowedOrigins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  simulation: {
    defaultVoters: Number(process.env.SIM_DEFAULT_VOTERS || 200),
    maxVoters: Number(process.env.SIM_MAX_VOTERS || 5000),
  },
};

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-only-secret-change-me-in-production-0123456789abcdef')
) {
  throw new Error('FATAL: JWT_SECRET must be set in production.');
}

export default config;
