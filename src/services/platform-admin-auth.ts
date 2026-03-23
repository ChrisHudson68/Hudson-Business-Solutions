import type { AppConfig } from '../config/env.js';
import { verifyPassword } from './password.js';

export function isPlatformAdminConfigured(env: AppConfig): boolean {
  return !!env.platformAdminEmail && (!!env.platformAdminPasswordHash || !!env.platformAdminPassword);
}

export function verifyPlatformAdminCredentials(
  env: AppConfig,
  email: string,
  password: string,
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isPlatformAdminConfigured(env)) return false;
  if (normalizedEmail !== env.platformAdminEmail) return false;

  if (env.platformAdminPasswordHash) {
    return verifyPassword(password, env.platformAdminPasswordHash);
  }

  return password === env.platformAdminPassword;
}
