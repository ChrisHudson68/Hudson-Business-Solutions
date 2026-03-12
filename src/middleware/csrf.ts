import crypto from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import { getEnv } from '../config/env.js';

export type CsrfVariables = {
  csrfToken: string;
};

const CSRF_ERROR_MESSAGE =
  'Security Check Failed: Your form session expired or the request could not be verified. ' +
  'Please refresh the page and try again.';

const CSRF_TTL_SECONDS = 60 * 60 * 2;

function signCsrfPayload(payload: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(payload).digest('base64url');
}

function getRequestHost(hostHeader: string | undefined): string {
  return String(hostHeader ?? '').trim().toLowerCase();
}

function createCsrfToken(host: string, secretKey: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(24).toString('base64url');

  const payload = JSON.stringify({
    h: host,
    iat: issuedAt,
    n: nonce,
  });

  const payloadB64 = Buffer.from(payload).toString('base64url');
  const signature = signCsrfPayload(payloadB64, secretKey);

  return `${payloadB64}.${signature}`;
}

function verifyCsrfToken(token: string, host: string, secretKey: string): boolean {
  try {
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return false;

    const payloadB64 = token.slice(0, dotIndex);
    const signature = token.slice(dotIndex + 1);
    const expected = signCsrfPayload(payloadB64, secretKey);

    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as {
      h?: string;
      iat?: number;
      n?: string;
    };

    if (!payload || typeof payload !== 'object') return false;
    if (typeof payload.h !== 'string' || payload.h !== host) return false;
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) return false;
    if (typeof payload.n !== 'string' || !payload.n) return false;

    const now = Math.floor(Date.now() / 1000);
    if (payload.iat > now + 60) return false;
    if (now - payload.iat > CSRF_TTL_SECONDS) return false;

    return true;
  } catch {
    return false;
  }
}

async function readFormCsrfToken(c: any): Promise<string> {
  try {
    const contentType = c.req.header('Content-Type') ?? '';

    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const body = await c.req.parseBody();
      return typeof body.csrf_token === 'string' ? body.csrf_token : '';
    }

    return '';
  } catch {
    return '';
  }
}

export const csrfMiddleware = createMiddleware<{ Variables: CsrfVariables }>(
  async (c, next) => {
    const env = getEnv();
    const method = c.req.method.toUpperCase();
    const host = getRequestHost(c.req.header('Host'));

    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      c.set('csrfToken', createCsrfToken(host, env.secretKey));
      await next();
      return;
    }

    const formToken = await readFormCsrfToken(c);

    if (!formToken || !verifyCsrfToken(formToken, host, env.secretKey)) {
      return c.text(CSRF_ERROR_MESSAGE, 400);
    }

    c.set('csrfToken', createCsrfToken(host, env.secretKey));
    await next();
  },
);