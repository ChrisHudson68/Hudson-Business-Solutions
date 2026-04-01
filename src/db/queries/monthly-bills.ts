import type Database from 'better-sqlite3';

type DB = Database.Database;

export type MonthlyBillRecord = {
  id: number;
  tenant_id: number;
  name: string;
  category: string | null;
  vendor: string | null;
  amount: number;
  due_day: number;
  effective_start_date: string;
  end_date: string | null;
  active: number;
  notes: string | null;
  archived_at: string | null;
  archived_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyBillOccurrence = {
  bill_id: number;
  name: string;
  category: string | null;
  vendor: string | null;
  amount: number;
  date: string;
};

function archivedClause(includeArchived = false): string {
  return includeArchived ? '' : 'AND archived_at IS NULL';
}

function isoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthLastDay(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function monthStartIso(year: number, monthIndex: number): string {
  return isoDate(year, monthIndex, 1);
}

function monthEndIso(year: number, monthIndex: number): string {
  return isoDate(year, monthIndex, monthLastDay(year, monthIndex));
}

function normalizeDueDay(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(31, Math.max(1, Math.trunc(value)));
}

export function listByTenant(db: DB, tenantId: number, includeArchived = false): MonthlyBillRecord[] {
  return db.prepare(
    `
      SELECT
        id,
        tenant_id,
        name,
        category,
        vendor,
        amount,
        due_day,
        effective_start_date,
        end_date,
        active,
        notes,
        archived_at,
        archived_by_user_id,
        created_at,
        updated_at
      FROM monthly_bills
      WHERE tenant_id = ? ${archivedClause(includeArchived)}
      ORDER BY archived_at IS NOT NULL ASC, active DESC, due_day ASC, LOWER(name) ASC, id ASC
    `,
  ).all(tenantId) as MonthlyBillRecord[];
}

export function findById(db: DB, billId: number, tenantId: number): MonthlyBillRecord | undefined {
  return db.prepare(
    `
      SELECT
        id,
        tenant_id,
        name,
        category,
        vendor,
        amount,
        due_day,
        effective_start_date,
        end_date,
        active,
        notes,
        archived_at,
        archived_by_user_id,
        created_at,
        updated_at
      FROM monthly_bills
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
    `,
  ).get(billId, tenantId) as MonthlyBillRecord | undefined;
}

export function create(
  db: DB,
  tenantId: number,
  data: {
    name: string;
    category?: string | null;
    vendor?: string | null;
    amount: number;
    due_day: number;
    effective_start_date: string;
    end_date?: string | null;
    active?: number;
    notes?: string | null;
  },
): number {
  const result = db.prepare(
    `
      INSERT INTO monthly_bills (
        tenant_id,
        name,
        category,
        vendor,
        amount,
        due_day,
        effective_start_date,
        end_date,
        active,
        notes,
        archived_at,
        archived_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
  ).run(
    tenantId,
    data.name,
    data.category || null,
    data.vendor || null,
    Number(data.amount || 0),
    normalizeDueDay(data.due_day),
    data.effective_start_date,
    data.end_date || null,
    data.active === 0 ? 0 : 1,
    data.notes || null,
  );

  return Number(result.lastInsertRowid);
}

export function update(
  db: DB,
  billId: number,
  tenantId: number,
  data: {
    name: string;
    category?: string | null;
    vendor?: string | null;
    amount: number;
    due_day: number;
    effective_start_date: string;
    end_date?: string | null;
    active?: number;
    notes?: string | null;
  },
): void {
  db.prepare(
    `
      UPDATE monthly_bills
      SET
        name = ?,
        category = ?,
        vendor = ?,
        amount = ?,
        due_day = ?,
        effective_start_date = ?,
        end_date = ?,
        active = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `,
  ).run(
    data.name,
    data.category || null,
    data.vendor || null,
    Number(data.amount || 0),
    normalizeDueDay(data.due_day),
    data.effective_start_date,
    data.end_date || null,
    data.active === 0 ? 0 : 1,
    data.notes || null,
    billId,
    tenantId,
  );
}

export function archive(db: DB, billId: number, tenantId: number, archivedByUserId: number): void {
  db.prepare(`
    UPDATE monthly_bills
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
  `).run(archivedByUserId, billId, tenantId);
}

export function restore(db: DB, billId: number, tenantId: number): void {
  db.prepare(`
    UPDATE monthly_bills
    SET archived_at = NULL,
        archived_by_user_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND archived_at IS NOT NULL
  `).run(billId, tenantId);
}

export function occurrenceDateForMonth(dueDay: number, year: number, monthIndex: number): string {
  const clampedDay = Math.min(normalizeDueDay(dueDay), monthLastDay(year, monthIndex));
  return isoDate(year, monthIndex, clampedDay);
}

export function isActiveForMonth(bill: Pick<MonthlyBillRecord, 'effective_start_date' | 'end_date'>, year: number, monthIndex: number): boolean {
  const monthStart = monthStartIso(year, monthIndex);
  const monthEnd = monthEndIso(year, monthIndex);
  return bill.effective_start_date <= monthEnd && (!bill.end_date || bill.end_date >= monthStart);
}

export function nextDueDate(bill: Pick<MonthlyBillRecord, 'due_day' | 'effective_start_date' | 'end_date' | 'active' | 'archived_at'>, fromDate: string): string | null {
  if (bill.archived_at || Number(bill.active || 0) !== 1) return null;

  const start = new Date(`${fromDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;

  for (let offset = 0; offset < 24; offset += 1) {
    const year = start.getUTCFullYear() + Math.floor((start.getUTCMonth() + offset) / 12);
    const monthIndex = (start.getUTCMonth() + offset) % 12;
    if (!isActiveForMonth(bill, year, monthIndex)) continue;

    const due = occurrenceDateForMonth(bill.due_day, year, monthIndex);
    if (due < bill.effective_start_date) continue;
    if (bill.end_date && due > bill.end_date) continue;
    if (due >= fromDate) return due;
  }

  return null;
}

export function listOccurrencesForRange(
  db: DB,
  tenantId: number,
  startDate: string,
  endDate: string,
): MonthlyBillOccurrence[] {
  const bills = db.prepare(
    `
      SELECT
        id,
        tenant_id,
        name,
        category,
        vendor,
        amount,
        due_day,
        effective_start_date,
        end_date,
        active,
        notes,
        archived_at,
        archived_by_user_id,
        created_at,
        updated_at
      FROM monthly_bills
      WHERE tenant_id = ?
        AND archived_at IS NULL
        AND active = 1
        AND effective_start_date <= ?
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY due_day ASC, LOWER(name) ASC, id ASC
    `,
  ).all(tenantId, endDate, startDate) as MonthlyBillRecord[];

  if (bills.length === 0) return [];

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const results: MonthlyBillOccurrence[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= limit) {
    const year = cursor.getUTCFullYear();
    const monthIndex = cursor.getUTCMonth();

    for (const bill of bills) {
      if (!isActiveForMonth(bill, year, monthIndex)) continue;

      const occurrenceDate = occurrenceDateForMonth(bill.due_day, year, monthIndex);
      if (occurrenceDate < startDate || occurrenceDate > endDate) continue;
      if (occurrenceDate < bill.effective_start_date) continue;
      if (bill.end_date && occurrenceDate > bill.end_date) continue;

      results.push({
        bill_id: bill.id,
        name: bill.name,
        category: bill.category,
        vendor: bill.vendor,
        amount: Number(bill.amount || 0),
        date: occurrenceDate,
      });
    }

    cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
  }

  results.sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date)));
  return results;
}

export function sumScheduledByTenantMonthToDate(
  db: DB,
  tenantId: number,
  yearMonth: string,
  throughDate?: string,
): number {
  const monthStart = `${yearMonth}-01`;
  const monthDate = new Date(`${monthStart}T00:00:00Z`);
  if (Number.isNaN(monthDate.getTime())) return 0;

  const year = monthDate.getUTCFullYear();
  const monthIndex = monthDate.getUTCMonth();
  const monthEnd = monthEndIso(year, monthIndex);
  const cutoff = throughDate && throughDate >= monthStart && throughDate <= monthEnd ? throughDate : monthEnd;

  const occurrences = listOccurrencesForRange(db, tenantId, monthStart, cutoff);
  return occurrences.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}
