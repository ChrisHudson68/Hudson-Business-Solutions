import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { getEnv } from '../config/env.js';

export interface WeeklyHoursPdfSummaryRow {
  employee_id: number;
  employee_name: string;
  monday_hours: number;
  tuesday_hours: number;
  wednesday_hours: number;
  thursday_hours: number;
  friday_hours: number;
  saturday_hours: number;
  sunday_hours: number;
  total_hours: number;
  entry_count: number;
  approved_at: string | null;
  approved_by_name: string | null;
}

export interface WeeklyHoursPdfDetailEntry {
  employee_id: number;
  employee_name: string;
  date: string;
  job_name: string;
  hours: number;
  clock_in_at: string | null;
  clock_out_at: string | null;
  entry_method: string;
  note: string | null;
  lunch_deduction_exempt: number;
}

export interface WeeklyHoursPdfData {
  tenant: {
    name: string;
    logo_path: string | null;
  };
  week: {
    start: string;
    end: string;
  };
  summaries: WeeklyHoursPdfSummaryRow[];
  detailEntries: WeeklyHoursPdfDetailEntry[];
}

interface EmployeeReportSection {
  employeeId: number;
  employeeName: string;
  approvedLabel: string;
  approvedBy: string | null;
  totalHours: number;
  entryCount: number;
  totalLunchDeducted: number;
  days: Array<{
    date: string;
    label: string;
    paidHours: number;
    lunchDeducted: number;
    entries: Array<{
      timeLabel: string;
      jobName: string;
      rawHours: number | null;
      lunchDeducted: number;
      paidHours: number;
      methodLabel: string;
      note: string | null;
    }>;
  }>;
}

type EmbeddedLogo = { image: any; width: number; height: number } | null;

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT_MARGIN = 42;
const RIGHT_MARGIN = 42;
const TOP_MARGIN = 44;
const BOTTOM_MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function resolveLogoFilePath(logoPath: string | null | undefined): string | null {
  const raw = String(logoPath || '').trim();
  if (!raw) return null;

  if (raw.startsWith('/uploads/logos/')) {
    return path.join(getEnv().uploadDir, 'tenant_logos', path.basename(raw));
  }

  if (path.isAbsolute(raw)) {
    return raw;
  }

  return null;
}

async function embedTenantLogo(pdfDoc: PDFDocument, logoPath: string | null | undefined): Promise<EmbeddedLogo> {
  const filePath = resolveLogoFilePath(logoPath);
  if (!filePath || !fs.existsSync(filePath)) return null;

  try {
    const bytes = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') {
      const image = await pdfDoc.embedPng(bytes);
      return { image, width: image.width, height: image.height };
    }
    if (ext === '.jpg' || ext === '.jpeg') {
      const image = await pdfDoc.embedJpg(bytes);
      return { image, width: image.width, height: image.height };
    }
  } catch {
    return null;
  }

  return null;
}

function roundHours(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function formatHours(value: number): string {
  return roundHours(value).toFixed(2);
}

function formatDateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const weekday = DAY_NAMES[d.getUTCDay()] || '';
  return `${weekday} ${isoDate}`;
}

function formatDateTimeLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function hoursBetween(startIso: string, endIso: string): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  return roundHours(diffMs / (1000 * 60 * 60));
}

