-- Add attachment support to payments

ALTER TABLE payments ADD COLUMN attachment_path TEXT;
ALTER TABLE payments ADD COLUMN attachment_original_name TEXT;
ALTER TABLE payments ADD COLUMN attachment_mime_type TEXT;
ALTER TABLE payments ADD COLUMN attachment_uploaded_at TEXT;