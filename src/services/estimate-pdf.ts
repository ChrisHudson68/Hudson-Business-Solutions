import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { EstimateWithLineItems } from '../db/types.js';
import { getEnv } from '../config/env.js';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 48;
const TOP_MARGIN = 58;
const BOTTOM_MARGIN = 72;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_X * 2);
const CONTINUED_PAGE_START_Y = PAGE_HEIGHT - 132;

interface EstimateProposalPdfData {
  tenant: {
    name: string;
    subdomain: string;
    logo_path: string | null;
    company_email: string | null;
    company_phone: string | null;
    company_address: string | null;
    company_website?: string | null;
    proposal_license_info?: string | null;
    proposal_default_terms?: string | null;
    proposal_default_acknowledgment?: string | null;
  };
  estimate: EstimateWithLineItems;
}

type Theme = {
  primary: ReturnType<typeof rgb>;
  secondary: ReturnType<typeof rgb>;
  accent: ReturnType<typeof rgb>;
  text: ReturnType<typeof rgb>;
  muted: ReturnType<typeof rgb>;
  lightText: ReturnType<typeof rgb>;
  light: ReturnType<typeof rgb>;
  border: ReturnType<typeof rgb>;
  panel: ReturnType<typeof rgb>;
  panelAlt: ReturnType<typeof rgb>;
  white: ReturnType<typeof rgb>;
};

type EmbeddedLogo = {
  kind: 'png' | 'jpg';
  image: any;
};

type PdfContext = {
  pdfDoc: PDFDocument;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  };
  theme: Theme;
  pageNumber: number;
  page: PDFPage;
  y: number;
  tenant: EstimateProposalPdfData['tenant'];
  estimate: EstimateProposalPdfData['estimate'];
  logoImage?: EmbeddedLogo;
};

