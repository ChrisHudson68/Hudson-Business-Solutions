type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  baseDomain: string;
  appName: string;
  appLogo: string;
  appUrl: string;
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

  stripeEnabled: boolean;
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;
  stripePriceProMonthly: string;
  stripeBillingPortalEnabled: boolean;
  stripeProPlanLabel: string;
  stripeGracePeriodDays: number;
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

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;

  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;

  throw new Error('Boolean environment values must be true/false, 1/0, yes/no, or on/off.');
}

function parseUrlEnv(value: string | undefined, fallback: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('APP_URL must start with http:// or https://');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error('APP_URL must be a valid absolute URL.');
  }
}

function requireStringWhenEnabled(
  value: string | undefined,
  fieldName: string,
  enabled: boolean,
  fallback = '',
): string {
  const parsed = String(value ?? '').trim();

  if (!parsed && enabled) {
    throw new Error(`${fieldName} is required when STRIPE_ENABLED=true.`);
  }

  return parsed || fallback;
}

export function getEnv(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const nodeEnv = normalizeNodeEnv(process.env.NODE_ENV);
  const isProduction = nodeEnv === 'production';
  const stripeEnabled = parseBooleanEnv(process.env.STRIPE_ENABLED, false);

  cachedConfig = {
    nodeEnv,
    isProduction,
    port: parseIntegerEnv(process.env.PORT, 5555, 'PORT', 1, 65535),
    baseDomain: parseBaseDomain(process.env.BASE_DOMAIN),
    appName: String(process.env.APP_NAME ?? 'Hudson Business Solutions').trim() || 'Hudson Business Solutions',
    appLogo:
      String(process.env.APP_LOGO ?? '/static/brand/hudson-business-solutions-logo.png').trim() ||
      '/static/brand/hudson-business-solutions-logo.png',
    appUrl: parseUrlEnv(process.env.APP_URL, ''),
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

    stripeEnabled,
    stripeSecretKey: requireStringWhenEnabled(
      process.env.STRIPE_SECRET_KEY,
      'STRIPE_SECRET_KEY',
      stripeEnabled,
    ),
    stripePublishableKey: requireStringWhenEnabled(
      process.env.STRIPE_PUBLISHABLE_KEY,
      'STRIPE_PUBLISHABLE_KEY',
      stripeEnabled,
    ),
    stripeWebhookSecret: String(process.env.STRIPE_WEBHOOK_SECRET ?? '').trim(),
    stripePriceProMonthly: requireStringWhenEnabled(
      process.env.STRIPE_PRICE_PRO_MONTHLY,
      'STRIPE_PRICE_PRO_MONTHLY',
      stripeEnabled,
    ),
    stripeBillingPortalEnabled: parseBooleanEnv(process.env.STRIPE_BILLING_PORTAL_ENABLED, true),
    stripeProPlanLabel:
      String(process.env.STRIPE_PRO_PLAN_LABEL ?? '$79.00/month').trim() || '$79.00/month',
    stripeGracePeriodDays: parseIntegerEnv(
      process.env.STRIPE_GRACE_PERIOD_DAYS,
      7,
      'STRIPE_GRACE_PERIOD_DAYS',
      1,
      60,
    ),
  };

  return cachedConfig;
}