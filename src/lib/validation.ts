export class ValidationError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export function requireNonEmptyString(value: unknown, fieldLabel: string): string {
  const parsed = String(value ?? '').trim();
  if (!parsed) {
    throw new ValidationError(`${fieldLabel} is required.`);
  }
  return parsed;
}

export function optionalTrimmedString(value: unknown, maxLength?: number): string | null {
  const parsed = String(value ?? '').trim();
  if (!parsed) return null;

  if (typeof maxLength === 'number' && parsed.length > maxLength) {
    throw new ValidationError(`${fieldLabelFromLimit(maxLength)} must be ${maxLength} characters or less.`);
  }

  return parsed;
}

function fieldLabelFromLimit(_maxLength: number): string {
  return 'Value';
}

export function parsePositiveInt(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!/^\d+$/.test(raw)) {
    throw new ValidationError(`${fieldLabel} must be a valid number.`);
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldLabel} must be greater than 0.`);
  }

  return parsed;
}

export function parseMoney(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) {
    throw new ValidationError(`${fieldLabel} is required.`);
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new ValidationError(`${fieldLabel} must be a valid amount with up to 2 decimal places.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${fieldLabel} must be a valid amount.`);
  }

  if (parsed <= 0) {
    throw new ValidationError(`${fieldLabel} must be greater than 0.`);
  }

  return Number(parsed.toFixed(2));
}

export function parseOptionalPercent(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new ValidationError(`${fieldLabel} must be a valid percentage.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${fieldLabel} must be a valid percentage.`);
  }

  if (parsed < 0 || parsed > 100) {
    throw new ValidationError(`${fieldLabel} must be between 0 and 100.`);
  }

  return Number(parsed.toFixed(2));
}

export function parseOptionalMoney(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new ValidationError(`${fieldLabel} must be a valid amount with up to 2 decimal places.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${fieldLabel} must be a valid amount.`);
  }

  if (parsed < 0) {
    throw new ValidationError(`${fieldLabel} cannot be negative.`);
  }

  return Number(parsed.toFixed(2));
}

export function parseIsoDate(value: unknown, fieldLabel: string): string {
  const raw = String(value ?? '').trim();

  if (!raw) {
    throw new ValidationError(`${fieldLabel} is required.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError(`${fieldLabel} must be a valid date.`);
  }

  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${fieldLabel} must be a valid date.`);
  }

  const [year, month, day] = raw.split('-').map((part) => Number.parseInt(part, 10));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError(`${fieldLabel} must be a real calendar date.`);
  }

  return raw;
}

export function ensureDateOrder(
  startDate: string,
  endDate: string,
  startLabel: string,
  endLabel: string,
): void {
  if (new Date(`${endDate}T00:00:00Z`) < new Date(`${startDate}T00:00:00Z`)) {
    throw new ValidationError(`${endLabel} must be on or after ${startLabel}.`);
  }
}

export function normalizeInvoiceNumber(value: unknown, fallbackPrefix = 'INV'): string {
  const raw = String(value ?? '').trim().toUpperCase();

  if (!raw) {
    throw new ValidationError('Invoice number is required.');
  }

  const cleaned = raw.replace(/\s+/g, '-');

  if (!/^[A-Z0-9][A-Z0-9\-/_]*$/.test(cleaned)) {
    throw new ValidationError(
      'Invoice number may only contain letters, numbers, dashes, underscores, and slashes.',
    );
  }

  if (cleaned.length > 50) {
    throw new ValidationError('Invoice number must be 50 characters or less.');
  }

  return cleaned || fallbackPrefix;
}

export function normalizeInvoicePrefix(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase();

  if (!raw) return 'INV';

  const cleaned = raw.replace(/\s+/g, '');

  if (!/^[A-Z0-9\-]{1,12}$/.test(cleaned)) {
    throw new ValidationError(
      'Invoice prefix may only contain letters, numbers, and dashes, up to 12 characters.',
    );
  }

  return cleaned;
}

export function parseOptionalEmail(value: unknown, fieldLabel: string): string | null {
  const parsed = String(value ?? '').trim();
  if (!parsed) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(parsed)) {
    throw new ValidationError(`${fieldLabel} must be a valid email address.`);
  }

  if (parsed.length > 255) {
    throw new ValidationError(`${fieldLabel} must be 255 characters or less.`);
  }

  return parsed.toLowerCase();
}

export function requireEmail(value: unknown, fieldLabel: string): string {
  const parsed = parseOptionalEmail(value, fieldLabel);
  if (!parsed) {
    throw new ValidationError(`${fieldLabel} is required.`);
  }
  return parsed;
}

export function requireEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldLabel: string,
): T {
  const parsed = String(value ?? '').trim() as T;

  if (!allowedValues.includes(parsed)) {
    throw new ValidationError(`Invalid ${fieldLabel.toLowerCase()} selected.`);
  }

  return parsed;
}

export function requireMaxLength(value: unknown, fieldLabel: string, maxLength: number): string {
  const parsed = requireNonEmptyString(value, fieldLabel);

  if (parsed.length > maxLength) {
    throw new ValidationError(`${fieldLabel} must be ${maxLength} characters or less.`);
  }

  return parsed;
}

export function validatePassword(value: unknown, fieldLabel = 'Password'): string {
  const password = String(value ?? '');

  if (!password.trim()) {
    throw new ValidationError(`${fieldLabel} is required.`);
  }

  if (password.length < 8) {
    throw new ValidationError(`${fieldLabel} must be at least 8 characters.`);
  }

  if (password.length > 128) {
    throw new ValidationError(`${fieldLabel} must be 128 characters or less.`);
  }

  return password;
}