function resolveTheme(tenantName: string): Theme {
  const normalized = String(tenantName || '').trim().toLowerCase();

  if (normalized.includes('taylor')) {
    return {
      primary: rgb(0.133, 0.404, 0.729),
      secondary: rgb(0.855, 0.176, 0.22),
      accent: rgb(0.929, 0.49, 0.196),
      text: rgb(0.11, 0.14, 0.18),
      muted: rgb(0.40, 0.45, 0.53),
      lightText: rgb(0.92, 0.95, 0.99),
      light: rgb(0.965, 0.98, 1),
      border: rgb(0.84, 0.89, 0.95),
      panel: rgb(0.975, 0.985, 1),
      panelAlt: rgb(0.955, 0.972, 0.992),
      white: rgb(1, 1, 1),
    };
  }

  return {
    primary: rgb(0.118, 0.227, 0.373),
    secondary: rgb(0.961, 0.62, 0.043),
    accent: rgb(0.22, 0.58, 0.92),
    text: rgb(0.11, 0.14, 0.18),
    muted: rgb(0.40, 0.45, 0.53),
    lightText: rgb(0.92, 0.95, 0.99),
    light: rgb(0.965, 0.975, 0.985),
    border: rgb(0.85, 0.89, 0.93),
    panel: rgb(0.98, 0.985, 0.99),
    panelAlt: rgb(0.955, 0.965, 0.975),
    white: rgb(1, 1, 1),
  };
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactNumber(value: number): string {
  const num = Number(value || 0);
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace(/\.?0+$/, '');
}

function formatDate(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';

  const parsed = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function titleCase(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';

  return raw
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeCompanyAddress(value: string | null | undefined): string[] {
  const raw = String(value || '').trim();
  if (!raw) return [];

  return raw
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeScopeParagraphs(value: string | null | undefined): string[] {
  const raw = String(value || '').replace(/\r/g, '').trim();
  if (!raw) return [];

  return raw
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeLooseSections(value: string | null | undefined): string[] {
  const raw = String(value || '').replace(/\r/g, '').trim();
  if (!raw) return [];

  return raw
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeLooseLines(value: string | null | undefined): string[] {
  const raw = String(value || '').replace(/\r/g, '').trim();
  if (!raw) return [];

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitBulletLikeLines(paragraph: string): string[] | null {
  const lines = paragraph
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;
  if (!lines.every((line) => /^[-*•]/.test(line))) return null;

  return lines.map((line) => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
}

function splitListLikeLines(block: string): string[] | null {
  const lines = String(block || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const listLines = lines
    .map((line) => {
      const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
      if (bulletMatch) return bulletMatch[1].trim();

      const numberedMatch = line.match(/^\d+[.)]\s+(.+)$/);
      if (numberedMatch) return numberedMatch[1].trim();

      const letteredMatch = line.match(/^[A-Za-z][.)]\s+(.+)$/);
      if (letteredMatch) return letteredMatch[1].trim();

      return null;
    })
    .filter((line): line is string => Boolean(line));

  if (listLines.length !== lines.length) return null;
  return listLines;
}

function drawScopeContentBlock(ctx: PdfContext, block: string): void {
  const lines = String(block || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return;

  const firstLine = lines[0] || '';
  const remainingLines = lines.slice(1);
  const firstLineIsHeading = /[:：]$/.test(firstLine);

  if (firstLineIsHeading && remainingLines.length) {
    const heading = firstLine.replace(/[:：]+$/, '').trim();
    const remainingText = remainingLines.join('\n');
    const nestedList = splitListLikeLines(remainingText);

    ensureSpace(ctx, 20);
    ctx.page.drawText(`${heading}:`, {
      x: MARGIN_X,
      y: ctx.y,
      size: 10.75,
      font: ctx.fonts.bold,
      color: ctx.theme.text,
    });
    ctx.y -= 17;

    if (nestedList?.length) {
      drawBulletList(ctx, nestedList);
      return;
    }

    const nestedParagraphs = remainingText
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const paragraph of nestedParagraphs) {
      const bullets = splitListLikeLines(paragraph) || splitBulletLikeLines(paragraph);
      if (bullets?.length) {
        drawBulletList(ctx, bullets);
      } else {
        drawParagraph(ctx, paragraph);
      }
    }
    return;
  }

  const directList = splitListLikeLines(block) || splitBulletLikeLines(block);
  if (directList?.length) {
    drawBulletList(ctx, directList);
    return;
  }

  if (drawStructuredRichTextSection(ctx, block)) {
    return;
  }

  drawParagraph(ctx, block);
}

function normalizeParagraphSpace(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseLabeledTermBlocks(value: string | null | undefined): Array<{ label?: string; body: string }> {
  const raw = String(value || '').replace(/\r/g, '').trim();
  if (!raw) return [];

  const blocks = raw
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  const parsed: Array<{ label?: string; body: string }> = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const lines = blocks[index]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) continue;

    const first = lines[0] || '';
    const firstIsLabel = /[:：]$/.test(first);

    if (firstIsLabel && lines.length > 1) {
      parsed.push({
        label: first.replace(/[:：]+$/, '').trim(),
        body: normalizeParagraphSpace(lines.slice(1).join(' ')),
      });
      continue;
    }

    if (firstIsLabel && lines.length === 1) {
      const next = blocks[index + 1];
      if (next) {
        parsed.push({
          label: first.replace(/[:：]+$/, '').trim(),
          body: normalizeParagraphSpace(next),
        });
        index += 1;
        continue;
      }
    }

    const colonIndex = first.indexOf(':');
    if (colonIndex > 0 && colonIndex < 80) {
      const label = first.slice(0, colonIndex).trim();
      const remainder = [first.slice(colonIndex + 1).trim(), ...lines.slice(1)]
        .join(' ')
        .trim();

      if (label && remainder) {
        parsed.push({
          label,
          body: normalizeParagraphSpace(remainder),
        });
        continue;
      }
    }

    parsed.push({
      body: normalizeParagraphSpace(lines.join(' ')),
    });
  }

  return parsed.filter((entry) => entry.body);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);

    if (width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function formatPhoneNumber(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return raw;
}

function fitImageDimensions(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: width * ratio,
    height: height * ratio,
  };
}

function drawHeader(ctx: PdfContext): void {
  const { page, fonts, theme, tenant, logoImage } = ctx;

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 96,
    width: PAGE_WIDTH,
    height: 96,
    color: theme.primary,
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 106,
    width: 170,
    height: 10,
    color: theme.secondary,
  });

  page.drawRectangle({
    x: PAGE_WIDTH - 170,
    y: PAGE_HEIGHT - 106,
    width: 170,
    height: 10,
    color: theme.accent,
  });

  let logoBlockWidth = 0;

  if (logoImage) {
    const dims = fitImageDimensions(logoImage.image.width, logoImage.image.height, 110, 50);
    page.drawImage(logoImage.image, {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 73,
      width: dims.width,
      height: dims.height,
    });
    logoBlockWidth = dims.width + 16;
  }

  const companyX = MARGIN_X + logoBlockWidth;
  const headerTopY = PAGE_HEIGHT - 38;
  const nameSize = String(tenant.name || '').length > 26 ? 18 : 21;

  page.drawText(String(tenant.name || 'Project Proposal'), {
    x: companyX,
    y: headerTopY,
    size: nameSize,
    font: fonts.bold,
    color: theme.white,
  });

  const contactParts = [
    formatPhoneNumber(tenant.company_phone),
    tenant.company_email || '',
    tenant.company_website || '',
  ].filter((part) => part && part !== '—');

  const contactText = contactParts.join('   |   ');
  if (contactText) {
    const contactLines = wrapText(contactText, fonts.regular, 9, PAGE_WIDTH - companyX - MARGIN_X);
    let lineY = PAGE_HEIGHT - 56;
    for (const line of contactLines.slice(0, 2)) {
      page.drawText(line, {
        x: companyX,
        y: lineY,
        size: 9,
        font: fonts.regular,
        color: theme.lightText,
      });
      lineY -= 11;
    }
  }
}

function drawFooter(ctx: PdfContext): void {
  const { page, fonts, theme, tenant, pageNumber } = ctx;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: 18,
    color: theme.primary,
  });

  const metaY = 30;

  const leftParts = [
    tenant.company_website || '',
    tenant.company_email || '',
    formatPhoneNumber(tenant.company_phone),
  ].filter((part) => part && part !== '—');

  const leftText = leftParts.join('   |   ') || tenant.name;
  const leftLine = wrapText(leftText, fonts.regular, 8.5, CONTENT_WIDTH * 0.60)[0] || leftText;

  page.drawText(leftLine, {
    x: MARGIN_X,
    y: metaY,
    size: 8.5,
    font: fonts.regular,
    color: theme.muted,
  });

  const licenseLines = normalizeLooseLines(tenant.proposal_license_info).slice(0, 2);
  let rightY = metaY + (licenseLines.length > 1 ? 8 : 0);

  for (const lineText of licenseLines) {
    const line = wrapText(lineText, fonts.regular, 8.1, 190)[0] || lineText;
    const width = fonts.regular.widthOfTextAtSize(line, 8.1);

    page.drawText(line, {
      x: PAGE_WIDTH - MARGIN_X - width,
      y: rightY,
      size: 8.1,
      font: fonts.regular,
      color: theme.muted,
    });

    rightY -= 10;
  }

  const pageText = `Page ${pageNumber}`;
  const pageTextWidth = fonts.regular.widthOfTextAtSize(pageText, 8.5);

  page.drawText(pageText, {
    x: PAGE_WIDTH - MARGIN_X - pageTextWidth,
    y: 5,
    size: 8.5,
    font: fonts.regular,
    color: theme.white,
  });
}

function addPage(ctx: PdfContext): void {
  ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.pageNumber += 1;
  ctx.y = CONTINUED_PAGE_START_Y;
  drawHeader(ctx);
  drawFooter(ctx);
}

function ensureSpace(ctx: PdfContext, requiredHeight: number): void {
  if (ctx.y - requiredHeight < BOTTOM_MARGIN) {
    addPage(ctx);
  }
}

function drawTextLines(
  ctx: PdfContext,
  lines: string[],
  x: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  leading: number,
): void {
  for (const line of lines) {
    ensureSpace(ctx, leading);
    ctx.page.drawText(line, {
      x,
      y: ctx.y,
      size,
      font,
      color,
    });
    ctx.y -= leading;
  }
}

function drawSectionHeading(ctx: PdfContext, title: string, subtitle?: string): void {
  ensureSpace(ctx, subtitle ? 64 : 38);

  ctx.page.drawText(title, {
    x: MARGIN_X,
    y: ctx.y,
    size: 16.5,
    font: ctx.fonts.bold,
    color: ctx.theme.primary,
  });

  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - 9,
    width: 150,
    height: 2.5,
    color: ctx.theme.secondary,
  });

  ctx.y -= 21;

  if (subtitle) {
    const lines = wrapText(subtitle, ctx.fonts.regular, 10.25, CONTENT_WIDTH);
    drawTextLines(ctx, lines, MARGIN_X, 10.25, ctx.fonts.regular, ctx.theme.muted, 13);
    ctx.y -= 3;
  }
}

