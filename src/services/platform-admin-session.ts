import crypto from 'node:crypto';

export const PLATFORM_ADMIN_COOKIE_NAME = 'hudson-business-solutions_platform_admin';

type PlatformAdminPayload = {
  email: string;
  iat?: number;
  exp?: number;
};

function signPayload(payloadB64: string, secretKey: string): string {
  return crypto.createHmac('sha256', `${secretKey}:platform-admin`).update(payloadB64).digest('base64url');
}

export function createPlatformAdminCookie(
  email: string,
  secretKey: string,
  ttlSeconds = 60 * 60 * 12,
): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: PlatformAdminPayload = {
    email,
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(payloadB64, secretKey);

  return `${payloadB64}.${signature}`;
}

export function getPlatformAdminEmail(cookieValue: string, secretKey: string): string | null {
  try {
    const dotIndex = cookieValue.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const payloadB64 = cookieValue.slice(0, dotIndex);
    const signature = cookieValue.slice(dotIndex + 1);
    const expected = signPayload(payloadB64, secretKey);

    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as PlatformAdminPayload;

    if (!payload.email || typeof payload.email !== 'string') {
      return null;
    }

    if (typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }
    }

    return payload.email.trim().toLowerCase();
  } catch {
    return null;
  }
}