function splitText(font: PDFFont, text: string, maxWidth: number, fontSize: number): string[] {
  const cleaned = String(text || '').replace(/\r/g, '');
  if (!cleaned.trim()) return [];

  const paragraphs = cleaned.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }

    let current = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${current} ${words[i]}`;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }

  return lines;
}

function buildSections(data: WeeklyHoursPdfData): EmployeeReportSection[] {
  const detailsByEmployee = new Map<number, WeeklyHoursPdfDetailEntry[]>();

  for (const entry of data.detailEntries) {
    const list = detailsByEmployee.get(entry.employee_id) || [];
    list.push(entry);
    detailsByEmployee.set(entry.employee_id, list);
  }

  return data.summaries.map((summary) => {
    const detailRows = (detailsByEmployee.get(summary.employee_id) || []).slice().sort((a, b) => {
      const byDate = String(a.date).localeCompare(String(b.date));
      if (byDate !== 0) return byDate;
      const byClockIn = String(a.clock_in_at || '').localeCompare(String(b.clock_in_at || ''));
      if (byClockIn !== 0) return byClockIn;
      return String(a.job_name || '').localeCompare(String(b.job_name || ''));
    });

    const daysByDate = new Map<string, EmployeeReportSection['days'][number]>();
    let totalLunchDeducted = 0;

    for (const entry of detailRows) {
      const rawHours = entry.clock_in_at && entry.clock_out_at ? hoursBetween(entry.clock_in_at, entry.clock_out_at) : null;
      const paidHours = roundHours(Number(entry.hours || 0));
      const computedLunchDeduction = rawHours !== null ? Math.max(roundHours(rawHours - paidHours), 0) : 0;
      const lunchDeducted = entry.lunch_deduction_exempt ? 0 : computedLunchDeduction;
      totalLunchDeducted = roundHours(totalLunchDeducted + lunchDeducted);

      const existingDay = daysByDate.get(entry.date) || {
        date: entry.date,
        label: formatDateLabel(entry.date),
        paidHours: 0,
        lunchDeducted: 0,
        entries: [],
      };

      existingDay.paidHours = roundHours(existingDay.paidHours + paidHours);
      existingDay.lunchDeducted = roundHours(existingDay.lunchDeducted + lunchDeducted);
      existingDay.entries.push({
        timeLabel: entry.clock_in_at && entry.clock_out_at
          ? `${formatDateTimeLabel(entry.clock_in_at)} - ${formatDateTimeLabel(entry.clock_out_at)}`
          : 'Manual hours entry',
        jobName: entry.job_name,
        rawHours,
        lunchDeducted,
        paidHours,
        methodLabel: entry.entry_method === 'clock' ? 'Clock' : 'Manual',
        note: entry.note,
      });

      daysByDate.set(entry.date, existingDay);
    }

    const days = Array.from(daysByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      employeeId: summary.employee_id,
      employeeName: summary.employee_name,
      approvedLabel: summary.approved_at ? 'Approved' : 'Open',
      approvedBy: summary.approved_by_name || null,
      totalHours: roundHours(Number(summary.total_hours || 0)),
      entryCount: Number(summary.entry_count || 0),
      totalLunchDeducted,
      days,
    };
  });
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = rgb(0.14, 0.18, 0.24)) {
  page.drawText(text, { x, y, font, size, color });
}

function drawWrappedLines(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number, lineGap = 3, color = rgb(0.24, 0.28, 0.33)) {
  const lines = splitText(font, text, width, size);
  let cursorY = y;
  for (const line of lines) {
    drawText(page, line, x, cursorY, font, size, color);
    cursorY -= size + lineGap;
  }
  return cursorY;
}

export async function generateWeeklyHoursPdf(data: WeeklyHoursPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedTenantLogo(pdfDoc, data.tenant.logo_path);
  const sections = buildSections(data);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - TOP_MARGIN;
  let pageNumber = 1;

  const startNewPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - TOP_MARGIN;
    pageNumber += 1;
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < BOTTOM_MARGIN) {
      startNewPage();
    }
  };

  const drawHeader = () => {
    const accent = rgb(0.12, 0.23, 0.37);
    const gold = rgb(0.96, 0.62, 0.04);

    page.drawRectangle({
      x: LEFT_MARGIN,
      y: cursorY - 74,
      width: CONTENT_WIDTH,
      height: 74,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.91, 0.95),
      borderWidth: 1,
    });

    let textLeft = LEFT_MARGIN + 18;
    if (logo) {
      const maxWidth = 96;
      const maxHeight = 42;
      const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
      const drawWidth = logo.width * scale;
      const drawHeight = logo.height * scale;
      page.drawImage(logo.image, {
        x: LEFT_MARGIN + 16,
        y: cursorY - 56,
        width: drawWidth,
        height: drawHeight,
      });
      textLeft = LEFT_MARGIN + 126;
    }

    drawText(page, data.tenant.name || 'Tenant', textLeft, cursorY - 22, bold, 18, accent);
    drawText(page, 'Weekly Employee Hours Report', textLeft, cursorY - 42, bold, 12, rgb(0.2, 0.24, 0.29));
    drawText(page, `Week: ${data.week.start} through ${data.week.end}`, textLeft, cursorY - 58, regular, 10, rgb(0.35, 0.39, 0.44));
    drawText(page, `Generated: ${new Date().toLocaleString('en-US')}`, PAGE_WIDTH - RIGHT_MARGIN - 150, cursorY - 22, regular, 9, rgb(0.35, 0.39, 0.44));

    page.drawRectangle({ x: LEFT_MARGIN, y: cursorY - 82, width: CONTENT_WIDTH, height: 4, color: gold });
    cursorY -= 104;
  };

  drawHeader();

  for (const section of sections) {
    const estimatedHeaderHeight = 70;
    ensureSpace(estimatedHeaderHeight);

    page.drawRectangle({
      x: LEFT_MARGIN,
      y: cursorY - 54,
      width: CONTENT_WIDTH,
      height: 54,
      color: rgb(0.985, 0.988, 0.993),
      borderColor: rgb(0.89, 0.92, 0.95),
      borderWidth: 1,
    });

    drawText(page, section.employeeName, LEFT_MARGIN + 14, cursorY - 20, bold, 13);
    drawText(page, `Employee #${section.employeeId}`, LEFT_MARGIN + 14, cursorY - 36, regular, 9, rgb(0.38, 0.42, 0.47));
    drawText(page, `Status: ${section.approvedLabel}`, LEFT_MARGIN + 220, cursorY - 20, bold, 10, section.approvedLabel === 'Approved' ? rgb(0.12, 0.45, 0.25) : rgb(0.72, 0.46, 0.09));
    drawText(page, `Entries: ${section.entryCount}`, LEFT_MARGIN + 220, cursorY - 36, regular, 9, rgb(0.38, 0.42, 0.47));
    drawText(page, `Paid Hours: ${formatHours(section.totalHours)}`, LEFT_MARGIN + 360, cursorY - 20, bold, 10);
    drawText(page, `Lunch Deducted: ${formatHours(section.totalLunchDeducted)}`, LEFT_MARGIN + 360, cursorY - 36, regular, 9, rgb(0.38, 0.42, 0.47));
    if (section.approvedBy) {
      drawText(page, `Approved By: ${section.approvedBy}`, LEFT_MARGIN + 14, cursorY - 49, regular, 8.5, rgb(0.38, 0.42, 0.47));
    }
    cursorY -= 70;

    if (!section.days.length) {
      ensureSpace(24);
      drawText(page, 'No time entries for this employee during the selected week.', LEFT_MARGIN + 6, cursorY - 2, regular, 9, rgb(0.43, 0.47, 0.52));
      cursorY -= 22;
      continue;
    }

    for (const day of section.days) {
      ensureSpace(42);
      page.drawRectangle({
        x: LEFT_MARGIN + 4,
        y: cursorY - 24,
        width: CONTENT_WIDTH - 8,
        height: 24,
        color: rgb(0.95, 0.97, 0.99),
      });
      drawText(page, day.label, LEFT_MARGIN + 12, cursorY - 16, bold, 10);
      drawText(page, `Paid: ${formatHours(day.paidHours)} hrs`, LEFT_MARGIN + 240, cursorY - 16, regular, 9, rgb(0.22, 0.27, 0.32));
      drawText(page, `Lunch Deducted: ${formatHours(day.lunchDeducted)} hrs`, LEFT_MARGIN + 365, cursorY - 16, regular, 9, rgb(0.22, 0.27, 0.32));
      cursorY -= 32;

      for (const entry of day.entries) {
        const noteText = entry.note ? `Note: ${entry.note}` : '';
        const leftText = `${entry.timeLabel}  •  ${entry.jobName}`;
        const rightText = `Raw: ${entry.rawHours !== null ? formatHours(entry.rawHours) : '—'}   Lunch: ${formatHours(entry.lunchDeducted)}   Paid: ${formatHours(entry.paidHours)}   Method: ${entry.methodLabel}`;
        const noteLines = noteText ? splitText(regular, noteText, CONTENT_WIDTH - 36, 8.5) : [];
        const neededHeight = 24 + (noteLines.length ? noteLines.length * 12 + 4 : 0);
        ensureSpace(neededHeight);

        drawText(page, leftText, LEFT_MARGIN + 18, cursorY - 2, regular, 8.8, rgb(0.18, 0.22, 0.27));
        drawText(page, rightText, LEFT_MARGIN + 18, cursorY - 14, regular, 8.2, rgb(0.42, 0.46, 0.51));
        cursorY -= 24;

        if (noteLines.length) {
          for (const line of noteLines) {
            drawText(page, line, LEFT_MARGIN + 24, cursorY - 2, regular, 8.3, rgb(0.42, 0.46, 0.51));
            cursorY -= 11;
          }
          cursorY -= 2;
        }
      }

      cursorY -= 6;
    }

    ensureSpace(36);
    page.drawLine({
      start: { x: LEFT_MARGIN, y: cursorY },
      end: { x: PAGE_WIDTH - RIGHT_MARGIN, y: cursorY },
      thickness: 1,
      color: rgb(0.88, 0.91, 0.95),
    });
    cursorY -= 18;
  }

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i += 1) {
    const p = pages[i];
    drawText(p, `Page ${i + 1} of ${pages.length}`, PAGE_WIDTH - RIGHT_MARGIN - 58, 20, regular, 8, rgb(0.47, 0.5, 0.55));
    drawText(p, 'Lunch proof shows Raw Hours minus Lunch equals Paid Hours when clock times are present.', LEFT_MARGIN, 20, regular, 8, rgb(0.47, 0.5, 0.55));
  }

  return pdfDoc.save();
}