function drawParagraph(ctx: PdfContext, text: string, size = 10.75, leading = 14): void {
  const lines = wrapText(text, ctx.fonts.regular, size, CONTENT_WIDTH);
  drawTextLines(ctx, lines, MARGIN_X, size, ctx.fonts.regular, ctx.theme.text, leading);
  ctx.y -= 4;
}

function drawBulletList(ctx: PdfContext, bullets: string[]): void {
  for (const bullet of bullets) {
    const bulletX = MARGIN_X + 6;
    const textX = MARGIN_X + 20;
    const lines = wrapText(bullet, ctx.fonts.regular, 10.5, CONTENT_WIDTH - 24);

    ensureSpace(ctx, Math.max(18, lines.length * 13 + 4));

    ctx.page.drawText('•', {
      x: bulletX,
      y: ctx.y,
      size: 12,
      font: ctx.fonts.bold,
      color: ctx.theme.primary,
    });

    let lineY = ctx.y;
    for (const line of lines) {
      ctx.page.drawText(line, {
        x: textX,
        y: lineY,
        size: 10.5,
        font: ctx.fonts.regular,
        color: ctx.theme.text,
      });
      lineY -= 13;
    }

    ctx.y = lineY - 2;
  }

  ctx.y -= 2;
}

function drawProposalCover(ctx: PdfContext): void {
  const { page, fonts, theme, tenant, estimate } = ctx;

  const proposalTitle = String(estimate.proposal_title || '').trim() || 'Project Proposal';

  const leftX = MARGIN_X;
  const rightX = PAGE_WIDTH - MARGIN_X - 210;
  const titleY = PAGE_HEIGHT - 154;

  page.drawText('PROPOSAL', {
    x: leftX,
    y: titleY + 26,
    size: 11,
    font: fonts.bold,
    color: theme.secondary,
  });

  const titleLines = wrapText(proposalTitle, fonts.bold, 24, 300);
  let drawY = titleY;
  for (const line of titleLines.slice(0, 3)) {
    page.drawText(line, {
      x: leftX,
      y: drawY,
      size: 24,
      font: fonts.bold,
      color: theme.text,
    });
    drawY -= 28;
  }

  const boxHeight = 106;
  const boxY = titleY - 40;

  page.drawRectangle({
    x: rightX,
    y: boxY,
    width: 210,
    height: boxHeight,
    color: theme.panel,
    borderColor: theme.border,
    borderWidth: 1,
  });

  page.drawRectangle({
    x: rightX,
    y: boxY + boxHeight - 22,
    width: 210,
    height: 22,
    color: theme.primary,
  });

  page.drawText('Company Information', {
    x: rightX + 10,
    y: boxY + boxHeight - 15,
    size: 9,
    font: fonts.bold,
    color: theme.white,
  });

  const companyLines = [
    ...normalizeCompanyAddress(tenant.company_address),
    formatPhoneNumber(tenant.company_phone),
    tenant.company_email || '',
    tenant.company_website || '',
  ].filter((line) => line && line !== '—');

  let infoY = boxY + boxHeight - 35;
  for (const rawLine of companyLines.slice(0, 6)) {
    const lines = wrapText(rawLine, fonts.regular, 9.75, 190);
    for (const line of lines) {
      page.drawText(line, {
        x: rightX + 10,
        y: infoY,
        size: 9.75,
        font: rawLine === tenant.name ? fonts.bold : fonts.regular,
        color: rawLine === tenant.name ? theme.text : theme.muted,
      });
      infoY -= 11;
    }
  }

  const introText = `Prepared for ${estimate.customer_name || 'the customer'} for the project outlined below.`;
  const introLines = wrapText(introText, fonts.regular, 11, 300);
  let introY = drawY - 4;
  for (const line of introLines) {
    page.drawText(line, {
      x: leftX,
      y: introY,
      size: 11,
      font: fonts.regular,
      color: theme.muted,
    });
    introY -= 14;
  }

  ctx.y = boxY - 24;
}

