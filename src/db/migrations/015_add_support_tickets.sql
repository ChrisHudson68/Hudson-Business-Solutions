CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    created_by_user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'open',
    internal_notes TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_created_at
ON support_tickets (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
ON support_tickets (status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_priority
ON support_tickets (priority);

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by_user_id
ON support_tickets (created_by_user_id);