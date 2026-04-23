import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { getEnv } from '../config/env.js';

export interface InvoicePdfLineItem {
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_total: number;
}

type LegacyInvoicePdfData = {
  tenant: {
    name: string;
    company_address: string | null;
    company_email: string | null;
    company_phone: string | null;
    logo_path?: string | null;
    company_website?: string | null;
  };
  invoice: {
    id: number;
    invoice_number: string | null;
    date_issued: string;
    due_date: string;
    amount?: number;
    notes?: string | null;
    subtotal_amount?: number;
    discount_amount?: number;
    tax_amount?: number;
    total_amount?: number;
    public_notes?: string | null;
    terms_text?: string | null;
    status?: string;
  };
  job: {
    job_name: string;
    client_name?: string | null;
    job_code?: string | null;
  };
  customer?: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  lineItems?: InvoicePdfLineItem[];
  paid?: number;
  outstanding?: number;
  status?: string;
};

export interface InvoicePdfData {
  tenant: {
    name: string;
    logo_path: string | null;
    company_address: string | null;
    company_email: string | null;
    company_phone: string | null;
    company_website?: string | null;
  };
  invoice: {
    id: number;
    invoice_number: string | null;
    date_issued: string;
    due_date: string;
    subtotal_amount: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    public_notes: string | null;
    terms_text: string | null;
    status: string;
  };
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  job: {
    job_name: string;
    job_code: string | null;
  };
  lineItems: InvoicePdfLineItem[];
  paid: number;
  outstanding: number;
  signatureData?: string | null;
  signerName?: string | null;
  signedAt?: string | null;
}

type NormalizedInvoicePdfData = InvoicePdfData;