function drawInfoGrid(ctx: PdfContext): void {
  const rows = [
    ['Client', ctx.estimate.customer_name || '—', 'Estimate #', ctx.estimate.estimate_number || '—'],
    ['Project Address', String(ctx.estimate.site_address || 'To be confirmed'), 'Prepared Date', formatDate(ctx.estimate.created_at?.slice(0, 10) || null)],
    ['Customer Email', String(ctx.estimate.customer_email || 'Not provided'), 'Expiration Date', formatDate(ctx.estimate.expiration_date)],
    ['Customer Phone', formatPhoneNumber(ctx.estimate.customer_phone), 'Status', titleCase(ctx.estimate.status || 'draft')],
  ] as const;

  const leftX = MARGIN_X;
  const rightX = MARGIN_X + (CONTENT_WIDTH / 2) + 8;
  const columnWidth = (CONTENT_WIDTH / 2) - 12;

  drawSectionHeading(ctx, 'Project Information');

  for (const [leftLabel, leftValue, rightLabel, rightValue] of rows) {
    const leftLines = wrapText(leftValue || '—', ctx.fonts.regular, 10.25, columnWidth - 20);
    const rightLines = wrapText(rightValue || '—', ctx.fonts.regular, 10.25, columnWidth - 20);
    const contentLines = Math.max(leftLines.length, rightLines.length);
    const rowHeight = Math.max(36, 18 + contentLines * 11);

    ensureSpace(ctx, rowHeight + 8);

    ctx.page.drawRectangle({
      x: leftX,
      y: ctx.y - rowHeight + 6,
      width: columnWidth,
      height: rowHeight,
      color: ctx.theme.panel,
      borderColor: ctx.theme.border,
      borderWidth: 1,
    });

    ctx.page.drawRectangle({
      x: rightX,
      y: ctx.y - rowHeight + 6,
      width: columnWidth,
      height: rowHeight,
      color: ctx.theme.panel,
      borderColor: ctx.theme.border,
      borderWidth: 1,
    });

    ctx.page.drawText(leftLabel.toUpperCase(), {
      x: leftX + 10,
      y: ctx.y - 8,
      size: 8.5,
      font: ctx.fonts.bold,
      color: ctx.theme.muted,
    });

    ctx.page.drawText(rightLabel.toUpperCase(), {
      x: rightX + 10,
      y: ctx.y - 8,
      size: 8.5,
      font: ctx.fonts.bold,
      color: ctx.theme.muted,
    });

    let leftY = ctx.y - 21;
    for (const line of leftLines.slice(0, 3)) {
      ctx.page.drawText(line, {
        x: leftX + 10,
        y: leftY,
        size: 10.25,
        font: ctx.fonts.regular,
        color: ctx.theme.text,
      });
      leftY -= 11;
    }

    let rightY = ctx.y - 21;
    for (const line of rightLines.slice(0, 3)) {
      ctx.page.drawText(line, {
        x: rightX + 10,
        y: rightY,
        size: 10.25,
        font: ctx.fonts.regular,
        color: ctx.theme.text,
      });
      rightY -= 11;
    }

    ctx.y -= rowHeight + 8;
  }

  ctx.y -= 2;
}

