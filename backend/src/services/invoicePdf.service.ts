import PDFDocument from 'pdfkit';
import { IInvoice, ILineItem } from '../models/Invoice.model';
import { ICompanyInfo } from '../models/AppSettings.model';
import { countryName, provinceName } from '../config/tax-rates';

export interface InvoiceBillTo {
  name: string;
  organization?: string;
  email?: string;
  address?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string };
  taxId?: string;
}

const C = { navy: '#1B2A47', blue: '#3A9FD6', grey: '#5a6a7e', line: '#d0d7e0', lightBg: '#f7f9fc' };
const L = 50;
const R = 545;
const W = R - L;

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function generateInvoicePdf(
  invoice: IInvoice,
  billTo: InvoiceBillTo,
  companyInfo?: ICompanyInfo,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 60, left: L, right: 50 },
      info: { Author: 'Helena Coaching', Creator: 'ARTES', Title: `Invoice ${invoice.invoiceNumber}` },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ────────────────────────────────────────────────────────────────
    const companyName = companyInfo?.name || 'ARTES';
    doc.rect(0, 0, 595, 70).fill(C.navy);
    doc.fill('#fff').font('Helvetica-Bold').fontSize(20)
      .text(companyName, L, 20, { width: W });
    doc.font('Helvetica').fontSize(9)
      .text('Helena Coaching × HeadSoft Tech', L, 44, { width: W });
    doc.fillColor(C.navy);
    doc.y = 90;

    // ── Invoice title + metadata ──────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(16)
      .text(`Invoice ${invoice.invoiceNumber}`, L, doc.y);
    doc.moveDown(0.6);

    // ── From (company) address ────────────────────────────────────────────────
    if (companyInfo && (companyInfo.line1 || companyInfo.city)) {
      doc.font('Helvetica').fontSize(8).fillColor(C.grey);
      doc.text('From:', L, doc.y);
      doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(9);
      doc.text(companyName);
      doc.font('Helvetica').fontSize(8).fillColor(C.grey);
      if (companyInfo.line1) doc.text(companyInfo.line1);
      if (companyInfo.line2) doc.text(companyInfo.line2);
      const fromCity = [companyInfo.city, provinceName(companyInfo.state), companyInfo.postalCode].filter(Boolean).join(', ');
      if (fromCity) doc.text(fromCity);
      if (companyInfo.country) doc.text(countryName(companyInfo.country));
      if (companyInfo.taxId) doc.text(`Tax ID: ${companyInfo.taxId}`);
      if (companyInfo.phone) doc.text(companyInfo.phone);
      if (companyInfo.email) doc.text(companyInfo.email);
      doc.moveDown(0.8);
    }

    const metaY = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(C.grey);
    doc.text('Bill to:', L, metaY);
    doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(10);
    doc.text(billTo.name, L, metaY + 14);
    doc.font('Helvetica').fontSize(9).fillColor(C.grey);
    if (billTo.organization) doc.text(billTo.organization);
    if (billTo.email) doc.text(billTo.email);
    const addr = billTo.address;
    if (addr) {
      if (addr.line1) doc.text(addr.line1);
      if (addr.line2) doc.text(addr.line2);
      const cityLine = [addr.city, provinceName(addr.state), addr.postalCode].filter(Boolean).join(', ');
      if (cityLine) doc.text(cityLine);
      if (addr.country) doc.text(countryName(addr.country));
    }
    if (billTo.taxId) doc.text(`Tax ID: ${billTo.taxId}`);

    // Right-side metadata
    const rightX = 380;
    doc.fontSize(9).fillColor(C.grey);
    doc.text('Date:', rightX, metaY, { continued: true }).fillColor(C.navy)
      .text(`  ${invoice.createdAt.toLocaleDateString('en-CA')}`);
    doc.fillColor(C.grey)
      .text('Due:', rightX, metaY + 14, { continued: true }).fillColor(C.navy)
      .text(`  ${invoice.dueDate.toLocaleDateString('en-CA')}`);
    doc.fillColor(C.grey)
      .text('Currency:', rightX, metaY + 28, { continued: true }).fillColor(C.navy)
      .text(`  ${invoice.currency || 'CAD'}`);
    doc.fillColor(C.grey)
      .text('Status:', rightX, metaY + 42, { continued: true }).fillColor(C.navy)
      .text(`  ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`);

    doc.y = Math.max(doc.y, metaY + 70);
    doc.moveDown(1);

    // ── Line items table ──────────────────────────────────────────────────────
    const tableTop = doc.y;
    const colDesc = L;
    const colQty = 340;
    const colUnit = 410;
    const colAmt = 490;

    // Header row
    doc.rect(L, tableTop, W, 22).fill(C.lightBg);
    doc.fillColor(C.grey).font('Helvetica-Bold').fontSize(8);
    doc.text('DESCRIPTION', colDesc + 8, tableTop + 7);
    doc.text('QTY', colQty, tableTop + 7, { width: 50, align: 'center' });
    doc.text('UNIT PRICE', colUnit, tableTop + 7, { width: 70, align: 'right' });
    doc.text('AMOUNT', colAmt, tableTop + 7, { width: 55, align: 'right' });

    let rowY = tableTop + 24;
    doc.font('Helvetica').fontSize(9).fillColor(C.navy);

    for (const li of invoice.lineItems as ILineItem[]) {
      if (rowY > 720) { doc.addPage(); rowY = 50; }

      doc.text(li.description, colDesc + 8, rowY, { width: colQty - colDesc - 16 });
      const textH = doc.heightOfString(li.description, { width: colQty - colDesc - 16 });
      const cellH = Math.max(textH, 14);

      doc.text(String(li.quantity), colQty, rowY, { width: 50, align: 'center' });
      doc.text(fmt(li.unitPrice), colUnit, rowY, { width: 70, align: 'right' });
      doc.font('Helvetica-Bold').text(fmt(li.amount), colAmt, rowY, { width: 55, align: 'right' });
      doc.font('Helvetica');

      rowY += cellH + 8;
      doc.moveTo(L, rowY - 4).lineTo(R, rowY - 4).strokeColor(C.line).lineWidth(0.5).stroke();
    }

    // ── Totals ────────────────────────────────────────────────────────────────
    rowY += 6;
    const totLabelX = 380;
    const totValX = 490;
    const totW = 55;

    const addTotalRow = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      doc.fillColor(bold ? C.navy : C.grey).text(label, totLabelX, rowY, { width: totValX - totLabelX - 8, align: 'right' });
      doc.fillColor(C.navy).text(value, totValX, rowY, { width: totW, align: 'right' });
      rowY += 16;
    };

    addTotalRow('Subtotal', fmt(invoice.subtotal));

    // Tax breakdown — show individual lines when available
    const tb = invoice.taxBreakdown;
    if (tb) {
      if (tb.gst) addTotalRow('GST (5%)', fmt(tb.gst));
      if (tb.hst) {
        const hstPct = (invoice.taxRate * 100).toFixed(0);
        addTotalRow(`HST (${hstPct}%)`, fmt(tb.hst));
      }
      if (tb.pst) addTotalRow('PST', fmt(tb.pst));
      if (tb.qst) addTotalRow('QST (9.975%)', fmt(tb.qst));
    } else if (invoice.tax > 0) {
      const pct = (invoice.taxRate * 100).toFixed(1).replace(/\.0$/, '');
      addTotalRow(`Tax (${pct}%)`, fmt(invoice.tax));
    }

    // Divider before total
    doc.moveTo(totLabelX, rowY - 4).lineTo(R, rowY - 4)
      .strokeColor(C.navy).lineWidth(1.5).stroke();
    rowY += 2;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.fillColor(C.navy).text('Total due', totLabelX, rowY, { width: totValX - totLabelX - 8, align: 'right' });
    doc.text(fmt(invoice.total), totValX, rowY, { width: totW, align: 'right' });

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (invoice.notes) {
      rowY += 30;
      if (rowY > 720) { doc.addPage(); rowY = 50; }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.grey).text('Notes', L, rowY);
      rowY += 14;
      doc.font('Helvetica').fontSize(9).fillColor(C.navy).text(invoice.notes, L, rowY, { width: W });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(7).fillColor(C.grey)
      .text(
        'Generated by ARTES — Helena Coaching × HeadSoft Tech',
        L, 800, { width: W, align: 'center' },
      );

    doc.end();
  });
}
