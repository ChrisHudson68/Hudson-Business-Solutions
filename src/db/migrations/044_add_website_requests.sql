CREATE TABLE IF NOT EXISTS website_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT NOT NULL,
  org_name      TEXT NOT NULL,
  base_package  TEXT NOT NULL,
  website_size  TEXT NOT NULL,
  design_level  TEXT NOT NULL,
  features      TEXT NOT NULL DEFAULT '',
  addons        TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  submitted_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
