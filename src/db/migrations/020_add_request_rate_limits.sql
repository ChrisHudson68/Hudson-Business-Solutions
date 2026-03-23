CREATE TABLE IF NOT EXISTS request_rate_limits (
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    window_started_at INTEGER NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    blocked_until INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scope, key)
);

CREATE INDEX IF NOT EXISTS idx_request_rate_limits_updated_at
ON request_rate_limits(updated_at);
