import type Database from 'better-sqlite3';
import type { ParsedReceipt, ReceiptOcrStatus } from '../../services/receipt-ocr.js';

type DB = Database.Database;

export type ReceiptOcrResultRecord = {
  id: number;
  tenant_id: number;
  expense_id: number | null;
  receipt_filename: string;
  status: ReceiptOcrStatus;
  raw_text: string | null;
  parsed_json: string | null;
  confidence_json: string | null;
  error_message: string | null;
  ocr_engine: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function findLatestByReceipt(db: DB, tenantId: number, receiptFilename: string) {
  return db.prepare(
    `
      SELECT
        id,
        tenant_id,
        expense_id,
        receipt_filename,
        status,
        raw_text,
        parsed_json,
        confidence_json,
        error_message,
        ocr_engine,
        processed_at,
        created_at,
        updated_at
      FROM receipt_parsing_results
      WHERE tenant_id = ?
        AND receipt_filename = ?
      ORDER BY id DESC
      LIMIT 1
    `,
  ).get(tenantId, receiptFilename) as ReceiptOcrResultRecord | undefined;
}

export function upsertByReceipt(
  db: DB,
  tenantId: number,
  receiptFilename: string,
  data: {
    expenseId?: number | null;
    status: ReceiptOcrStatus;
    rawText?: string | null;
    parsed?: ParsedReceipt | null;
    errorMessage?: string | null;
    ocrEngine?: string | null;
  },
) {
  const existing = findLatestByReceipt(db, tenantId, receiptFilename);
  const parsedJson = data.parsed ? JSON.stringify(data.parsed) : null;
  const confidenceJson = data.parsed?.confidence ? JSON.stringify(data.parsed.confidence) : null;

  if (existing) {
    db.prepare(
      `
        UPDATE receipt_parsing_results
        SET
          expense_id = COALESCE(?, expense_id),
          status = ?,
          raw_text = ?,
          parsed_json = ?,
          confidence_json = ?,
          error_message = ?,
          ocr_engine = ?,
          processed_at = CASE WHEN ? IN ('completed', 'no_text', 'failed', 'skipped') THEN CURRENT_TIMESTAMP ELSE processed_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(
      data.expenseId ?? null,
      data.status,
      data.rawText ?? null,
      parsedJson,
      confidenceJson,
      data.errorMessage ?? null,
      data.ocrEngine ?? null,
      data.status,
      existing.id,
    );

    return existing.id;
  }

  const result = db.prepare(
    `
      INSERT INTO receipt_parsing_results (
        tenant_id,
        expense_id,
        receipt_filename,
        status,
        raw_text,
        parsed_json,
        confidence_json,
        error_message,
        ocr_engine,
        processed_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
  ).run(
    tenantId,
    data.expenseId ?? null,
    receiptFilename,
    data.status,
    data.rawText ?? null,
    parsedJson,
    confidenceJson,
    data.errorMessage ?? null,
    data.ocrEngine ?? null,
  );

  return Number(result.lastInsertRowid);
}

export function attachToExpense(db: DB, tenantId: number, receiptFilename: string, expenseId: number): void {
  db.prepare(
    `
      UPDATE receipt_parsing_results
      SET
        expense_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ?
        AND receipt_filename = ?
    `,
  ).run(expenseId, tenantId, receiptFilename);
}

export function parseParsedReceipt(record: ReceiptOcrResultRecord | undefined): ParsedReceipt | null {
  if (!record?.parsed_json) {
    return null;
  }

  try {
    return JSON.parse(record.parsed_json) as ParsedReceipt;
  } catch {
    return null;
  }
}
