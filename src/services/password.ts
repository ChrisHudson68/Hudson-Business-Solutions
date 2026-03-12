import crypto from 'node:crypto';

const DEFAULT_ITERATIONS = 600000;
const DEFAULT_KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(Math.ceil(SALT_LENGTH / 2))
    .toString('hex')
    .slice(0, SALT_LENGTH);

  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    DEFAULT_ITERATIONS,
    DEFAULT_KEY_LENGTH,
    'sha256',
  );

  return `pbkdf2:sha256:${DEFAULT_ITERATIONS}$${salt}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const dollarIdx1 = storedHash.indexOf('$');
    if (dollarIdx1 === -1) return false;

    const dollarIdx2 = storedHash.indexOf('$', dollarIdx1 + 1);
    if (dollarIdx2 === -1) return false;

    const methodPart = storedHash.slice(0, dollarIdx1);
    const salt = storedHash.slice(dollarIdx1 + 1, dollarIdx2);
    const expectedHex = storedHash.slice(dollarIdx2 + 1);

    const parts = methodPart.split(':');
    if (parts[0] !== 'pbkdf2') return false;

    const hashMethod = parts[1] || 'sha256';
    const iterations = parseInt(parts[2] || String(DEFAULT_ITERATIONS), 10);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;

    const keyLength = expectedHex.length / 2;
    if (keyLength <= 0 || !Number.isInteger(keyLength)) return false;

    const derived = crypto.pbkdf2Sync(password, salt, iterations, keyLength, hashMethod);
    const derivedHex = derived.toString('hex');

    if (derivedHex.length !== expectedHex.length) return false;
    return crypto.timingSafeEqual(Buffer.from(derivedHex), Buffer.from(expectedHex));
  } catch {
    return false;
  }
}
