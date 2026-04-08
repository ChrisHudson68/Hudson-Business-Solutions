import type { DB } from '../connection.js';

export type JobBlueprintJobRow = {
  id: number;
  job_name: string | null;
  job_code: string | null;
  client_name: string | null;
  status: string | null;
  blueprint_count: number;
};

export type JobBlueprintRecord = {
  id: number;
  tenant_id: number;
  job_id: number;
  title: string;
  notes: string | null;
  file_filename: string;
  original_filename: string | null;
  uploaded_by_user_id: number | null;
  uploaded_by_name: string | null;
  archived_at: string | null;
  archived_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export function listJobsWithBlueprintCounts(db: DB, tenantId: number, search?: string | null): JobBlueprintJobRow[] {
  const trimmedSearch = String(search ?? '').trim();
  const hasSearch = trimmedSearch.length > 0;
  const like = `%${trimmedSearch.replace(/[%_]/g, (char) => `\\${char}`)}%`;

  return db.prepare(`
    SELECT
      j.id,
      j.job_name,
      j.job_code,
      j.client_name,
      j.status,
      (
        SELECT COUNT(*)
        FROM job_blueprints jb
        WHERE jb.tenant_id = j.tenant_id
          AND jb.job_id = j.id
          AND jb.archived_at IS NULL
      ) AS blueprint_count
    FROM jobs j
    WHERE j.tenant_id = ?
      AND j.archived_at IS NULL
      ${hasSearch ? `AND (
        LOWER(COALESCE(j.job_name, '')) LIKE LOWER(?) ESCAPE '\\'
        OR LOWER(COALESCE(j.job_code, '')) LIKE LOWER(?) ESCAPE '\\'
        OR LOWER(COALESCE(j.client_name, '')) LIKE LOWER(?) ESCAPE '\\'
      )` : ''}
    ORDER BY
      CASE
        WHEN j.status = 'Active' THEN 0
        WHEN j.status = 'On Hold' THEN 1
        WHEN j.status = 'Complete' THEN 2
        WHEN j.status = 'Completed' THEN 2
        ELSE 3
      END,
      LOWER(COALESCE(j.job_name, '')) ASC,
      j.id ASC
  `).all(...(hasSearch ? [tenantId, like, like, like] : [tenantId])) as JobBlueprintJobRow[];
}

export function listByJob(db: DB, tenantId: number, jobId: number, includeArchived = false): JobBlueprintRecord[] {
  return db.prepare(`
    SELECT
      jb.id,
      jb.tenant_id,
      jb.job_id,
      jb.title,
      jb.notes,
      jb.file_filename,
      jb.original_filename,
      jb.uploaded_by_user_id,
      u.name AS uploaded_by_name,
      jb.archived_at,
      jb.archived_by_user_id,
      jb.created_at,
      jb.updated_at
    FROM job_blueprints jb
    LEFT JOIN users u
      ON u.id = jb.uploaded_by_user_id
    WHERE jb.tenant_id = ?
      AND jb.job_id = ?
      ${includeArchived ? '' : 'AND jb.archived_at IS NULL'}
    ORDER BY
      CASE WHEN jb.archived_at IS NULL THEN 0 ELSE 1 END,
      jb.created_at DESC,
      jb.id DESC
  `).all(tenantId, jobId) as JobBlueprintRecord[];
}

export function findById(db: DB, tenantId: number, blueprintId: number): JobBlueprintRecord | undefined {
  return db.prepare(`
    SELECT
      jb.id,
      jb.tenant_id,
      jb.job_id,
      jb.title,
      jb.notes,
      jb.file_filename,
      jb.original_filename,
      jb.uploaded_by_user_id,
      u.name AS uploaded_by_name,
      jb.archived_at,
      jb.archived_by_user_id,
      jb.created_at,
      jb.updated_at
    FROM job_blueprints jb
    LEFT JOIN users u
      ON u.id = jb.uploaded_by_user_id
    WHERE jb.tenant_id = ?
      AND jb.id = ?
    LIMIT 1
  `).get(tenantId, blueprintId) as JobBlueprintRecord | undefined;
}

export function create(db: DB, tenantId: number, data: {
  job_id: number;
  title: string;
  notes?: string | null;
  file_filename: string;
  original_filename?: string | null;
  uploaded_by_user_id?: number | null;
}): number {
  const result = db.prepare(`
    INSERT INTO job_blueprints (
      tenant_id,
      job_id,
      title,
      notes,
      file_filename,
      original_filename,
      uploaded_by_user_id,
      archived_at,
      archived_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
  `).run(
    tenantId,
    data.job_id,
    data.title,
    data.notes ?? null,
    data.file_filename,
    data.original_filename ?? null,
    data.uploaded_by_user_id ?? null,
  );

  return Number(result.lastInsertRowid);
}

export function archive(db: DB, tenantId: number, blueprintId: number, archivedByUserId: number | null): void {
  db.prepare(`
    UPDATE job_blueprints
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ?
      AND id = ?
      AND archived_at IS NULL
  `).run(archivedByUserId, tenantId, blueprintId);
}
