ALTER TABLE jobs ADD COLUMN source_estimate_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_jobs_source_estimate_id
ON jobs (source_estimate_id);