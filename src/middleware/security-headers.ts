import { createMiddleware } from 'hono/factory';
import { getEnv } from '../config/env.js';

function isLocalHostLike(hostHeader: string | undefined): boolean {
  const host = String(hostHeader ?? '').toLowerCase().trim();

  return (
    host.includes('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('0.0.0.0')
  );
}

function buildCsp(hostHeader: string | undefined): string {
  const isLocal = isLocalHostLike(hostHeader);

  const directives: string[] = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  ];

  if (isLocal) {
    directives.push(
      "connect-src 'self' http://localhost:* http://*.localhost:* ws://localhost:* ws://*.localhost:*",
      "form-action 'self' http://localhost:* http://*.localhost:*"
    );
  } else {
    directives.push(
      "connect-src 'self' https:",
      "form-action 'self' https:"
    );
  }

  return directives.join('; ');
}

export const securityHeadersMiddleware = createMiddleware(async (c, next) => {
  await next();

  const env = getEnv();
  const hostHeader = c.req.header('Host');
  const isLocal = isLocalHostLike(hostHeader);

  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Cross-Origin-Opener-Policy', 'same-origin');
  c.header('Cross-Origin-Resource-Policy', 'same-origin');
  c.header('Content-Security-Policy', buildCsp(hostHeader));

  // Only enable transport hardening on real production HTTPS hosts.
  // Do NOT set these for localhost or local subdomain development.
  if (env.isProduction && !isLocal) {
    c.header(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
});