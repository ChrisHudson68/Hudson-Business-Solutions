PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Employee',
    active INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

INSERT INTO users_new (id, name, email, password_hash, role, active, tenant_id)
SELECT id, name, email, password_hash, role, active, tenant_id
FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX idx_users_tenant_email_unique
ON users (tenant_id, email);

PRAGMA foreign_keys = ON;