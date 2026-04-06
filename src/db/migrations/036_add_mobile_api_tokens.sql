CREATE TABLE IF NOT EXISTS mobile_api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mobile_api_tokens_tenant_user_revoked
ON mobile_api_tokens (tenant_id, user_id, revoked_at);

CREATE INDEX IF NOT EXISTS idx_mobile_api_tokens_expires_at
ON mobile_api_tokens (expires_at);