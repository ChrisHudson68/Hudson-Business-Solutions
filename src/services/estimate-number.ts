import type { DB } from '../db/connection.js';

const ESTIMATE_PREFIX = 'EST-';
const ESTIMATE_DIGITS = 6;

function extractSequence(estimateNumber: string | null | undefined): number | null {
  const raw = String(estimateNumber ?? '').trim().toUpperCase();
  const match = raw.match(/^EST-(\d+)$/);
  if (!match) return null;

  const parsed = Number.parseInt(match[1] || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function formatEstimateNumber(sequence: number): string {
  return `${ESTIMATE_PREFIX}${String(sequence).padStart(ESTIMATE_DIGITS, '0')}`;
}

export function getNextEstimateSequence(db: DB, tenantId: number): number {
  const rows = db.prepare(`
    SELECT estimate_number
    FROM estimates
    WHERE tenant_id = ?
    ORDER BY id DESC
    LIMIT 250
  `).all(tenantId) as Array<{ estimate_number: string | null }>;

  let maxSequence = 0;

  for (const row of rows) {
    const sequence = extractSequence(row.estimate_number);
    if (sequence !== null && sequence > maxSequence) {
      maxSequence = sequence;
    }
  }

  return maxSequence + 1;
}

export function generateNextEstimateNumber(db: DB, tenantId: number): string {
  return formatEstimateNumber(getNextEstimateSequence(db, tenantId));
}

export default {
  formatEstimateNumber,
  getNextEstimateSequence,
  generateNextEstimateNumber,
};