function drawInvestmentSummary(ctx: PdfContext): void {
  const { estimate, page, fonts, theme } = ctx;
  const boxWidth = 258;
  const rows = [
    ['Subtotal', `$${formatMoney(Number(estimate.subtotal || 0))}`],
    ['Tax', `$${formatMoney(Number(estimate.tax || 0))}`],
    ['Total Project Investment', `$${formatMoney(Number(estimate.total || 0))}`],
  ] as const;

  const boxHeight = 104;
  ensureSpace(ctx, boxHeight + 10);

  const boxX = PAGE_WIDTH - MARGIN_X - boxWidth;
  const boxY = ctx.y - boxHeight + 8;

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: theme.panelAlt,
    borderColor: theme.border,
    borderWidth: 1,
  });

  page.drawRectangle({
    x: boxX,
    y: boxY + boxHeight - 24,
    width: boxWidth,
    height: 24,
    color: theme.primary,
  });

  page.drawText('Investment Summary', {
    x: boxX + 12,
    y: boxY + boxHeight - 15,
    size: 10,
    font: fonts.bold,
    color: theme.white,
  });

  let rowY = boxY + boxHeight - 41;

  rows.forEach(([label, value], index) => {
    const isLast = index === rows.length - 1;
    const size = isLast ? 11.5 : 10.25;
    const font = isLast ? fonts.bold : fonts.regular;
    const valueWidth = font.widthOfTextAtSize(value, size);

    page.drawText(label, {
      x: boxX + 12,
      y: rowY,
      size,
      font,
      color: theme.text,
    });

    page.drawText(value, {
      x: boxX + boxWidth - 12 - valueWidth,
      y: rowY,
      size,
      font,
      color: theme.text,
    });

    if (!isLast) {
      page.drawLine({
        start: { x: boxX + 12, y: rowY - 7 },
        end: { x: boxX + boxWidth - 12, y: rowY - 7 },
        thickness: 1,
        color: theme.border,
      });
    }

    rowY -= 24;
  });

  ctx.y = boxY - 14;
}

function drawLineItemsTableHeader(ctx: PdfContext, tableX: number, widths: number[], headers: string[], headerHeight: number): void {
  let headerX = tableX;
  headers.forEach((header, index) => {
    ctx.page.drawRectangle({
      x: headerX,
      y: ctx.y - headerHeight + 6,
      width: widths[index],
      height: headerHeight,
      color: ctx.theme.primary,
    });

    ctx.page.drawText(header, {
      x: headerX + 6,
      y: ctx.y - 11,
      size: 8.7,
      font: ctx.fonts.bold,
      color: ctx.theme.white,
    });

    headerX += widths[index];
  });

  ctx.y -= 28;
}

function drawLineItemsTable(ctx: PdfContext): void {
  drawSectionHeading(
    ctx,
    'Detailed Investment',
    'The following line items are generated from the estimate and reflect the current project pricing.',
  );

  const tableX = MARGIN_X;
  const widths = [232, 48, 62, 78, 96];
  const headers = ['Description', 'Qty', 'Unit', 'Unit Price', 'Line Total'];
  const headerHeight = 24;

  ensureSpace(ctx, 50);
  drawLineItemsTableHeader(ctx, tableX, widths, headers, headerHeight);

  const totalWidth = widths.reduce((sum, width) => sum + width, 0);

  ctx.estimate.line_items.forEach((item, rowIndex) => {
    const description = String(item.description || '—');
    const descriptionLines = wrapText(description, ctx.fonts.regular, 10, widths[0] - 12);
    const rowHeight = Math.max(26, descriptionLines.length * 12 + 10);

    if (ctx.y - (rowHeight + 4) < BOTTOM_MARGIN) {
      addPage(ctx);
      ensureSpace(ctx, 50);
      drawLineItemsTableHeader(ctx, tableX, widths, headers, headerHeight);
    }

    ctx.page.drawRectangle({
      x: tableX,
      y: ctx.y - rowHeight + 4,
      width: totalWidth,
      height: rowHeight,
      color: rowIndex % 2 === 0 ? ctx.theme.white : ctx.theme.panel,
      borderColor: ctx.theme.border,
      borderWidth: 1,
    });

    let descY = ctx.y - 11;
    for (const line of descriptionLines) {
      ctx.page.drawText(line, {
        x: tableX + 6,
        y: descY,
        size: 10,
        font: ctx.fonts.regular,
        color: ctx.theme.text,
      });
      descY -= 12;
    }

    const values = [
      formatCompactNumber(Number(item.quantity || 0)),
      item.unit || '—',
      `$${formatMoney(Number(item.unit_price || 0))}`,
      `$${formatMoney(Number(item.line_total || 0))}`,
    ];

    let cellX = tableX + widths[0];
    values.forEach((value, index) => {
      const width = widths[index + 1];
      const font = index >= 2 ? ctx.fonts.bold : ctx.fonts.regular;
      const textWidth = font.widthOfTextAtSize(value, 10);
      const drawX = index === 1 ? cellX + 6 : cellX + width - 6 - textWidth;

      ctx.page.drawText(value, {
        x: drawX,
        y: ctx.y - 11,
        size: 10,
        font,
        color: ctx.theme.text,
      });

      cellX += width;
    });

    let dividerX = tableX;
    widths.slice(0, -1).forEach((width) => {
      dividerX += width;
      ctx.page.drawLine({
        start: { x: dividerX, y: ctx.y - rowHeight + 4 },
        end: { x: dividerX, y: ctx.y + 4 },
        thickness: 1,
        color: ctx.theme.border,
      });
    });

    ctx.y -= rowHeight + 4;
  });

  ctx.y -= 6;
}

