ALTER TABLE jobs ADD COLUMN job_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_tenant_job_code_unique
ON jobs (tenant_id, job_code)
WHERE job_code IS NOT NULL AND TRIM(job_code) != '';