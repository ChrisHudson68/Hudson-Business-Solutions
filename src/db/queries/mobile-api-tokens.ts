import type { DB } from '../connection.js';

export type ActiveMobileApiTokenUser = {
  token_id: number;
  user_id: number;
  tenant_id: number;
  expires_at: string | null;
  name: string;
  email: string;
  role: string;
  active: number;
};

export function create(
  db: DB,
  data: {
    tenantId: number;
    userId: number;
    tokenHash: string;
    tokenName?: string | null;
    expiresAt?: string | null;
  },
): number {
  const result = db.prepare(`
    INSERT INTO mobile_api_tokens (
      tenant_id,
      user_id,
      token_hash,
      token_name,
      expires_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.tenantId,
    data.userId,
    data.tokenHash,
    data.tokenName ?? null,
    data.expiresAt ?? null,
  );

  return Number(result.lastInsertRowid);
}

export function findActiveUserByTokenHash(
  db: DB,
  tokenHash: string,
): ActiveMobileApiTokenUser | undefined {
  const now = new Date().toISOString();

  return db.prepare(`
    SELECT
      t.id AS token_id,
      t.user_id,
      t.tenant_id,
      t.expires_at,
      u.name,
      u.email,
      u.role,
      u.active
    FROM mobile_api_tokens t
    JOIN users u
      ON u.id = t.user_id
    WHERE t.token_hash = ?
      AND t.revoked_at IS NULL
      AND (t.expires_at IS NULL OR t.expires_at > ?)
    LIMIT 1
  `).get(tokenHash, now) as ActiveMobileApiTokenUser | undefined;
}

export function touchLastUsed(db: DB, tokenId: number): void {
  db.prepare(`
    UPDATE mobile_api_tokens
    SET last_used_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(tokenId);
}

export function revokeByTokenHash(
  db: DB,
  tokenHash: string,
  tenantId: number,
  userId: number,
): boolean {
  const result = db.prepare(`
    UPDATE mobile_api_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = ?
      AND tenant_id = ?
      AND user_id = ?
      AND revoked_at IS NULL
  `).run(tokenHash, tenantId, userId);

  return result.changes > 0;
}