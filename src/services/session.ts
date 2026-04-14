import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'hudson-business-solutions_session';
export const IMPERSONATION_TOKEN_TTL_SECONDS = 60 * 5;
export const MOBILE_API_TOKEN_PREFIX = 'hbsm_';

type SessionPayload = {
  userId: number;
  impersonation?: {
    platformAdminEmail: string;
    impersonatedUserId: number;
    impersonatedTenantId: number;
    startedAt: number;
    supportReason?: string | null;
  };
  iat?: number;
  exp?: number;
};

type ImpersonationTokenPayload = {
  type: 'impersonation';
  platformAdminEmail: string;
  targetUserId: number;
  targetTenantId: number;
  redirectTo?: string;
  supportReason?: string | null;
  iat?: number;
  exp?: number;
};

export type SessionUser = {
  userId: number;
  impersonation: {
    platformAdminEmail: string;
    impersonatedUserId: number;
    impersonatedTenantId: number;
    startedAt: number;
    supportReason?: string | null;
  } | null;
};

export type ImpersonationToken = {
  platformAdminEmail: string;
  targetUserId: number;
  targetTenantId: number;
  redirectTo: string | null;
  supportReason?: string | null;
};

function signPayload(payloadB64: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(payloadB64).digest('base64url');
}

function signImpersonationPayload(payloadB64: string, secretKey: string): string {
  return crypto
    .createHmac('sha256', `${secretKey}:impersonation-token`)
    .update(payloadB64)
    .digest('base64url');
}

function signMobileApiTokenValue(tokenValue: string, secretKey: string): string {
  return crypto
    .createHmac('sha256', `${secretKey}:mobile-api-token`)
    .update(tokenValue)
    .digest('hex');
}

function parseSignedValue<T>(
  cookieValue: string,
  secretKey: string,
  signer: (payloadB64: string, secretKey: string) => string,
): T | null {
  try {
    const dotIndex = cookieValue.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const payloadB64 = cookieValue.slice(0, dotIndex);
    const signature = cookieValue.slice(dotIndex + 1);
    const expected = signer(payloadB64, secretKey);

    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}

export function createSessionCookie(
  userId: number,
  secretKey: string,
  ttlSeconds = 60 * 60 * 24 * 14,
  impersonation?: SessionPayload['impersonation'],
): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    userId,
    impersonation,
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(payloadB64, secretKey);

  return `${payloadB64}.${signature}`;
}

export function getSessionUser(cookieValue: string, secretKey: string): SessionUser | null {
  const payload = parseSignedValue<SessionPayload>(cookieValue, secretKey, signPayload);
  if (!payload) return null;

  if (typeof payload.userId !== 'number' || !Number.isInteger(payload.userId) || payload.userId <= 0) {
    return null;
  }

  if (typeof payload.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }
  }

  let impersonation: SessionUser['impersonation'] = null;
  if (payload.impersonation) {
    const value = payload.impersonation;
    if (
      typeof value.platformAdminEmail !== 'string' ||
      !value.platformAdminEmail.trim() ||
      typeof value.impersonatedUserId !== 'number' ||
      !Number.isInteger(value.impersonatedUserId) ||
      value.impersonatedUserId <= 0 ||
      typeof value.impersonatedTenantId !== 'number' ||
      !Number.isInteger(value.impersonatedTenantId) ||
      value.impersonatedTenantId <= 0 ||
      typeof value.startedAt !== 'number' ||
      !Number.isInteger(value.startedAt) ||
      value.startedAt <= 0
    ) {
      return null;
    }

    impersonation = {
      platformAdminEmail: value.platformAdminEmail.trim().toLowerCase(),
      impersonatedUserId: value.impersonatedUserId,
      impersonatedTenantId: value.impersonatedTenantId,
      startedAt: value.startedAt,
      supportReason: typeof value.supportReason === 'string' ? value.supportReason : null,
    };
  }

  return {
    userId: payload.userId,
    impersonation,
  };
}

export function getSessionUserId(cookieValue: string, secretKey: string): number | null {
  return getSessionUser(cookieValue, secretKey)?.userId ?? null;
}

export function createImpersonationToken(
  input: {
    platformAdminEmail: string;
    targetUserId: number;
    targetTenantId: number;
    redirectTo?: string | null;
    supportReason?: string | null;
  },
  secretKey: string,
  ttlSeconds = IMPERSONATION_TOKEN_TTL_SECONDS,
): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: ImpersonationTokenPayload = {
    type: 'impersonation',
    platformAdminEmail: input.platformAdminEmail.trim().toLowerCase(),
    targetUserId: input.targetUserId,
    targetTenantId: input.targetTenantId,
    redirectTo: input.redirectTo || '/dashboard',
    supportReason: input.supportReason ?? null,
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signImpersonationPayload(payloadB64, secretKey);

  return `${payloadB64}.${signature}`;
}

export function getImpersonationToken(cookieValue: string, secretKey: string): ImpersonationToken | null {
  const payload = parseSignedValue<ImpersonationTokenPayload>(
    cookieValue,
    secretKey,
    signImpersonationPayload,
  );

  if (!payload || payload.type !== 'impersonation') return null;

  if (
    typeof payload.platformAdminEmail !== 'string' ||
    !payload.platformAdminEmail.trim() ||
    typeof payload.targetUserId !== 'number' ||
    !Number.isInteger(payload.targetUserId) ||
    payload.targetUserId <= 0 ||
    typeof payload.targetTenantId !== 'number' ||
    !Number.isInteger(payload.targetTenantId) ||
    payload.targetTenantId <= 0
  ) {
    return null;
  }

  if (typeof payload.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }
  }

  return {
    platformAdminEmail: payload.platformAdminEmail.trim().toLowerCase(),
    targetUserId: payload.targetUserId,
    targetTenantId: payload.targetTenantId,
    redirectTo: typeof payload.redirectTo === 'string' && payload.redirectTo.trim()
      ? payload.redirectTo.trim()
      : null,
    supportReason: typeof payload.supportReason === 'string' ? payload.supportReason : null,
  };
}

export function createMobileApiToken(secretKey: string): {
  token: string;
  tokenHash: string;
} {
  const randomValue = crypto.randomBytes(32).toString('base64url');
  const token = `${MOBILE_API_TOKEN_PREFIX}${randomValue}`;

  return {
    token,
    tokenHash: signMobileApiTokenValue(token, secretKey),
  };
}

export function hashMobileApiToken(token: string, secretKey: string): string {
  return signMobileApiTokenValue(token, secretKey);
}

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  const value = String(authorizationHeader ?? '').trim();
  if (!value) return null;

  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (!match) return null;

  const token = String(match[1] ?? '').trim();
  if (!token) return null;

  return token;
}