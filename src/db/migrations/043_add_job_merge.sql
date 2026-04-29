ALTER TABLE jobs ADD COLUMN merged_into_job_id INTEGER REFERENCES jobs(id);
