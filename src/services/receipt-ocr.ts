import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export type ReceiptOcrStatus = 'completed' | 'no_text' | 'failed' | 'skipped';

export type ParsedReceipt = {
  vendorName?: string;
  normalizedVendorName?: string;
  suggestedCategory?: string;
  receiptDate?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  receiptNumber?: string;
  paymentMethod?: string;
  cardLast4?: string;
  rawText: string;
  confidence?: {
    vendorName?: number;
    receiptDate?: number;
    subtotal?: number;
    tax?: number;
    total?: number;
    receiptNumber?: number;
    suggestedCategory?: number;
  };
};

export type ReceiptOcrProcessingResult = {
  status: ReceiptOcrStatus;
  parsed: ParsedReceipt | null;
  rawText: string;
  errorMessage?: string;
  ocrEngine: string;
};

type LineAmountCandidate = {
  amount: number;
  line: string;
  index: number;
};

const MONEY_REGEX = /(?:\$\s*)?(-?\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))\b/g;
const RECEIPT_NUMBER_PATTERNS = [
  /\b(?:receipt|transaction|trans|invoice|order|auth|approval|ref(?:erence)?|ticket)\s*(?:no|#|number)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i,
  /\b(?:store|register)\s*#?\s*([A-Z0-9-]{4,})\b/i,
];
const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeLine(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function safeSpawn(command: string, args: string[], timeoutMs = 25_000) {
  try {
    return spawnSync(command, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

function canExecute(command: string, args: string[] = ['--version']): boolean {
  const result = safeSpawn(command, args, 8_000);
  if (!result) return false;
  if (typeof result.status === 'number' && result.status === 0) return true;

  const stderr = String(result.stderr || '').toLowerCase();
  const stdout = String(result.stdout || '').toLowerCase();

  if (stdout.includes('tesseract') || stderr.includes('tesseract')) {
    return true;
  }

  if (command.toLowerCase().includes('pdf') && (stdout || stderr)) {
    return true;
  }

  return false;
}

function getWindowsTesseractCandidates(): string[] {
  const candidates = [
    process.env.TESSERACT_PATH,
    'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
    'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
    'tesseract',
  ];

  return candidates.filter((value): value is string => Boolean(value && value.trim()));
}

function getWindowsPdfToTextCandidates(): string[] {
  const candidates = [process.env.PDFTOTEXT_PATH, 'pdftotext'];
  return candidates.filter((value): value is string => Boolean(value && value.trim()));
}

function getWindowsPdfToPpmCandidates(): string[] {
  const candidates = [process.env.PDFTOPPM_PATH, 'pdftoppm'];
  return candidates.filter((value): value is string => Boolean(value && value.trim()));
}

function resolveCommandPath(command: 'tesseract' | 'pdftotext' | 'pdftoppm'): string | null {
  const isWindows = process.platform === 'win32';

  if (!isWindows) {
    if (command === 'tesseract') {
      if (process.env.TESSERACT_PATH && canExecute(process.env.TESSERACT_PATH)) {
        return process.env.TESSERACT_PATH;
      }
      return canExecute('tesseract') ? 'tesseract' : null;
    }

    if (command === 'pdftotext') {
      if (process.env.PDFTOTEXT_PATH && canExecute(process.env.PDFTOTEXT_PATH, ['-v'])) {
        return process.env.PDFTOTEXT_PATH;
      }
      return canExecute('pdftotext', ['-v']) ? 'pdftotext' : null;
    }

    if (process.env.PDFTOPPM_PATH && canExecute(process.env.PDFTOPPM_PATH, ['-v'])) {
      return process.env.PDFTOPPM_PATH;
    }
    return canExecute('pdftoppm', ['-v']) ? 'pdftoppm' : null;
  }

  if (command === 'tesseract') {
    for (const candidate of getWindowsTesseractCandidates()) {
      if (canExecute(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  if (command === 'pdftotext') {
    for (const candidate of getWindowsPdfToTextCandidates()) {
      if (canExecute(candidate, ['-v'])) {
        return candidate;
      }
    }
    return null;
  }

  for (const candidate of getWindowsPdfToPpmCandidates()) {
    if (canExecute(candidate, ['-v'])) {
      return candidate;
    }
  }

  return null;
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs = 25_000,
): { success: boolean; stdout: string; stderr: string } {
  const result = safeSpawn(command, args, timeoutMs);

  if (!result) {
    return {
      success: false,
      stdout: '',
      stderr: `Failed to start command: ${command}`,
    };
  }

  return {
    success: result.status === 0,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

function parseMoney(raw: string): number | null {
  const cleaned = String(raw || '').replace(/[$,\s]/g, '');
  if (!/^-?\d+(?:\.\d{2})?$/.test(cleaned)) {
    return null;
  }

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(2));
}

function extractMoneyCandidates(lines: string[]): LineAmountCandidate[] {
  const candidates: LineAmountCandidate[] = [];

  lines.forEach((line, index) => {
    const matches = Array.from(line.matchAll(MONEY_REGEX));

    for (const match of matches) {
      const amount = parseMoney(match[0]);
      if (amount === null) continue;
      candidates.push({ amount, line, index });
    }
  });

  return candidates;
}

function pickTotal(candidates: LineAmountCandidate[], lineCount: number): { value?: number; confidence?: number } {
  const weighted = candidates
    .filter((candidate) => candidate.amount > 0)
    .map((candidate) => {
      const line = candidate.line.toLowerCase();
      let score = 0;

      if (/\bgrand total\b/.test(line)) score += 120;
      if (/\btotal\b/.test(line)) score += 95;
      if (/\bbalance due\b/.test(line)) score += 100;
      if (/\bamount due\b/.test(line)) score += 95;
      if (/\btotal due\b/.test(line)) score += 95;
      if (/\bnet due\b/.test(line)) score += 80;

      if (/\bsubtotal\b/.test(line)) score -= 120;
      if (/\bsub total\b/.test(line)) score -= 120;
      if (/\btax\b/.test(line)) score -= 90;
      if (/\bchange\b/.test(line)) score -= 120;
      if (/\bcash\b/.test(line)) score -= 25;
      if (/\bvisa\b|\bmastercard\b|\bdiscover\b|\bamex\b/.test(line)) score -= 20;

      if (lineCount > 0) {
        const linePosition = candidate.index / Math.max(1, lineCount - 1);
        score += linePosition * 30;
        if (linePosition >= 0.55) score += 18;
      }

      if (candidate.amount >= 1) score += Math.min(candidate.amount / 12, 18);

      return { ...candidate, score };
    })
    .sort((a, b) => b.score - a.score || b.amount - a.amount);

  const best = weighted[0];
  if (!best || best.score < 24) {
    return {};
  }

  return {
    value: Number(best.amount.toFixed(2)),
    confidence: best.score >= 58 ? 0.96 : 0.76,
  };
}

function pickSubtotal(candidates: LineAmountCandidate[]): { value?: number; confidence?: number } {
  const best = candidates.find((candidate) => /\bsub\s*total\b/i.test(candidate.line));
  if (!best) return {};
  return { value: Number(best.amount.toFixed(2)), confidence: 0.95 };
}

function pickTax(candidates: LineAmountCandidate[]): { value?: number; confidence?: number } {
  const best = candidates.find(
    (candidate) => /\btax\b/i.test(candidate.line) && !/\btotal\b/i.test(candidate.line),
  );
  if (!best) return {};
  return { value: Number(best.amount.toFixed(2)), confidence: 0.94 };
}

function normalizeYear(year: number): number {
  if (year < 100) {
    return year >= 70 ? 1900 + year : 2000 + year;
  }
  return year;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractDate(rawText: string): { value?: string; confidence?: number } {
  const lines = rawText.split(/\n+/).slice(0, 24);

  for (const line of lines) {
    const text = line.toLowerCase();
    if (!/(date|purchased|sale|issued|invoice|sold)/.test(text) && !/\d/.test(text)) {
      continue;
    }

    const slashMatch = line.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
    if (slashMatch) {
      const month = Number.parseInt(slashMatch[1], 10);
      const day = Number.parseInt(slashMatch[2], 10);
      const year = normalizeYear(Number.parseInt(slashMatch[3], 10));
      const iso = toIsoDate(year, month, day);
      if (iso) {
        return { value: iso, confidence: /(date|purchased|sale|sold)/.test(text) ? 0.95 : 0.86 };
      }
    }

    const isoMatch = line.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (isoMatch) {
      const iso = toIsoDate(
        Number.parseInt(isoMatch[1], 10),
        Number.parseInt(isoMatch[2], 10),
        Number.parseInt(isoMatch[3], 10),
      );
      if (iso) {
        return { value: iso, confidence: 0.97 };
      }
    }

    const monthMatch = line.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})\b/);
    if (monthMatch) {
      const monthName = monthMatch[1].toLowerCase();
      const monthIndex = MONTH_NAMES.findIndex(
        (month) => month.startsWith(monthName.slice(0, 3)) || month === monthName,
      );
      if (monthIndex >= 0) {
        const iso = toIsoDate(
          normalizeYear(Number.parseInt(monthMatch[3], 10)),
          monthIndex + 1,
          Number.parseInt(monthMatch[2], 10),
        );
        if (iso) {
          return { value: iso, confidence: 0.9 };
        }
      }
    }
  }

  return {};
}

function looksLikeVendorNoise(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.length < 3 ||
    /^\d+$/.test(lower) ||
    /^(receipt|invoice|subtotal|total|tax|change|cash|visa|mastercard|discover|amex|thank you)/.test(
      lower,
    ) ||
    /^(www\.|http|tel\b|phone\b|store #|register #)/.test(lower)
  );
}

function looksLikeAddressLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /\b(st|street|rd|road|ave|avenue|dr|drive|blvd|boulevard|ln|lane|hwy|highway)\b/.test(lower) ||
    /\b[a-z]{2}\s+\d{5}(?:-\d{4})?\b/.test(lower) ||
    /\d{2,}.*\b(st|street|rd|road|ave|avenue|dr|drive|blvd|boulevard|ln|lane|hwy|highway)\b/.test(
      lower,
    )
  );
}

function looksLikeRealVendor(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed) return false;
  if (trimmed.length < 4 || trimmed.length > 60) return false;
  if (looksLikeVendorNoise(trimmed)) return false;
  if (looksLikeAddressLine(trimmed)) return false;

  const alphaCount = (trimmed.match(/[A-Za-z]/g) || []).length;
  const digitCount = (trimmed.match(/\d/g) || []).length;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const vowelCount = (trimmed.match(/[AEIOUaeiou]/g) || []).length;

  if (alphaCount < 4) return false;
  if (digitCount > 6) return false;
  if (wordCount > 5) return false;
  if (wordCount >= 2 && vowelCount === 0) return false;

  return true;
}

function scoreVendorLine(line: string, index: number): number {
  let score = 0;
  const trimmed = line.trim();

  if (!looksLikeRealVendor(trimmed)) return -999;

  if (/^[A-Z0-9 &'.,()/-]+$/.test(trimmed)) score += 20;
  if (!/\d/.test(trimmed)) score += 10;
  if (trimmed.length >= 5 && trimmed.length <= 28) score += 15;
  if (trimmed.split(/\s+/).length <= 3) score += 10;

  score += Math.max(0, 20 - index * 4);

  return score;
}

function extractVendorName(rawText: string): { value?: string; confidence?: number } {
  const lines = rawText
    .split(/\n+/)
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 10);

  if (lines.length === 1) {
    const onlyLine = lines[0];
    const wordCount = onlyLine.split(/\s+/).filter(Boolean).length;
    const hasDigits = /\d/.test(onlyLine);

    if (wordCount >= 2 && !hasDigits && onlyLine.length <= 20) {
      return {};
    }
  }

  const ranked = lines
    .map((line, index) => ({
      line,
      index,
      score: scoreVendorLine(line, index),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) {
    return {};
  }

  let confidence = 0.55;
  if (best.score >= 55) confidence = 0.9;
  else if (best.score >= 40) confidence = 0.78;
  else if (best.score >= 30) confidence = 0.7;

  if (confidence < 0.7) {
    return {};
  }

  return {
    value: best.line.length > 120 ? best.line.slice(0, 120).trim() : best.line,
    confidence,
  };
}

function extractReceiptNumber(rawText: string): { value?: string; confidence?: number } {
  const lines = rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const patterns = [
    /\b(?:receipt|transaction|trans|invoice|order|auth|approval|ref(?:erence)?|ticket)\s*(?:no|#|number)?\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i,
    /\b(?:store|register|terminal)\s*#?\s*([A-Z0-9-]{4,})\b/i,
    /\brefid[:#\s-]*([A-Z0-9-]{4,})\b/i,
    /\binvoice[:#\s-]*([A-Z0-9-]{4,})\b/i,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const candidate = match?.[1]?.trim();
      if (!candidate) continue;

      // Reject plain words like BUYER
      const hasDigit = /\d/.test(candidate);
      const hasAlpha = /[A-Z]/i.test(candidate);

      if (!hasDigit) continue;
      if (candidate.length < 4 || candidate.length > 40) continue;
      if (!/^[A-Z0-9-]+$/i.test(candidate)) continue;

      return {
        value: candidate.slice(0, 40),
        confidence: hasAlpha ? 0.8 : 0.74,
      };
    }
  }

  return {};
}

function cleanupVendorLabel(value: string): string {
  return value
    .replace(/\b(store|location|loc|register|reg|receipt|invoice)\b/gi, ' ')
    .replace(/#[A-Z0-9-]+/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function titleCaseVendor(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .trim();
}

function normalizeVendorName(vendorName?: string): string | undefined {
  const raw = cleanupVendorLabel(String(vendorName || ''));
  if (!raw) return undefined;

  const lower = raw.toLowerCase();

  if (lower.includes('lowe')) return "Lowe's";
  if (lower.includes('home depot')) return 'Home Depot';
  if (lower.includes('tractor supply')) return 'Tractor Supply';
  if (lower.includes('harbor freight')) return 'Harbor Freight';
  if (lower.includes('napa')) return 'NAPA Auto Parts';
  if (lower.includes('advance auto')) return 'Advance Auto Parts';
  if (lower.includes('autozone')) return 'AutoZone';
  if (lower.includes('oreilly') || lower.includes("o'reilly") || lower.includes('o reilly')) return "O'Reilly Auto Parts";
  if (lower.includes('shell')) return 'Shell';
  if (lower.includes('bp ' ) || lower === 'bp' || lower.includes('british petroleum')) return 'BP';
  if (lower.includes('exxon')) return 'Exxon';
  if (lower.includes('mobil')) return 'Mobil';
  if (lower.includes('circle k')) return 'Circle K';
  if (lower.includes('office depot')) return 'Office Depot';
  if (lower.includes('office max') || lower.includes('officemax')) return 'OfficeMax';
  if (lower.includes('staples')) return 'Staples';
  if (lower.includes('walmart')) return 'Walmart';
  if (lower.includes('sam\'s club') || lower.includes('sams club')) return "Sam's Club";
  if (lower.includes('costco')) return 'Costco';
  if (lower.includes('amazon')) return 'Amazon';
  if (lower.includes('grainger')) return 'Grainger';
  if (lower.includes('fastenal')) return 'Fastenal';
  if (lower.includes('ferguson')) return 'Ferguson';
  if (lower.includes('r e michels') || lower.includes('re michels') || lower.includes('michels')) return 'R.E. Michel';

  return titleCaseVendor(raw);
}

function suggestExpenseCategory(parsed: ParsedReceipt | null): { value?: string; confidence?: number } {
  if (!parsed) {
    return {};
  }

  const vendor = (parsed.vendorName || '').toLowerCase();
  const raw = (parsed.rawText || '').toLowerCase();
  const haystack = `${vendor}\n${raw}`;

  // Strong materials / hardware / supply-house matches first
  if (
    /\blowe'?s\b/.test(haystack) ||
    /\bhome depot\b/.test(haystack) ||
    /\btractor supply\b/.test(haystack) ||
    /\bace hardware\b/.test(haystack) ||
    /\bfastenal\b/.test(haystack) ||
    /\bgrainger\b/.test(haystack) ||
    /\bferguson\b/.test(haystack) ||
    /\breichel?t\b/.test(haystack) ||
    /\bre\s*michels\b/.test(haystack) ||
    /\bsupply house\b/.test(haystack) ||
    /\bhardware\b/.test(haystack) ||
    /\blumber\b/.test(haystack) ||
    /\btreated\b/.test(haystack) ||
    /\bnail\b/.test(haystack) ||
    /\bscrew\b/.test(haystack) ||
    /\bbeam\b/.test(haystack) ||
    /\bjoist\b/.test(haystack) ||
    /\bconcrete\b/.test(haystack) ||
    /\bpipe\b/.test(haystack) ||
    /\bpvc\b/.test(haystack)
  ) {
    return { value: 'Materials', confidence: 0.95 };
  }

  // Fuel only when we see strong gas-station signals
  if (
    /\bshell\b/.test(haystack) ||
    /\bexxon\b/.test(haystack) ||
    /\bmobil\b/.test(haystack) ||
    /\bchevron\b/.test(haystack) ||
    /\bbp\b/.test(haystack) ||
    /\bcircle k\b/.test(haystack) ||
    /\bsunoco\b/.test(haystack) ||
    /\bmarathon\b/.test(haystack) ||
    /\b76\b/.test(vendor) ||
    /\bgallons?\b/.test(haystack) ||
    /\bfuel\b/.test(haystack) ||
    /\bdiesel\b/.test(haystack) ||
    /\bunleaded\b/.test(haystack) ||
    /\bregular\b/.test(haystack) ||
    /\bpremium\b/.test(haystack) ||
    /\bpay at pump\b/.test(haystack)
  ) {
    return { value: 'Fuel', confidence: 0.92 };
  }

  if (
    /\boffice depot\b/.test(haystack) ||
    /\bstaples\b/.test(haystack) ||
    /\bofficemax\b/.test(haystack) ||
    /\bprinter paper\b/.test(haystack) ||
    /\btoner\b/.test(haystack) ||
    /\bink cartridge\b/.test(haystack)
  ) {
    return { value: 'Office Supplies', confidence: 0.9 };
  }

  if (
    /\bpermit\b/.test(haystack) ||
    /\blicense\b/.test(haystack) ||
    /\binspection\b/.test(haystack)
  ) {
    return { value: 'Permits', confidence: 0.84 };
  }

  if (
    /\btool\b/.test(haystack) ||
    /\bdrill\b/.test(haystack) ||
    /\bsaw\b/.test(haystack) ||
    /\bimpact\b/.test(haystack) ||
    /\bbit set\b/.test(haystack)
  ) {
    return { value: 'Tools', confidence: 0.82 };
  }

  return {};
}

function parseStructuredReceipt(rawText: string): ParsedReceipt | null {
  const normalizedText = normalizeWhitespace(rawText);
  if (!normalizedText) {
    return null;
  }

  const lines = normalizedText
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean);

  const candidates = extractMoneyCandidates(lines);
  const vendor = extractVendorName(normalizedText);
  const normalizedVendorName = normalizeVendorName(vendor.value);
  const receiptDate = extractDate(normalizedText);
  const subtotal = pickSubtotal(candidates);
  const tax = pickTax(candidates);
  const total = pickTotal(candidates, lines.length);
  const receiptNumber = extractReceiptNumber(normalizedText);
  const suggestedCategory = suggestExpenseCategory({
    normalizedVendorName,
    vendorName: vendor.value,
    total: total.value,
    rawText: normalizedText,
  });

  return {
    vendorName: vendor.value,
    normalizedVendorName,
    suggestedCategory: suggestedCategory.value,
    receiptDate: receiptDate.value,
    subtotal: subtotal.value,
    tax: tax.value,
    total: total.value,
    receiptNumber: receiptNumber.value,
    rawText: normalizedText,
    confidence: {
      vendorName: vendor.confidence,
      receiptDate: receiptDate.confidence,
      subtotal: subtotal.confidence,
      tax: tax.confidence,
      total: total.confidence,
      receiptNumber: receiptNumber.confidence,
      suggestedCategory: suggestedCategory.confidence,
    },
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hbs-receipt-ocr-'));
}

function cleanupDir(tempDir: string): void {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failure
  }
}

function readTextFromPdf(pdfPath: string, tempDir: string): string {
  const pdftotextCommand = resolveCommandPath('pdftotext');
  if (!pdftotextCommand) {
    return '';
  }

  const outputPath = path.join(tempDir, 'receipt.txt');
  const result = runCommand(pdftotextCommand, ['-layout', '-nopgbrk', pdfPath, outputPath]);
  if (!result.success || !fs.existsSync(outputPath)) {
    return '';
  }

  return fs.readFileSync(outputPath, 'utf8');
}

function renderPdfFirstPageToPng(pdfPath: string, tempDir: string): string | null {
  const pdftoppmCommand = resolveCommandPath('pdftoppm');
  if (!pdftoppmCommand) {
    return null;
  }

  const outputPrefix = path.join(tempDir, 'receipt-page');
  const result = runCommand(pdftoppmCommand, ['-f', '1', '-singlefile', '-png', pdfPath, outputPrefix]);
  const outputPath = `${outputPrefix}.png`;

  if (!result.success || !fs.existsSync(outputPath)) {
    return null;
  }

  return outputPath;
}

function runTesseractText(filePath: string): string {
  const tesseractCommand = resolveCommandPath('tesseract');
  if (!tesseractCommand) {
    throw new Error(
      'Tesseract OCR is not installed or could not be located by the app. Set TESSERACT_PATH if needed.',
    );
  }

  const result = runCommand(tesseractCommand, [filePath, 'stdout', '--psm', '6'], 45_000);
  if (!result.success) {
    const message = normalizeWhitespace(result.stderr) || 'Tesseract OCR failed.';
    throw new Error(message);
  }

  return result.stdout;
}

export async function runReceiptOcr(absoluteFilePath: string): Promise<ReceiptOcrProcessingResult> {
  const extension = path.extname(absoluteFilePath).toLowerCase();
  const tempDir = createTempDir();

  try {
    if (!fs.existsSync(absoluteFilePath)) {
      return {
        status: 'failed',
        parsed: null,
        rawText: '',
        errorMessage: 'Receipt file not found for OCR.',
        ocrEngine: 'unavailable',
      };
    }

    let rawText = '';
    let ocrEngine = 'tesseract';

    if (extension === '.pdf') {
      rawText = readTextFromPdf(absoluteFilePath, tempDir);
      if (normalizeWhitespace(rawText)) {
        ocrEngine = 'pdftotext';
      } else {
        const rendered = renderPdfFirstPageToPng(absoluteFilePath, tempDir);
        if (!rendered) {
          return {
            status: 'failed',
            parsed: null,
            rawText: '',
            errorMessage: 'PDF OCR tools are not installed or could not be located by the app.',
            ocrEngine: 'unavailable',
          };
        }

        rawText = runTesseractText(rendered);
        ocrEngine = 'tesseract+pdftoppm';
      }
    } else {
      rawText = runTesseractText(absoluteFilePath);
    }

    const normalizedText = normalizeWhitespace(rawText);
    if (!normalizedText) {
      return {
        status: 'no_text',
        parsed: null,
        rawText: '',
        ocrEngine,
      };
    }

    const parsed = parseStructuredReceipt(normalizedText);

    return {
      status: parsed ? 'completed' : 'no_text',
      parsed,
      rawText: normalizedText,
      ocrEngine,
    };
  } catch (error) {
    return {
      status: 'failed',
      parsed: null,
      rawText: '',
      errorMessage: error instanceof Error ? error.message : 'Receipt OCR failed.',
      ocrEngine: extension === '.pdf' ? 'pdf-processing' : 'tesseract',
    };
  } finally {
    cleanupDir(tempDir);
  }
}

export function hasUsefulReceiptSuggestions(parsed: ParsedReceipt | null | undefined): boolean {
  if (!parsed) {
    return false;
  }

  return Boolean(
    parsed.normalizedVendorName ||
      parsed.vendorName ||
      parsed.receiptDate ||
      parsed.total ||
      parsed.tax ||
      parsed.subtotal ||
      parsed.receiptNumber ||
      parsed.suggestedCategory,
  );
}