function defaultScheduleLabel(index: number, percentText: string): string {
  const normalized = percentText.trim();
  if (index === 0) return normalized === '100%' ? 'Full Payment' : 'Deposit';
  if (index === 1) return 'Progress Payment';
  if (index === 2) return 'Final Payment';
  return 'Scheduled Payment';
}

function parsePaymentScheduleEntries(value: string): Array<{ title: string; detail: string }> {
  const lines = normalizeLooseLines(value);
  if (!lines.length) return [];

  return lines
    .map((line, index) => {
      const trimmed = line.replace(/^[•*-]\s*/, '').trim();
      if (!trimmed) return null;

      if (/^-?\d+(?:\.\d+)?%$/.test(trimmed)) {
        const percentText = trimmed.replace(/^-/, '');
        return {
          title: percentText,
          detail: defaultScheduleLabel(index, percentText),
        };
      }

      const percentAtStart = trimmed.match(/^(-?\d+(?:\.\d+)?%)\s*[-–—:]\s*(.+)$/);
      if (percentAtStart) {
        return {
          title: percentAtStart[1].replace(/^-/, ''),
          detail: percentAtStart[2].trim(),
        };
      }

      const percentAtEnd = trimmed.match(/^(.+?)\s*[-–—:]\s*(-?\d+(?:\.\d+)?%)$/);
      if (percentAtEnd) {
        return {
          title: percentAtEnd[2].replace(/^-/, ''),
          detail: percentAtEnd[1].trim(),
        };
      }

      const percentOnlyInside = trimmed.match(/(-?\d+(?:\.\d+)?%)/);
      if (percentOnlyInside) {
        const percentText = percentOnlyInside[1].replace(/^-/, '');
        const detail = trimmed.replace(percentOnlyInside[1], '').replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();

        return {
          title: percentText,
          detail: detail || defaultScheduleLabel(index, percentText),
        };
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        return {
          title: trimmed.slice(0, colonIndex).trim(),
          detail: trimmed.slice(colonIndex + 1).trim(),
        };
      }

      const splitDash = trimmed.match(/^(.+?)\s*[-–—]\s*(.+)$/);
      if (splitDash) {
        return {
          title: splitDash[1].trim(),
          detail: splitDash[2].trim(),
        };
      }

      return {
        title: `Milestone ${index + 1}`,
        detail: trimmed,
      };
    })
    .filter((entry): entry is { title: string; detail: string } => Boolean(entry && (entry.title || entry.detail)));
}

function drawPaymentScheduleSection(ctx: PdfContext, source: string): void {
  const entries = parsePaymentScheduleEntries(source);

  drawSectionHeading(
    ctx,
    'Payment Schedule',
    'Milestone-based payment expectations for this project.',
  );

  if (!entries.length) {
    drawParagraph(ctx, source);
    return;
  }

  const col1Width = 120;
  const col2Width = CONTENT_WIDTH - col1Width;

  ensureSpace(ctx, 34);

  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - 20,
    width: col1Width,
    height: 22,
    color: ctx.theme.primary,
  });

  ctx.page.drawRectangle({
    x: MARGIN_X + col1Width,
    y: ctx.y - 20,
    width: col2Width,
    height: 22,
    color: ctx.theme.primary,
  });

  ctx.page.drawText('Schedule', {
    x: MARGIN_X + 8,
    y: ctx.y - 12,
    size: 9,
    font: ctx.fonts.bold,
    color: ctx.theme.white,
  });

  ctx.page.drawText('Description', {
    x: MARGIN_X + col1Width + 8,
    y: ctx.y - 12,
    size: 9,
    font: ctx.fonts.bold,
    color: ctx.theme.white,
  });

  ctx.y -= 26;

  entries.forEach((entry, index) => {
    const titleLines = wrapText(entry.title || `Milestone ${index + 1}`, ctx.fonts.bold, 10.25, col1Width - 16);
    const detailLines = wrapText(entry.detail || '—', ctx.fonts.regular, 10.25, col2Width - 16);
    const rowLines = Math.max(titleLines.length, detailLines.length);
    const rowHeight = Math.max(28, rowLines * 12 + 10);

    ensureSpace(ctx, rowHeight + 4);

    ctx.page.drawRectangle({
      x: MARGIN_X,
      y: ctx.y - rowHeight + 4,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: index % 2 === 0 ? ctx.theme.white : ctx.theme.panel,
      borderColor: ctx.theme.border,
      borderWidth: 1,
    });

    ctx.page.drawLine({
      start: { x: MARGIN_X + col1Width, y: ctx.y - rowHeight + 4 },
      end: { x: MARGIN_X + col1Width, y: ctx.y + 4 },
      thickness: 1,
      color: ctx.theme.border,
    });

    let titleY = ctx.y - 11;
    for (const line of titleLines) {
      ctx.page.drawText(line, {
        x: MARGIN_X + 8,
        y: titleY,
        size: 10.25,
        font: ctx.fonts.bold,
        color: ctx.theme.text,
      });
      titleY -= 12;
    }

    let detailY = ctx.y - 11;
    for (const line of detailLines) {
      ctx.page.drawText(line, {
        x: MARGIN_X + col1Width + 8,
        y: detailY,
        size: 10.25,
        font: ctx.fonts.regular,
        color: ctx.theme.text,
      });
      detailY -= 12;
    }

    ctx.y -= rowHeight + 4;
  });

  ctx.y -= 4;
}

