import type { DB } from '../connection.js';
import type { Estimate, EstimateLineItem, EstimateStatus, EstimateWithLineItems } from '../types.js';

export interface EstimateLineItemInput {
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  line_total: number;
  sort_order?: number;
}

export interface CreateEstimateInput {
  estimate_number: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  site_address?: string | null;
  scope_of_work?: string | null;
  subtotal?: number;
  tax?: number;
  total?: number;
  status?: EstimateStatus;
  created_by_user_id: number;
  updated_by_user_id?: number | null;
  sent_at?: string | null;
  responded_at?: string | null;
  approval_notes?: string | null;
  rejection_reason?: string | null;
  converted_job_id?: number | null;
  expiration_date?: string | null;
  public_token?: string | null;
  line_items?: EstimateLineItemInput[];
}

export interface UpdateEstimateInput {
  customer_name?: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  site_address?: string | null;
  scope_of_work?: string | null;
  subtotal?: number;
  tax?: number;
  total?: number;
  status?: EstimateStatus;
  updated_by_user_id?: number | null;
  sent_at?: string | null;
  responded_at?: string | null;
  approval_notes?: string | null;
  rejection_reason?: string | null;
  converted_job_id?: number | null;
  expiration_date?: string | null;
  public_token?: string | null;
}

function normalizeMoney(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function normalizeLineItem(input: EstimateLineItemInput, index: number): EstimateLineItemInput {
  return {
    description: String(input.description ?? '').trim(),
    quantity: normalizeMoney(input.quantity),
    unit: String(input.unit ?? '').trim().slice(0, 40),
    unit_price: normalizeMoney(input.unit_price),
    line_total: normalizeMoney(input.line_total),
    sort_order: Number.isInteger(input.sort_order) ? Number(input.sort_order) : index,
  };
}

function baseSelect(): string {
  return `
    SELECT
      e.id,
      e.tenant_id,
      e.estimate_number,
      e.customer_name,
      e.customer_email,
      e.customer_phone,
      e.site_address,
      e.scope_of_work,
      e.subtotal,
      e.tax,
      e.total,
      e.status,
      e.created_by_user_id,
      e.updated_by_user_id,
      e.sent_at,
      e.responded_at,
      e.approval_notes,
      e.rejection_reason,
      e.converted_job_id,
      e.expiration_date,
      e.public_token,
      e.created_at,
      e.updated_at,
      creator.name AS created_by_name,
      updater.name AS updated_by_name,
      j.job_name AS converted_job_name
    FROM estimates e
    LEFT JOIN users creator
      ON creator.id = e.created_by_user_id
    LEFT JOIN users updater
      ON updater.id = e.updated_by_user_id
    LEFT JOIN jobs j
      ON j.id = e.converted_job_id
     AND j.tenant_id = e.tenant_id
  `;
}

export function listByTenant(db: DB, tenantId: number, status?: EstimateStatus): Estimate[] {
  const params: Array<number | string> = [tenantId];
  let whereSql = 'WHERE e.tenant_id = ?';

  if (status) {
    whereSql += ' AND e.status = ?';
    params.push(status);
  }

  return db.prepare(`
    ${baseSelect()}
    ${whereSql}
    ORDER BY
      CASE e.status
        WHEN 'draft' THEN 0
        WHEN 'ready' THEN 1
        WHEN 'sent' THEN 2
        WHEN 'approved' THEN 3
        WHEN 'rejected' THEN 4
        WHEN 'expired' THEN 5
        WHEN 'converted' THEN 6
        ELSE 99
      END,
      e.created_at DESC,
      e.id DESC
  `).all(...params) as Estimate[];
}

export function findById(db: DB, estimateId: number, tenantId: number): Estimate | undefined {
  return db.prepare(`
    ${baseSelect()}
    WHERE e.id = ? AND e.tenant_id = ?
    LIMIT 1
  `).get(estimateId, tenantId) as Estimate | undefined;
}

export function findByEstimateNumber(db: DB, estimateNumber: string, tenantId: number): Estimate | undefined {
  return db.prepare(`
    ${baseSelect()}
    WHERE e.estimate_number = ? AND e.tenant_id = ?
    LIMIT 1
  `).get(estimateNumber, tenantId) as Estimate | undefined;
}

export function findByPublicToken(db: DB, publicToken: string): Estimate | undefined {
  return db.prepare(`
    ${baseSelect()}
    WHERE e.public_token = ?
    LIMIT 1
  `).get(publicToken) as Estimate | undefined;
}

export function getLineItems(db: DB, estimateId: number, tenantId: number): EstimateLineItem[] {
  return db.prepare(`
    SELECT
      id,
      estimate_id,
      tenant_id,
      description,
      quantity,
      unit,
      unit_price,
      line_total,
      sort_order,
      created_at,
      updated_at
    FROM estimate_line_items
    WHERE estimate_id = ? AND tenant_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(estimateId, tenantId) as EstimateLineItem[];
}

export function findWithLineItemsById(
  db: DB,
  estimateId: number,
  tenantId: number,
): EstimateWithLineItems | undefined {
  const estimate = findById(db, estimateId, tenantId);
  if (!estimate) return undefined;

  return {
    ...estimate,
    line_items: getLineItems(db, estimateId, tenantId),
  };
}

export function replaceLineItems(
  db: DB,
  estimateId: number,
  tenantId: number,
  lineItems: EstimateLineItemInput[],
): void {
  db.prepare('DELETE FROM estimate_line_items WHERE estimate_id = ? AND tenant_id = ?').run(
    estimateId,
    tenantId,
  );

  const insert = db.prepare(`
    INSERT INTO estimate_line_items (
      estimate_id,
      tenant_id,
      description,
      quantity,
      unit,
      unit_price,
      line_total,
      sort_order,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  lineItems
    .map((item, index) => normalizeLineItem(item, index))
    .filter((item) => item.description)
    .forEach((item, index) => {
      insert.run(
        estimateId,
        tenantId,
        item.description,
        item.quantity,
        item.unit || '',
        item.unit_price,
        item.line_total,
        Number.isInteger(item.sort_order) ? item.sort_order : index,
      );
    });
}

export function create(db: DB, tenantId: number, input: CreateEstimateInput): number {
  const createTxn = db.transaction((payload: CreateEstimateInput) => {
    const result = db.prepare(`
      INSERT INTO estimates (
        tenant_id,
        estimate_number,
        customer_name,
        customer_email,
        customer_phone,
        site_address,
        scope_of_work,
        subtotal,
        tax,
        total,
        status,
        created_by_user_id,
        updated_by_user_id,
        sent_at,
        responded_at,
        approval_notes,
        rejection_reason,
        converted_job_id,
        expiration_date,
        public_token,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      tenantId,
      payload.estimate_number,
      payload.customer_name,
      payload.customer_email ?? null,
      payload.customer_phone ?? null,
      payload.site_address ?? null,
      payload.scope_of_work ?? null,
      normalizeMoney(payload.subtotal),
      normalizeMoney(payload.tax),
      normalizeMoney(payload.total),
      payload.status ?? 'draft',
      payload.created_by_user_id,
      payload.updated_by_user_id ?? payload.created_by_user_id,
      payload.sent_at ?? null,
      payload.responded_at ?? null,
      payload.approval_notes ?? null,
      payload.rejection_reason ?? null,
      payload.converted_job_id ?? null,
      payload.expiration_date ?? null,
      payload.public_token ?? null,
    );

    const estimateId = Number(result.lastInsertRowid);

    if (payload.line_items?.length) {
      replaceLineItems(db, estimateId, tenantId, payload.line_items);
    }

    return estimateId;
  });

  return createTxn(input);
}

export function update(db: DB, estimateId: number, tenantId: number, input: UpdateEstimateInput): void {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];

  if (Object.prototype.hasOwnProperty.call(input, 'customer_name')) {
    sets.push('customer_name = ?');
    params.push(input.customer_name ?? '');
  }

  if (Object.prototype.hasOwnProperty.call(input, 'customer_email')) {
    sets.push('customer_email = ?');
    params.push(input.customer_email ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'customer_phone')) {
    sets.push('customer_phone = ?');
    params.push(input.customer_phone ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'site_address')) {
    sets.push('site_address = ?');
    params.push(input.site_address ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'scope_of_work')) {
    sets.push('scope_of_work = ?');
    params.push(input.scope_of_work ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'subtotal')) {
    sets.push('subtotal = ?');
    params.push(normalizeMoney(input.subtotal));
  }

  if (Object.prototype.hasOwnProperty.call(input, 'tax')) {
    sets.push('tax = ?');
    params.push(normalizeMoney(input.tax));
  }

  if (Object.prototype.hasOwnProperty.call(input, 'total')) {
    sets.push('total = ?');
    params.push(normalizeMoney(input.total));
  }

  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    sets.push('status = ?');
    params.push(input.status ?? 'draft');
  }

  if (Object.prototype.hasOwnProperty.call(input, 'updated_by_user_id')) {
    sets.push('updated_by_user_id = ?');
    params.push(input.updated_by_user_id ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'sent_at')) {
    sets.push('sent_at = ?');
    params.push(input.sent_at ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'responded_at')) {
    sets.push('responded_at = ?');
    params.push(input.responded_at ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'approval_notes')) {
    sets.push('approval_notes = ?');
    params.push(input.approval_notes ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'rejection_reason')) {
    sets.push('rejection_reason = ?');
    params.push(input.rejection_reason ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'converted_job_id')) {
    sets.push('converted_job_id = ?');
    params.push(input.converted_job_id ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'expiration_date')) {
    sets.push('expiration_date = ?');
    params.push(input.expiration_date ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'public_token')) {
    sets.push('public_token = ?');
    params.push(input.public_token ?? null);
  }

  if (!sets.length) {
    return;
  }

  sets.push('updated_at = CURRENT_TIMESTAMP');

  db.prepare(`
    UPDATE estimates
    SET ${sets.join(', ')}
    WHERE id = ? AND tenant_id = ?
  `).run(...params, estimateId, tenantId);
}

export function setStatus(
  db: DB,
  estimateId: number,
  tenantId: number,
  status: EstimateStatus,
  options?: {
    updated_by_user_id?: number | null;
    sent_at?: string | null;
    responded_at?: string | null;
    approval_notes?: string | null;
    rejection_reason?: string | null;
    converted_job_id?: number | null;
    public_token?: string | null;
  },
): void {
  update(db, estimateId, tenantId, {
    status,
    updated_by_user_id: options?.updated_by_user_id ?? null,
    sent_at: options?.sent_at ?? null,
    responded_at: options?.responded_at ?? null,
    approval_notes: options?.approval_notes ?? null,
    rejection_reason: options?.rejection_reason ?? null,
    converted_job_id: options?.converted_job_id ?? null,
    public_token: options?.public_token ?? null,
  });
}

export default {
  listByTenant,
  findById,
  findByEstimateNumber,
  findByPublicToken,
  getLineItems,
  findWithLineItemsById,
  replaceLineItems,
  create,
  update,
  setStatus,
};