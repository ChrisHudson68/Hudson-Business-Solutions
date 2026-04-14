import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
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

function validateMimeType(mimeType: string, extension: string, allowedMimeTypes: string[]): void {
  if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
    if (['heic', 'heif'].includes(extension) && (!mimeType || mimeType === 'application/octet-stream')) {
      return;
    }

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

type UploadProcessingMode = 'attachment' | 'logo';

type SaveUploadOptions = {
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  maxBytes: number;
  processingMode?: UploadProcessingMode;
};

type ProcessedUpload = {
  buffer: Buffer;
  extension: string;
  mimeType: string;
};

const RECEIPT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'];
const HEIC_EXTENSIONS = ['heic', 'heif'];
const RECEIPT_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

function isHeicLike(extension: string, mimeType: string): boolean {
  return HEIC_EXTENSIONS.includes(extension) || mimeType.includes('heic') || mimeType.includes('heif');
}

function isCompressibleAttachment(extension: string, mimeType: string, processingMode: UploadProcessingMode): boolean {
  if (processingMode !== 'attachment') {
    return false;
  }

  return RECEIPT_IMAGE_EXTENSIONS.includes(extension) || RECEIPT_IMAGE_MIME_TYPES.has(mimeType);
}

function buildOversizeError(maxBytes: number): Error {
  const mb = Math.max(1, Math.floor(maxBytes / (1024 * 1024)));
  return new Error(`Uploaded file could not be compressed enough. Maximum size is ${mb} MB.`);
}

async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  const heicModule = await import('heic-convert');
  const heicConvert = (heicModule.default ?? heicModule) as unknown as (options: {
    buffer: Buffer;
    format: 'JPEG';
    quality: number;
  }) => Promise<ArrayBuffer | Uint8Array>;

  const output = await heicConvert({
    buffer,
    format: 'JPEG',
    quality: 0.82,
  });

  if (output instanceof Uint8Array) {
    return Buffer.from(output);
  }

  return Buffer.from(new Uint8Array(output));
}

async function compressAttachmentImage(buffer: Buffer, extension: string, mimeType: string, maxBytes: number): Promise<ProcessedUpload> {
  let sourceBuffer = buffer;

  if (isHeicLike(extension, mimeType)) {
    sourceBuffer = await convertHeicToJpeg(buffer);
    extension = 'jpg';
    mimeType = 'image/jpeg';
  }

  const dimensions = [1800, 1600, 1400, 1200, 1000, 900, 800, 700];
  const qualities = [82, 76, 70, 64, 58, 52, 46, 40, 34];

  let lastBuffer: Buffer | null = null;

  for (const dimension of dimensions) {
    for (const quality of qualities) {
      const candidate = await sharp(sourceBuffer, { failOn: 'none' })
        .rotate()
        .resize({
          width: dimension,
          height: dimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      lastBuffer = candidate;

      if (candidate.length <= maxBytes) {
        return {
          buffer: candidate,
          extension: 'jpg',
          mimeType: 'image/jpeg',
        };
      }
    }
  }

  if (lastBuffer && lastBuffer.length <= maxBytes) {
    return {
      buffer: lastBuffer,
      extension: 'jpg',
      mimeType: 'image/jpeg',
    };
  }

  throw buildOversizeError(maxBytes);
}

async function maybeProcessUpload(
  file: File,
  extension: string,
  mimeType: string,
  maxBytes: number,
  processingMode: UploadProcessingMode,
): Promise<ProcessedUpload> {
  const originalBuffer = Buffer.from(await file.arrayBuffer());

  if (!isCompressibleAttachment(extension, mimeType, processingMode)) {
    validateFileSize(originalBuffer.length, maxBytes);
    return {
      buffer: originalBuffer,
      extension,
      mimeType,
    };
  }

  const hardSourceLimit = Math.min(Math.max(maxBytes * 6, 12 * 1024 * 1024), 25 * 1024 * 1024);
  validateFileSize(file.size, hardSourceLimit);

  return compressAttachmentImage(originalBuffer, extension, mimeType, maxBytes);
}

export async function saveUploadedFile(
  file: File,
  uploadDir: string,
  options: SaveUploadOptions,
): Promise<string> {
  const env = getEnv();
  const originalName = sanitizeOriginalName(file.name);
  const extension = normalizedExtension(originalName);
  const mimeType = normalizeMimeType(file.type);
  const processingMode = options.processingMode ?? 'attachment';

  validateFileName(originalName);
  validateExtension(extension, options.allowedExtensions);
  validateMimeType(mimeType, extension, options.allowedMimeTypes);

  const processed = await maybeProcessUpload(
    file,
    extension,
    mimeType,
    Math.min(options.maxBytes, env.maxUploadBytes),
    processingMode,
  );

  fs.mkdirSync(uploadDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${processed.extension}`;
  const filePath = safeResolvedPath(uploadDir, filename);

  fs.writeFileSync(filePath, processed.buffer);

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

export function buildTenantScopedUploadDir(uploadBaseDir: string, tenantId: number): string {
  return path.join(uploadBaseDir, String(tenantId));
}

export function buildTenantScopedStoredPath(tenantId: number, filename: string): string {
  const cleanTenantId = String(tenantId).trim();
  const cleanFilename = path.basename(String(filename || '').trim());

  if (!cleanTenantId || !/^\d+$/.test(cleanTenantId)) {
    throw new Error('Invalid tenant upload path.');
  }

  if (!cleanFilename) {
    throw new Error('Invalid stored filename.');
  }

  return `${cleanTenantId}/${cleanFilename}`;
}

export function buildTenantReceiptUploadDir(uploadBaseDir: string, tenantId: number): string {
  return buildTenantScopedUploadDir(uploadBaseDir, tenantId);
}

export function buildTenantReceiptStoredPath(tenantId: number, filename: string): string {
  return buildTenantScopedStoredPath(tenantId, filename);
}

export function inferMimeTypeFromStoredFilename(storedRelativePath: string): string {
  const ext = normalizedExtension(storedRelativePath);

  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';

  return 'application/octet-stream';
}

export function buildSafeDownloadFilename(prefix: string, storedRelativePath: string): string {
  const ext = path.extname(String(storedRelativePath || '').trim()).toLowerCase();
  const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.heic', '.heif'].includes(ext) ? ext : '';
  return `${prefix}${safeExt}`;
}

export const DOCUMENT_ATTACHMENT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'heic', 'heif'];
export const RECEIPT_EXTENSIONS = DOCUMENT_ATTACHMENT_EXTENSIONS;
export const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg'];

export const DOCUMENT_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'application/pdf',
];

export const RECEIPT_MIME_TYPES = DOCUMENT_ATTACHMENT_MIME_TYPES;

export const LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
];