function drawLabeledParagraph(ctx: PdfContext, label: string, text: string): void {
  const labelText = `${label}:`;
  const labelWidth = ctx.fonts.bold.widthOfTextAtSize(labelText, 10.75);
  const availableInlineWidth = CONTENT_WIDTH - labelWidth - 8;
  const inlineLines = wrapText(text, ctx.fonts.regular, 10.75, Math.max(availableInlineWidth, 120));

  ensureSpace(ctx, Math.max(20, inlineLines.length * 14 + 6));

  ctx.page.drawText(labelText, {
    x: MARGIN_X,
    y: ctx.y,
    size: 10.75,
    font: ctx.fonts.bold,
    color: ctx.theme.text,
  });

  if (!inlineLines.length) {
    ctx.y -= 18;
    return;
  }

  let lineY = ctx.y;
  for (let index = 0; index < inlineLines.length; index += 1) {
    ctx.page.drawText(inlineLines[index], {
      x: index === 0 ? MARGIN_X + labelWidth + 8 : MARGIN_X,
      y: lineY,
      size: 10.75,
      font: ctx.fonts.regular,
      color: ctx.theme.text,
    });
    lineY -= 14;
  }

  ctx.y = lineY - 4;
}

function drawStructuredRichTextSection(ctx: PdfContext, source: string): boolean {
  const sections = parseLabeledTermBlocks(source);
  if (!sections.length) return false;

  for (const section of sections) {
    if (section.label) {
      drawLabeledParagraph(ctx, section.label, section.body);
      continue;
    }

    const bullets = splitBulletLikeLines(section.body);
    if (bullets?.length) {
      drawBulletList(ctx, bullets);
    } else {
      drawParagraph(ctx, section.body);
    }
  }

  return true;
}

function drawScopeOfWorkSection(ctx: PdfContext): void {
  drawSectionHeading(
    ctx,
    'Scope of Work',
    'This proposal outlines the current project scope, pricing, and expectations based on the estimate on file.',
  );

  const source = String(ctx.estimate.scope_of_work || '').trim();

  if (!source) {
    drawParagraph(
      ctx,
      'Detailed project scope has not been entered yet. The line items below represent the current estimate breakdown for this project.',
    );
    return;
  }

  const scopeBlocks = normalizeScopeParagraphs(source);
  if (!scopeBlocks.length) {
    drawParagraph(ctx, source);
    return;
  }

  for (const block of scopeBlocks) {
    drawScopeContentBlock(ctx, block);
  }
}

function drawTermsSection(ctx: PdfContext): void {
  const company = ctx.tenant.name || 'The contractor';
  const source = String(ctx.estimate.custom_terms || ctx.tenant.proposal_default_terms || '').trim();

  drawSectionHeading(ctx, 'Additional Terms & Conditions');

  if (source) {
    drawStructuredRichTextSection(ctx, source);
    return;
  }

  const fallbackTerms = [
    `${company} will perform the work described in this proposal in a professional manner and in accordance with the final approved scope.`,
    'Any changes to scope, materials, quantities, schedule, or site conditions may require a written change order and may affect pricing.',
    'Final scheduling and project timing remain subject to material availability, site readiness, permit timing, and field conditions.',
    'This proposal reflects the current estimate details and may be revised if requested changes materially alter the project.',
    'Approval of this proposal authorizes the contractor to move forward with internal planning, scheduling, and next-step coordination.',
  ];

  drawBulletList(ctx, fallbackTerms);
}

