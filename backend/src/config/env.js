import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always resolve backend/.env regardless of process working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET)) {
  throw new Error('FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production.');
}

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const parseTrustProxy = (value) => {
  if (value === undefined || value === null || value === '') return 1;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  const hops = Number.parseInt(normalized, 10);
  return Number.isNaN(hops) ? value : hops;
};

const parseCorsOrigin = (value) => {
  if (!value || value.trim() === '*' || value.trim().toLowerCase() === 'true') {
    return true;
  }
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) return true;
  return origins.length === 1 ? origins[0] : origins;
};

const parseSslFromUrl = (url) => {
  const sslParam = url.searchParams.get('ssl');
  const sslAccept = url.searchParams.get('sslaccept') || url.searchParams.get('ssl-mode');

  if (sslParam) {
    try {
      const parsed = JSON.parse(sslParam);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          enabled: true,
          rejectUnauthorized: parsed.rejectUnauthorized !== false,
        };
      }
      if (typeof parsed === 'boolean') {
        return { enabled: parsed, rejectUnauthorized: true };
      }
    } catch {
      return {
        enabled: parseBoolean(sslParam, true),
        rejectUnauthorized: true,
      };
    }
  }

  if (sslAccept) {
    const mode = sslAccept.trim().toLowerCase();
    return {
      enabled: mode !== 'disable' && mode !== 'disabled',
      rejectUnauthorized: mode !== 'accept_invalid_certs',
    };
  }

  return null;
};

const resolveDbConfig = () => {
  let host = process.env.DB_HOST || 'localhost';
  let port = parseInt(process.env.DB_PORT || '3306', 10);
  let user = process.env.DB_USER || 'root';
  let password = process.env.DB_PASSWORD || '';
  let database = process.env.DB_NAME || 'life_os';
  let sslFromUrl = null;

  if (process.env.DATABASE_URL) {
    const parsedUrl = new URL(process.env.DATABASE_URL.trim());
    host = parsedUrl.hostname || host;
    port = parseInt(parsedUrl.port || '3306', 10);
    user = parsedUrl.username ? decodeURIComponent(parsedUrl.username) : user;
    password = parsedUrl.password ? decodeURIComponent(parsedUrl.password) : password;
    const urlDb = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
    if (urlDb) database = urlDb;
    sslFromUrl = parseSslFromUrl(parsedUrl);
  }

  if (database.includes('://') || database.includes('?')) {
    throw new Error(
      'FATAL: DB_NAME must be a plain schema name (e.g. "life_os"), not a mysql:// connection URL. Put full URIs in DATABASE_URL.'
    );
  }

  if (database.toLowerCase() === 'sys') {
    throw new Error(
      'FATAL: DB_NAME cannot be "sys" (system schema). Use a dedicated application database such as "life_os".'
    );
  }

  const isTiDbCloud = host.toLowerCase().endsWith('.tidbcloud.com');
  const sslEnabled = parseBoolean(
    process.env.DB_SSL,
    sslFromUrl ? sslFromUrl.enabled : isTiDbCloud
  );
  const rejectUnauthorized = parseBoolean(
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
    sslFromUrl ? sslFromUrl.rejectUnauthorized : true
  );

  return {
    host,
    port,
    user,
    password,
    database,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    timezone: process.env.DB_TIMEZONE || (isTiDbCloud ? 'Z' : 'local'),
    ssl: sslEnabled ? { minVersion: 'TLSv1.2', rejectUnauthorized } : undefined,
    autoCreateDatabase: parseBoolean(process.env.DB_AUTO_CREATE_DATABASE, true),
  };
};

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  runMigrationsOnStartup: parseBoolean(process.env.RUN_MIGRATIONS_ON_STARTUP, true),

  db: resolveDbConfig(),

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'life_os_access_secret_key_default',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'life_os_refresh_secret_key_default',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  appUpdate: {
    githubRepo: (process.env.APP_GITHUB_REPO || 'RahulPal-crypto/Life-OS').trim(),
    githubToken: process.env.GITHUB_TOKEN || '',
    cacheTtlMs: parseInt(process.env.APP_UPDATE_CACHE_TTL_MS || '300000', 10), // 5 mins
    minVersionCode: parseInt(process.env.APP_MIN_VERSION_CODE || '1', 10),
    forceUpdate: parseBoolean(process.env.APP_FORCE_UPDATE, false),
    manualVersionCode: process.env.APP_LATEST_VERSION_CODE
      ? parseInt(process.env.APP_LATEST_VERSION_CODE, 10)
      : null,
    manualVersionName: process.env.APP_LATEST_VERSION_NAME || null,
    manualApkUrl: process.env.APP_APK_DOWNLOAD_URL || null,
    manualReleaseNotes: process.env.APP_RELEASE_NOTES || '',
  },
};

/**
 * Build shared mysql2 connection options for both the connection pool and CLI migrations.
 */
export const buildDbConnectionConfig = ({ includeDatabase = true } = {}) => ({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  ...(includeDatabase ? { database: env.db.database } : {}),
  ...(env.db.ssl ? { ssl: env.db.ssl } : {}),
  timezone: env.db.timezone,
  dateStrings: ['DATE'],
});
