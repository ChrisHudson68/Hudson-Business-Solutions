import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getEnv } from '../config/env.js';

function safeResolvedPath(baseDir: string, relativePath: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedFile = path.resolve(resolvedBase, relativePath);

  if (!resolvedFile.startsWith(resolvedBase + path.sep) && resolvedFile !== resolvedBase) {
    throw new Error('Invalid upload path.');
  }

  return resolvedFile;
}

function normalizedExtension(fileName: string): string {
  const base = path.basename(String(fileName || '').trim());
  const ext = path.extname(base).toLowerCase().replace('.', '');
  return ext;
}

function normalizeMimeType(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function sanitizeOriginalName(fileName: string): string {
  return path.basename(String(fileName || '').trim());
}

function validateFileName(fileName: string): void {
  const clean = sanitizeOriginalName(fileName);

  if (!clean) {
    throw new Error('Uploaded file must have a valid name.');
  }

  if (clean.startsWith('.')) {
    throw new Error('Hidden files are not allowed.');
  }

  if (clean.length > 255) {
    throw new Error('Uploaded file name is too long.');
  }
}

function validateFileSize(size: number, maxBytes: number): void {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Uploaded file is empty.');
  }

  if (size > maxBytes) {
    const mb = Math.max(1, Math.floor(maxBytes / (1024 * 1024)));
    throw new Error(`Uploaded file is too large. Maximum size is ${mb} MB.`);
  }
}

function validateExtension(extension: string, allowedExtensions: string[]): void {
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error('Invalid file type.');
  }
}

function validateMimeType(mimeType: string, allowedMimeTypes: string[]): void {
  if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
    throw new Error('Invalid file type.');
  }
}

function normalizeStoredRelativePath(value: string): string {
  const raw = String(value ?? '').trim().replace(/\\/g, '/');
  const parts = raw
    .split('/')
    .map((part) => path.basename(part.trim()))
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error('Invalid upload path.');
  }

  return parts.join('/');
}

type SaveUploadOptions = {
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  maxBytes: number;
};

export async function saveUploadedFile(
  file: File,
  uploadDir: string,
  options: SaveUploadOptions,
): Promise<string> {
  const env = getEnv();
  const originalName = sanitizeOriginalName(file.name);
  const extension = normalizedExtension(originalName);
  const mimeType = normalizeMimeType(file.type);

  validateFileName(originalName);
  validateExtension(extension, options.allowedExtensions);
  validateMimeType(mimeType, options.allowedMimeTypes);
  validateFileSize(file.size, Math.min(options.maxBytes, env.maxUploadBytes));

  fs.mkdirSync(uploadDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${extension}`;
  const filePath = safeResolvedPath(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  fs.writeFileSync(filePath, buffer);

  return filename;
}

export function resolveUploadedFilePath(storedRelativePath: string, uploadBaseDir: string): string {
  const normalized = normalizeStoredRelativePath(storedRelativePath);
  const relativePath = normalized.split('/').join(path.sep);
  return safeResolvedPath(uploadBaseDir, relativePath);
}

export function deleteUploadedFile(storedRelativePath: string, uploadBaseDir: string): void {
  try {
    const filePath = resolveUploadedFilePath(storedRelativePath, uploadBaseDir);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore delete failures for local cleanup.
  }
}

export function buildTenantReceiptUploadDir(uploadBaseDir: string, tenantId: number): string {
  return path.join(uploadBaseDir, String(tenantId));
}

export function buildTenantReceiptStoredPath(tenantId: number, filename: string): string {
  const cleanTenantId = String(tenantId).trim();
  const cleanFilename = path.basename(String(filename || '').trim());

  if (!cleanTenantId || !/^\d+$/.test(cleanTenantId)) {
    throw new Error('Invalid tenant receipt path.');
  }

  if (!cleanFilename) {
    throw new Error('Invalid tenant receipt filename.');
  }

  return `${cleanTenantId}/${cleanFilename}`;
}

export function inferMimeTypeFromStoredFilename(storedRelativePath: string): string {
  const ext = normalizedExtension(storedRelativePath);

  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';

  return 'application/octet-stream';
}

export function buildSafeDownloadFilename(prefix: string, storedRelativePath: string): string {
  const ext = path.extname(String(storedRelativePath || '').trim()).toLowerCase();
  const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'].includes(ext) ? ext : '';
  return `${prefix}${safeExt}`;
}

export const RECEIPT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
export const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg'];

export const RECEIPT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

export const LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
];