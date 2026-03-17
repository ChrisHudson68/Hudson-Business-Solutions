CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    actor_user_id INTEGER,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    description TEXT NOT NULL,
    metadata_json TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(actor_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_created_at
ON activity_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_event_type
ON activity_logs (tenant_id, event_type);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_actor
ON activity_logs (tenant_id, actor_user_id);