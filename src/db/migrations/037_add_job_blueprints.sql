PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS job_blueprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  file_filename TEXT NOT NULL,
  original_filename TEXT,
  uploaded_by_user_id INTEGER,
  archived_at TEXT,
  archived_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id),
  FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_job_blueprints_tenant_job_archived
  ON job_blueprints (tenant_id, job_id, archived_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_blueprints_tenant_created_by
  ON job_blueprints (tenant_id, uploaded_by_user_id, created_at DESC);
