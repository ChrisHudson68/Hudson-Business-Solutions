type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  baseDomain: string;
  appName: string;
  appLogo: string;
  dbPath: string;
  uploadDir: string;
  secretKey: string;
  sessionTtlSeconds: number;
  maxUploadBytes: number;
  maxLogoUploadBytes: number;
  maxReceiptUploadBytes: number;
  launchCode: string;
  platformAdminEmail: string;
  platformAdminPassword: string;
}

let cachedConfig: AppConfig | null = null;

function normalizeNodeEnv(value: string | undefined): NodeEnv {
  const normalized = String(value || 'development').trim().toLowerCase();

  if (normalized === 'production') return 'production';
  if (normalized === 'test') return 'test';
  return 'development';
}

function parseIntegerEnv(
  value: string | undefined,
  fallback: number,
  fieldLabel: string,
  min: number,
  max: number,
): number {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${fieldLabel} must be a whole number.`);
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${fieldLabel} must be between ${min} and ${max}.`);
  }

  return parsed;
}

function parsePathLikeEnv(value: string | undefined, fallback: string): string {
  const parsed = String(value ?? '').trim();
  return parsed || fallback;
}

function parseBaseDomain(value: string | undefined): string {
  const parsed = String(value ?? 'localhost').trim().toLowerCase();

  if (!parsed) {
    throw new Error('BASE_DOMAIN cannot be empty.');
  }

  if (parsed.includes('://') || parsed.includes('/') || parsed.includes(' ')) {
    throw new Error('BASE_DOMAIN must be a hostname only, without protocol or slashes.');
  }

  return parsed;
}

function parseSecretKey(value: string | undefined, isProduction: boolean): string {
  const parsed = String(value ?? '').trim();

  if (!parsed) {
    if (isProduction) {
      throw new Error('SECRET_KEY is required in production.');
    }
    return 'dev-secret-change-this';
  }

  if (isProduction && parsed.length < 32) {
    throw new Error('SECRET_KEY must be at least 32 characters in production.');
  }

  return parsed;
}

export function getEnv(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const nodeEnv = normalizeNodeEnv(process.env.NODE_ENV);
  const isProduction = nodeEnv === 'production';

  cachedConfig = {
    nodeEnv,
    isProduction,
    port: parseIntegerEnv(process.env.PORT, 5555, 'PORT', 1, 65535),
    baseDomain: parseBaseDomain(process.env.BASE_DOMAIN),
    appName: String(process.env.APP_NAME ?? 'Hudson Business Solutions').trim() || 'Hudson Business Solutions',
    appLogo:
      String(process.env.APP_LOGO ?? '/static/brand/hudson-business-solutions-logo.png').trim() ||
      '/static/brand/hudson-business-solutions-logo.png',
    dbPath: parsePathLikeEnv(process.env.DB_PATH, './data/database.db'),
    uploadDir: parsePathLikeEnv(process.env.UPLOAD_DIR, './data'),
    secretKey: parseSecretKey(process.env.SECRET_KEY, isProduction),
    sessionTtlSeconds: parseIntegerEnv(
      process.env.SESSION_TTL_SECONDS,
      60 * 60 * 24 * 14,
      'SESSION_TTL_SECONDS',
      300,
      60 * 60 * 24 * 90,
    ),
    maxUploadBytes: parseIntegerEnv(
      process.env.MAX_UPLOAD_BYTES,
      5 * 1024 * 1024,
      'MAX_UPLOAD_BYTES',
      1024,
      25 * 1024 * 1024,
    ),
    maxLogoUploadBytes: parseIntegerEnv(
      process.env.MAX_LOGO_UPLOAD_BYTES,
      2 * 1024 * 1024,
      'MAX_LOGO_UPLOAD_BYTES',
      1024,
      10 * 1024 * 1024,
    ),
    maxReceiptUploadBytes: parseIntegerEnv(
      process.env.MAX_RECEIPT_UPLOAD_BYTES,
      5 * 1024 * 1024,
      'MAX_RECEIPT_UPLOAD_BYTES',
      1024,
      25 * 1024 * 1024,
    ),
    launchCode: String(process.env.LAUNCH_CODE ?? '').trim(),
    platformAdminEmail: String(process.env.PLATFORM_ADMIN_EMAIL ?? '').trim().toLowerCase(),
    platformAdminPassword: String(process.env.PLATFORM_ADMIN_PASSWORD ?? '').trim(),
  };

  return cachedConfig;
}