function drawAcknowledgmentBox(ctx: PdfContext, text: string): void {
  const introLines = wrapText(text, ctx.fonts.regular, 10.5, CONTENT_WIDTH - 24);
  const bodyHeight = Math.max(64, introLines.length * 12 + 26);
  const boxHeight = bodyHeight + 84;

  ensureSpace(ctx, boxHeight + 10);

  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - boxHeight + 8,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: ctx.theme.panel,
    borderColor: ctx.theme.border,
    borderWidth: 1,
  });

  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - 18,
    width: CONTENT_WIDTH,
    height: 22,
    color: ctx.theme.primary,
  });

  ctx.page.drawText('Customer Acceptance', {
    x: MARGIN_X + 10,
    y: ctx.y - 10,
    size: 9.5,
    font: ctx.fonts.bold,
    color: ctx.theme.white,
  });

  let lineY = ctx.y - 34;
  for (const line of introLines) {
    ctx.page.drawText(line, {
      x: MARGIN_X + 12,
      y: lineY,
      size: 10.5,
      font: ctx.fonts.regular,
      color: ctx.theme.text,
    });
    lineY -= 12;
  }

  const topLineY = ctx.y - boxHeight + 48;
  const bottomLineY = ctx.y - boxHeight + 20;
  const leftStart = MARGIN_X + 12;
  const leftEnd = MARGIN_X + 240;
  const rightStart = PAGE_WIDTH - MARGIN_X - 170;
  const rightEnd = PAGE_WIDTH - MARGIN_X - 12;

  ctx.page.drawLine({
    start: { x: leftStart, y: topLineY + 14 },
    end: { x: leftEnd, y: topLineY + 14 },
    thickness: 1,
    color: ctx.theme.border,
  });

  ctx.page.drawLine({
    start: { x: rightStart, y: topLineY + 14 },
    end: { x: rightEnd, y: topLineY + 14 },
    thickness: 1,
    color: ctx.theme.border,
  });

  ctx.page.drawLine({
    start: { x: leftStart, y: bottomLineY + 14 },
    end: { x: leftEnd, y: bottomLineY + 14 },
    thickness: 1,
    color: ctx.theme.border,
  });

  ctx.page.drawText('Customer Signature', {
    x: leftStart,
    y: topLineY,
    size: 9,
    font: ctx.fonts.regular,
    color: ctx.theme.muted,
  });

  ctx.page.drawText('Date', {
    x: rightStart,
    y: topLineY,
    size: 9,
    font: ctx.fonts.regular,
    color: ctx.theme.muted,
  });

  ctx.page.drawText('Printed Name', {
    x: leftStart,
    y: bottomLineY,
    size: 9,
    font: ctx.fonts.regular,
    color: ctx.theme.muted,
  });

  ctx.y = ctx.y - boxHeight - 4;
}

function resolveLogoFilePath(logoPath: string | null | undefined): string | null {
  const raw = String(logoPath || '').trim();
  if (!raw) return null;

  if (raw.startsWith('/uploads/logos/')) {
    const filename = path.basename(raw);
    return path.join(getEnv().uploadDir, 'tenant_logos', filename);
  }

  if (path.isAbsolute(raw)) {
    return raw;
  }

  return null;
}

async function embedTenantLogo(pdfDoc: PDFDocument, logoPath: string | null | undefined): Promise<EmbeddedLogo | undefined> {
  const filePath = resolveLogoFilePath(logoPath);
  if (!filePath || !fs.existsSync(filePath)) return undefined;

  const bytes = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.png') {
      return { kind: 'png', image: await pdfDoc.embedPng(bytes) };
    }

    if (ext === '.jpg' || ext === '.jpeg') {
      return { kind: 'jpg', image: await pdfDoc.embedJpg(bytes) };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function generateEstimateProposalPdf(data: EstimateProposalPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ctx: PdfContext = {
    pdfDoc,
    fonts: { regular, bold },
    theme: resolveTheme(data.tenant.name),
    pageNumber: 1,
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - TOP_MARGIN,
    tenant: data.tenant,
    estimate: data.estimate,
    logoImage: await embedTenantLogo(pdfDoc, data.tenant.logo_path),
  };

  drawHeader(ctx);
  drawFooter(ctx);
  drawProposalCover(ctx);

  drawInfoGrid(ctx);
  drawScopeOfWorkSection(ctx);
  drawInvestmentSummary(ctx);
  drawLineItemsTable(ctx);

  const paymentScheduleSource = String(data.estimate.payment_schedule || '').trim();
  if (paymentScheduleSource) {
    drawPaymentScheduleSection(ctx, paymentScheduleSource);
  }

  drawTermsSection(ctx);

  drawSectionHeading(ctx, 'Acknowledgment & Agreement');
  const acknowledgment = String(
    data.tenant.proposal_default_acknowledgment
      || `By accepting this proposal, the customer authorizes ${data.tenant.name || 'our company'} to move forward with planning, scheduling, and project coordination based on the current approved scope.`,
  ).trim();

  drawAcknowledgmentBox(ctx, acknowledgment);

  return pdfDoc.save();
}
