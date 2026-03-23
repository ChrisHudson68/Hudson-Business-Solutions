import type { DB } from '../db/connection.js';

export interface RateLimitPolicy {
  scope: string;
  key: string;
  windowSeconds: number;
  maxAttempts: number;
  blockSeconds: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
}

type RateLimitRow = {
  scope: string;
  key: string;
  window_started_at: number;
  attempt_count: number;
  blocked_until: number | null;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().slice(0, 255) || 'unknown';
}

function getRow(db: DB, scope: string, key: string): RateLimitRow | undefined {
  return db
    .prepare(`
      SELECT scope, key, window_started_at, attempt_count, blocked_until
      FROM request_rate_limits
      WHERE scope = ? AND key = ?
      LIMIT 1
    `)
    .get(scope, normalizeKey(key)) as RateLimitRow | undefined;
}

function upsertRow(db: DB, row: RateLimitRow): void {
  db.prepare(`
    INSERT INTO request_rate_limits (scope, key, window_started_at, attempt_count, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(scope, key)
    DO UPDATE SET
      window_started_at = excluded.window_started_at,
      attempt_count = excluded.attempt_count,
      blocked_until = excluded.blocked_until,
      updated_at = CURRENT_TIMESTAMP
  `).run(row.scope, normalizeKey(row.key), row.window_started_at, row.attempt_count, row.blocked_until ?? null);
}

export function checkRateLimit(db: DB, policy: RateLimitPolicy): RateLimitDecision {
  const now = Math.floor(Date.now() / 1000);
  const row = getRow(db, policy.scope, policy.key);

  if (!row) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: policy.maxAttempts,
    };
  }

  if (row.blocked_until && row.blocked_until > now) {
    return {
      allowed: false,
      retryAfterSeconds: row.blocked_until - now,
      remainingAttempts: 0,
    };
  }

  const windowExpired = row.window_started_at + policy.windowSeconds <= now;
  if (windowExpired) {
    upsertRow(db, {
      scope: policy.scope,
      key: policy.key,
      window_started_at: now,
      attempt_count: 0,
      blocked_until: null,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: policy.maxAttempts,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, policy.maxAttempts - row.attempt_count),
  };
}

export function recordRateLimitFailure(db: DB, policy: RateLimitPolicy): RateLimitDecision {
  const now = Math.floor(Date.now() / 1000);
  const existing = getRow(db, policy.scope, policy.key);

  let windowStartedAt = now;
  let attemptCount = 1;
  let blockedUntil: number | null = null;

  if (existing && existing.window_started_at + policy.windowSeconds > now) {
    windowStartedAt = existing.window_started_at;
    attemptCount = existing.attempt_count + 1;
  }

  if (attemptCount >= policy.maxAttempts) {
    blockedUntil = now + policy.blockSeconds;
  }

  upsertRow(db, {
    scope: policy.scope,
    key: policy.key,
    window_started_at: windowStartedAt,
    attempt_count: attemptCount,
    blocked_until: blockedUntil,
  });

  if (blockedUntil && blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: blockedUntil - now,
      remainingAttempts: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, policy.maxAttempts - attemptCount),
  };
}

export function clearRateLimit(db: DB, scope: string, key: string): void {
  db.prepare(`DELETE FROM request_rate_limits WHERE scope = ? AND key = ?`).run(scope, normalizeKey(key));
}

export function pruneExpiredRateLimits(db: DB): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    DELETE FROM request_rate_limits
    WHERE blocked_until IS NOT NULL
      AND blocked_until < ?
      AND window_started_at < ?
  `).run(now, now - 86400 * 30);
}