type EmbeddedLogo = { image: any; width: number; height: number } | null;

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const TOP_MARGIN = 52;
const BOTTOM_MARGIN = 46;
const LEFT_MARGIN = 44;
const RIGHT_MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function formatCurrency(value: number): string {
  return roundMoney(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

async function embedTenantLogo(
  pdfDoc: PDFDocument,
  logoPath: string | null | undefined,
): Promise<EmbeddedLogo> {
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

function normalizeInvoicePdfData(input: InvoicePdfData | LegacyInvoicePdfData): NormalizedInvoicePdfData {
  const inp = input as LegacyInvoicePdfData;
  const legacyAmount = roundMoney(Number(inp.invoice.amount || 0));
  const subtotal = roundMoney(
    Number(
      inp.invoice.subtotal_amount ??
        inp.invoice.total_amount ??
        inp.invoice.amount ??
        0,
    ),
  );
  const discountAmount = roundMoney(Number(inp.invoice.discount_amount || 0));
  const taxAmount = roundMoney(Number(inp.invoice.tax_amount || 0));
  const totalAmount = roundMoney(
    Number(
      inp.invoice.total_amount ??
        inp.invoice.amount ??
        subtotal - discountAmount + taxAmount,
    ),
  );

  const paid = roundMoney(Number(inp.paid || 0));
  const outstanding = roundMoney(
    Number(
      inp.outstanding ??
        Math.max(totalAmount - paid, 0),
    ),
  );

  const lineItems =
    inp.lineItems && inp.lineItems.length
      ? inp.lineItems.map((item) => ({
          description: String(item.description || 'Invoice item'),
          quantity: Number(item.quantity || 0),
          unit: item.unit ?? null,
          unit_price: roundMoney(Number(item.unit_price || 0)),
          line_total: roundMoney(Number(item.line_total || 0)),
        }))
      : [
          {
            description: inp.job?.job_name
              ? `Invoice for ${inp.job.job_name}`
              : 'Invoice amount',
            quantity: 1,
            unit: null,
            unit_price: totalAmount || legacyAmount,
            line_total: totalAmount || legacyAmount,
          },
        ];

  return {
    tenant: {
      name: String(inp.tenant?.name || 'Hudson Business Solutions'),
      logo_path: inp.tenant?.logo_path ?? null,
      company_address: inp.tenant?.company_address ?? null,
      company_email: inp.tenant?.company_email ?? null,
      company_phone: inp.tenant?.company_phone ?? null,
      company_website: inp.tenant?.company_website ?? null,
    },
    invoice: {
      id: Number(inp.invoice.id || 0),
      invoice_number: inp.invoice.invoice_number ?? null,
      date_issued: String(inp.invoice.date_issued || ''),
      due_date: String(inp.invoice.due_date || ''),
      subtotal_amount: subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      public_notes: inp.invoice.public_notes ?? inp.invoice.notes ?? null,
      terms_text: inp.invoice.terms_text ?? null,
      status: String(inp.invoice.status || inp.status || 'Unpaid'),
    },
    customer: {
      name: inp.customer?.name ?? inp.job?.client_name ?? null,
      email: inp.customer?.email ?? null,
      phone: inp.customer?.phone ?? null,
      address: inp.customer?.address ?? null,
    },
    job: {
      job_name: String(inp.job?.job_name || 'Job'),
      job_code: inp.job?.job_code ?? null,
    },
    lineItems,
    paid,
    outstanding,
    signatureData: (inp as InvoicePdfData).signatureData ?? null,
    signerName: (inp as InvoicePdfData).signerName ?? null,
    signedAt: (inp as InvoicePdfData).signedAt ?? null,
  };
}

export async function generateInvoicePdf(
  rawData: InvoicePdfData | LegacyInvoicePdfData,
): Promise<Uint8Array> {
  const data = normalizeInvoicePdfData(rawData);

  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedTenantLogo(pdfDoc, data.tenant.logo_path);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - TOP_MARGIN;

  const footer = () => {
    page.drawText(`Generated by ${data.tenant.name || 'Hudson Business Solutions'}`, {
      x: LEFT_MARGIN,
      y: 22,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.45, 0.5),
    });
  };

  const drawHeader = () => {
    let rightX = PAGE_WIDTH - RIGHT_MARGIN;
    if (logo) {
      const maxWidth = 118;
      const maxHeight = 68;
      const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
      const width = logo.width * scale;
      const height = logo.height * scale;
      page.drawImage(logo.image, {
        x: rightX - width,
        y: y - height + 8,
        width,
        height,
      });
      rightX -= width + 14;
    }

    page.drawText(data.tenant.name || 'Hudson Business Solutions', {
      x: LEFT_MARGIN,
      y,
      size: 20,
      font: bold,
      color: rgb(0.11, 0.23, 0.37),
    });

    let headerLineY = y - 18;
    [
      data.tenant.company_address,
      data.tenant.company_email,
      data.tenant.company_phone,
      data.tenant.company_website,
    ]
      .filter(Boolean)
      .forEach((line) => {
        page.drawText(String(line), {
          x: LEFT_MARGIN,
          y: headerLineY,
          size: 9.5,
          font: regular,
          color: rgb(0.35, 0.39, 0.45),
        });
        headerLineY -= 12;
      });

    page.drawText('INVOICE', {
      x: rightX - bold.widthOfTextAtSize('INVOICE', 18),
      y,
      size: 18,
      font: bold,
      color: rgb(0.11, 0.23, 0.37),
    });

    const invoiceNumberText = data.invoice.invoice_number || `#${data.invoice.id}`;
    const statusText = data.invoice.status || 'Draft';

    page.drawText(`Invoice #: ${invoiceNumberText}`, {
      x: rightX - regular.widthOfTextAtSize(`Invoice #: ${invoiceNumberText}`, 10),
      y: y - 18,
      size: 10,
      font: regular,
      color: rgb(0.2, 0.24, 0.29),
    });

    page.drawText(`Status: ${statusText}`, {
      x: rightX - regular.widthOfTextAtSize(`Status: ${statusText}`, 10),
      y: y - 31,
      size: 10,
      font: regular,
      color: rgb(0.2, 0.24, 0.29),
    });

    y = y - 74;

    page.drawLine({
      start: { x: LEFT_MARGIN, y },
      end: { x: PAGE_WIDTH - RIGHT_MARGIN, y },
      thickness: 1,
      color: rgb(0.88, 0.91, 0.94),
    });
    y -= 18;
  };

  const newPage = () => {
    footer();
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - TOP_MARGIN;
    drawHeader();
  };

  const ensureSpace = (heightNeeded: number) => {
    if (y - heightNeeded < BOTTOM_MARGIN) {
      newPage();
    }
  };

  drawHeader();

  ensureSpace(120);
  const boxTop = y;
  const boxWidth = (CONTENT_WIDTH - 16) / 2;

  const drawInfoBox = (x: number, title: string, lines: string[]) => {
    page.drawRectangle({
      x,
      y: boxTop - 82,
      width: boxWidth,
      height: 82,
      borderColor: rgb(0.9, 0.92, 0.95),
      borderWidth: 1,
      color: rgb(0.985, 0.988, 0.992),
    });

    page.drawText(title, {
      x: x + 12,
      y: boxTop - 18,
      size: 10,
      font: bold,
      color: rgb(0.11, 0.23, 0.37),
    });

    let lineY = boxTop - 34;
    lines
      .filter((line) => line.trim())
      .slice(0, 4)
      .forEach((line) => {
        page.drawText(line, {
          x: x + 12,
          y: lineY,
          size: 9.5,
          font: regular,
          color: rgb(0.25, 0.29, 0.34),
        });
        lineY -= 12;
      });
  };

  drawInfoBox(LEFT_MARGIN, 'Bill To', [
    data.customer.name || '',
    data.customer.address || '',
    data.customer.email || '',
    data.customer.phone || '',
  ]);

  drawInfoBox(LEFT_MARGIN + boxWidth + 16, 'Invoice Details', [
    `Issue Date: ${data.invoice.date_issued}`,
    `Due Date: ${data.invoice.due_date}`,
    `Job: ${data.job.job_name}`,
    data.job.job_code ? `Job Code: ${data.job.job_code}` : '',
  ]);

  y = boxTop - 102;

  ensureSpace(40);
  const columns = {
    desc: LEFT_MARGIN + 8,
    qty: LEFT_MARGIN + 320,
    unit: LEFT_MARGIN + 380,
    rate: LEFT_MARGIN + 430,
    amount: LEFT_MARGIN + 500,
  };

  page.drawRectangle({
    x: LEFT_MARGIN,
    y: y - 20,
    width: CONTENT_WIDTH,
    height: 20,
    color: rgb(0.11, 0.23, 0.37),
  });

  page.drawText('Description', {
    x: columns.desc,
    y: y - 14,
    size: 9.5,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('Qty', {
    x: columns.qty,
    y: y - 14,
    size: 9.5,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('Unit', {
    x: columns.unit,
    y: y - 14,
    size: 9.5,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('Rate', {
    x: columns.rate,
    y: y - 14,
    size: 9.5,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('Amount', {
    x: columns.amount,
    y: y - 14,
    size: 9.5,
    font: bold,
    color: rgb(1, 1, 1),
  });

  y -= 30;

  for (const item of data.lineItems) {
    const descLines = splitText(regular, item.description, 300, 9.5);
    const rowHeight = Math.max(22, descLines.length * 12 + 8);
    ensureSpace(rowHeight + 6);

    page.drawRectangle({
      x: LEFT_MARGIN,
      y: y - rowHeight + 4,
      width: CONTENT_WIDTH,
      height: rowHeight,
      borderColor: rgb(0.9, 0.92, 0.95),
      borderWidth: 1,
    });

    let textY = y - 10;
    descLines.forEach((line) => {
      page.drawText(line, {
        x: columns.desc,
        y: textY,
        size: 9.5,
        font: regular,
        color: rgb(0.2, 0.24, 0.29),
      });
      textY -= 12;
    });

    page.drawText(String(item.quantity), {
      x: columns.qty,
      y: y - 10,
      size: 9.5,
      font: regular,
      color: rgb(0.2, 0.24, 0.29),
    });

    page.drawText(item.unit || '—', {
      x: columns.unit,
      y: y - 10,
      size: 9.5,
      font: regular,
      color: rgb(0.2, 0.24, 0.29),
    });

    page.drawText(`$${formatCurrency(item.unit_price)}`, {
      x: columns.rate,
      y: y - 10,
      size: 9.5,
      font: regular,
      color: rgb(0.2, 0.24, 0.29),
    });

    const amountText = `$${formatCurrency(item.line_total)}`;
    page.drawText(amountText, {
      x: PAGE_WIDTH - RIGHT_MARGIN - regular.widthOfTextAtSize(amountText, 9.5),
      y: y - 10,
      size: 9.5,
      font: regular,
      color: rgb(0.2, 0.24, 0.29),
    });

    y -= rowHeight + 6;
  }

  ensureSpace(150);
  const totalsX = LEFT_MARGIN + 320;

  const drawTotalLine = (label: string, value: string, strong = false) => {
    const font = strong ? bold : regular;
    const size = strong ? 10.5 : 9.5;

    page.drawText(label, {
      x: totalsX,
      y,
      size,
      font,
      color: rgb(0.2, 0.24, 0.29),
    });

    page.drawText(value, {
      x: PAGE_WIDTH - RIGHT_MARGIN - font.widthOfTextAtSize(value, size),
      y,
      size,
      font,
      color: rgb(0.2, 0.24, 0.29),
    });

    y -= strong ? 18 : 14;
  };

  drawTotalLine('Subtotal', `$${formatCurrency(data.invoice.subtotal_amount)}`);
  if (data.invoice.discount_amount > 0) {
    drawTotalLine('Discount', `-$${formatCurrency(data.invoice.discount_amount)}`);
  }
  if (data.invoice.tax_amount > 0) {
    drawTotalLine('Tax', `$${formatCurrency(data.invoice.tax_amount)}`);
  }
  drawTotalLine('Total', `$${formatCurrency(data.invoice.total_amount)}`, true);
  drawTotalLine('Payments Received', `$${formatCurrency(data.paid)}`);
  drawTotalLine('Balance Due', `$${formatCurrency(data.outstanding)}`, true);
  y -= 6;

  const drawTextSection = (title: string, source: string | null | undefined) => {
    const text = String(source || '').trim();
    if (!text) return;

    const lines = splitText(regular, text, CONTENT_WIDTH, 9.5);
    ensureSpace(lines.length * 12 + 30);

    page.drawText(title, {
      x: LEFT_MARGIN,
      y,
      size: 11,
      font: bold,
      color: rgb(0.11, 0.23, 0.37),
    });
    y -= 16;

    lines.forEach((line) => {
      page.drawText(line, {
        x: LEFT_MARGIN,
        y,
        size: 9.5,
        font: regular,
        color: rgb(0.25, 0.29, 0.34),
      });
      y -= 12;
    });

    y -= 8;
  };

  drawTextSection('Customer Notes', data.invoice.public_notes);
  drawTextSection('Terms', data.invoice.terms_text);

  // Signature block
  const sigBoxHeight = 90;
  ensureSpace(sigBoxHeight + 16);

  page.drawRectangle({
    x: LEFT_MARGIN,
    y: y - sigBoxHeight + 8,
    width: CONTENT_WIDTH,
    height: sigBoxHeight,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.88, 0.9, 0.93),
    borderWidth: 1,
  });

  page.drawRectangle({
    x: LEFT_MARGIN,
    y: y - 18,
    width: CONTENT_WIDTH,
    height: 22,
    color: rgb(0.11, 0.23, 0.37),
  });

  page.drawText('Customer Acknowledgment', {
    x: LEFT_MARGIN + 10,
    y: y - 10,
    size: 9.5,
    font: bold,
    color: rgb(1, 1, 1),
  });

  const sigLineY = y - sigBoxHeight + 46;
  const dateLineY = y - sigBoxHeight + 20;
  const leftEnd = LEFT_MARGIN + 240;
  const rightStart = PAGE_WIDTH - RIGHT_MARGIN - 170;
  const rightEnd = PAGE_WIDTH - RIGHT_MARGIN - 12;

  if (data.signatureData) {
    const base64 = data.signatureData.replace(/^data:image\/png;base64,/, '');
    try {
      const imgBytes = Buffer.from(base64, 'base64');
      const embeddedSig = await pdfDoc.embedPng(imgBytes);
      page.drawImage(embeddedSig, {
        x: LEFT_MARGIN + 12,
        y: sigLineY - 6,
        width: leftEnd - LEFT_MARGIN - 12,
        height: 36,
      });
    } catch { /* ignore */ }

    if (data.signedAt) {
      const dateStr = new Date(data.signedAt).toLocaleDateString('en-US');
      page.drawText(dateStr, {
        x: rightStart,
        y: sigLineY + 18,
        size: 9.5,
        font: regular,
        color: rgb(0.11, 0.14, 0.18),
      });
    }

    if (data.signerName) {
      page.drawText(data.signerName, {
        x: LEFT_MARGIN + 12,
        y: dateLineY + 18,
        size: 9.5,
        font: regular,
        color: rgb(0.11, 0.14, 0.18),
      });
    }
  }

  page.drawLine({ start: { x: LEFT_MARGIN + 12, y: sigLineY + 14 }, end: { x: leftEnd, y: sigLineY + 14 }, thickness: 1, color: rgb(0.8, 0.84, 0.88) });
  page.drawLine({ start: { x: rightStart, y: sigLineY + 14 }, end: { x: rightEnd, y: sigLineY + 14 }, thickness: 1, color: rgb(0.8, 0.84, 0.88) });
  page.drawLine({ start: { x: LEFT_MARGIN + 12, y: dateLineY + 14 }, end: { x: leftEnd, y: dateLineY + 14 }, thickness: 1, color: rgb(0.8, 0.84, 0.88) });

  page.drawText('Customer Signature', { x: LEFT_MARGIN + 12, y: sigLineY, size: 9, font: regular, color: rgb(0.4, 0.45, 0.53) });
  page.drawText('Date', { x: rightStart, y: sigLineY, size: 9, font: regular, color: rgb(0.4, 0.45, 0.53) });
  page.drawText('Printed Name', { x: LEFT_MARGIN + 12, y: dateLineY, size: 9, font: regular, color: rgb(0.4, 0.45, 0.53) });

  y -= sigBoxHeight + 8;

  footer();
  return pdfDoc.save();
}