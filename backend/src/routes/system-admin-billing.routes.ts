import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { Invoice, ILineItem } from '../models/Invoice.model';
import { Organization } from '../models/Organization.model';
import { User } from '../models/User.model';
import { Message } from '../models/Message.model';
import { Notification } from '../models/Notification.model';
import { sendEmail, sendEmailWithAttachments, sendPaymentReminderEmail, sendSuspensionEmail } from '../services/email.service';
import { generateInvoicePdf } from '../services/invoicePdf.service';
import { config } from '../config/env';
import { Plan } from '../models/Plan.model';
import { calculateTax, getTaxRates, countryName, provinceName } from '../config/tax-rates';
import { AppSettings } from '../models/AppSettings.model';

const router = Router();

// All system-admin billing routes require authentication and system_admin role
router.use(authenticateToken, requireRole('system_admin'));

// ─── Fallback pricing (used when no Plan record exists in DB) ─────────────────

const FALLBACK_PLAN_PRICING: Record<string, number> = {
  starter: 29900,
  growth: 59900,
  professional: 99900,
  enterprise: 149900,
};

const FALLBACK_OVERAGE_CENTS = 1500;

// ─── Helper ───────────────────────────────────────────────────────────────────

function zeroPad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function recalcTotals(lineItems: ILineItem[], taxRate: number): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

// ─── GET /api/system-admin/billing/invoices ───────────────────────────────────
// List all invoices across all orgs, with optional ?orgId= and ?status= filters.

router.get(
  '/invoices',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // System-admin billing only manages org-subscription invoices.
      // Sponsor (coaching) invoices are scoped to a sponsor and live
      // under /api/sponsors/:id/billing — exclude them here.
      const filter: Record<string, unknown> = {
        $or: [{ sponsorId: { $exists: false } }, { sponsorId: null }],
      };

      if (req.query['orgId']) {
        filter['organizationId'] = new mongoose.Types.ObjectId(req.query['orgId'] as string);
      }
      if (req.query['status']) {
        filter['status'] = req.query['status'] as string;
      }

      const invoices = await Invoice.find(filter)
        .setOptions({ bypassTenantCheck: true })
        .populate('organizationId', 'name billingEmail')
        .sort({ createdAt: -1 })
        .lean();

      res.json(invoices);
    } catch (e) {
      next(e);
    }
  }
);

// ─── POST /api/system-admin/billing/invoices ──────────────────────────────────
// Generate an invoice for an org based on its plan and current user count.

router.post(
  '/invoices',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        organizationId,
        periodFrom,
        periodTo,
        taxRate = 0,
        taxExempt = false,
        notes,
        preview = false,
      } = req.body as {
        organizationId: string;
        periodFrom: string;
        periodTo: string;
        taxRate?: number;
        taxExempt?: boolean;
        notes?: string;
        preview?: boolean;
      };

      if (!organizationId || !periodFrom || !periodTo) {
        res.status(400).json({ error: req.t('errors.orgFieldsRequired') });
        return;
      }

      // Fetch org
      const org = await Organization.findById(organizationId);
      if (!org) {
        res.status(404).json({ error: req.t('errors.organizationNotFound') });
        return;
      }

      // Count active users in org
      const userCount = await User.countDocuments({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        isActive: true,
      }).setOptions({ bypassTenantCheck: true });

      // Build line items
      const lineItems: ILineItem[] = [];

      const planKey = org.plan as string;

      // Look up plan pricing from DB; fall back to hardcoded map
      const planRecord = await Plan.findOne({ key: planKey }).lean();
      const basePriceCents = planRecord?.priceMonthly ?? FALLBACK_PLAN_PRICING[planKey] ?? FALLBACK_PLAN_PRICING['starter']!;
      const overagePriceCents = planRecord?.overagePriceCents ?? FALLBACK_OVERAGE_CENTS;
      const planName = planRecord?.name ?? `${planKey.charAt(0).toUpperCase()}${planKey.slice(1)}`;

      lineItems.push({
        description: `${planName} plan — base subscription`,
        quantity: 1,
        unitPrice: basePriceCents,
        amount: basePriceCents,
      });

      const maxUsers = org.maxUsers ?? 0;
      if (userCount > maxUsers) {
        const extraUsers = userCount - maxUsers;
        const overagePerUser = overagePriceCents;
        const overageAmount = extraUsers * overagePerUser;
        const overageUnitFormatted = `$${(overagePerUser / 100).toFixed(0)}`;
        lineItems.push({
          description: `User overage — ${extraUsers} extra user${extraUsers === 1 ? '' : 's'} × ${overageUnitFormatted}/user/month`,
          quantity: extraUsers,
          unitPrice: overagePerUser,
          amount: overageAmount,
        });
      }

      // Generate invoice number: INV-{year}-{zero-padded sequence}
      const year = new Date(periodFrom).getFullYear();
      const existingCount = await Invoice.countDocuments({})
        .setOptions({ bypassTenantCheck: true });
      const invoiceNumber = `INV-${year}-${zeroPad(existingCount + 1, 4)}`;

      // dueDate = periodTo + 30 days
      const periodToDate = new Date(periodTo);
      const dueDate = new Date(periodToDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const billingAddress = org.billingAddress
        ? {
            line1:      org.billingAddress.line1,
            line2:      org.billingAddress.line2,
            city:       org.billingAddress.city,
            state:      org.billingAddress.state,
            postalCode: org.billingAddress.postalCode,
            country:    org.billingAddress.country,
          }
        : undefined;

      // Calculate tax — auto-detect from billing address for Canadian orgs,
      // or use manually supplied taxRate as fallback.
      // Tax-exempt overrides everything (e.g. Indigenous organizations).
      const lineSubtotal = lineItems.reduce((sum: number, item: ILineItem) => sum + item.amount, 0);
      let taxCalc;
      let taxRateDecimalFinal: number;

      const country = billingAddress?.country?.toUpperCase();
      const province = billingAddress?.state?.toUpperCase();

      if (taxExempt || org.taxExempt) {
        taxCalc = null;
        taxRateDecimalFinal = 0;
      } else if (country === 'CA') {
        // Automatic Canadian tax based on province
        taxCalc = calculateTax(lineSubtotal, country, province);
        taxRateDecimalFinal = taxCalc.rates.combined;
      } else if (taxRate > 0) {
        // Manual rate for non-Canadian (taxRate arrives as percentage)
        taxRateDecimalFinal = taxRate / 100;
        taxCalc = null;
      } else {
        taxRateDecimalFinal = 0;
        taxCalc = null;
      }

      const subtotal = lineSubtotal;
      const tax = taxCalc ? taxCalc.totalTax : Math.round(subtotal * taxRateDecimalFinal);
      const total = subtotal + tax;
      const taxBreakdown = taxCalc
        ? { gst: taxCalc.gst, hst: taxCalc.hst, pst: taxCalc.pst, qst: taxCalc.qst }
        : undefined;

      // Preview mode: return calculated data without persisting
      if (preview) {
        const taxInfo = country === 'CA' ? getTaxRates(country, province) : null;
        res.json({
          organizationId: { _id: org._id, name: org.name, billingEmail: org.billingEmail },
          invoiceNumber,
          period: { from: new Date(periodFrom), to: periodToDate },
          lineItems,
          subtotal,
          taxRate: taxRateDecimalFinal,
          taxBreakdown,
          taxLabel: taxInfo?.label,
          tax,
          total,
          currency: 'CAD',
          dueDate,
          billingAddress,
          taxId: org.taxId,
          notes,
          status: 'draft',
        });
        return;
      }

      const invoice = await Invoice.create({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        invoiceNumber,
        period: { from: new Date(periodFrom), to: periodToDate },
        lineItems,
        subtotal,
        taxRate: taxRateDecimalFinal,
        taxBreakdown,
        tax,
        total,
        currency: 'CAD',
        status: 'draft',
        dueDate,
        billingAddress,
        taxId: org.taxId,
        notes,
      });

      await invoice.populate('organizationId', 'name billingEmail');
      res.status(201).json(invoice);
    } catch (e) {
      next(e);
    }
  }
);

// ─── GET /api/system-admin/billing/invoices/:id ───────────────────────────────

router.get(
  '/invoices/:id',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await Invoice.findById(req.params['id'])
        .setOptions({ bypassTenantCheck: true })
        .populate('organizationId', 'name billingEmail plan maxUsers')
        .lean();

      if (!invoice) {
        res.status(404).json({ error: req.t('errors.invoiceNotFound') });
        return;
      }

      res.json(invoice);
    } catch (e) {
      next(e);
    }
  }
);

// ─── PUT /api/system-admin/billing/invoices/:id ───────────────────────────────
// Update invoice fields; recalculate subtotal/tax/total when lineItems change.

router.put(
  '/invoices/:id',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await Invoice.findById(req.params['id'])
        .setOptions({ bypassTenantCheck: true });

      if (!invoice) {
        res.status(404).json({ error: req.t('errors.invoiceNotFound') });
        return;
      }

      const { status, notes, dueDate, lineItems, taxRate } = req.body as {
        status?: string;
        notes?: string;
        dueDate?: string;
        lineItems?: ILineItem[];
        taxRate?: number;
      };

      if (status !== undefined) {
        invoice.status = status as typeof invoice.status;
      }
      if (notes !== undefined) {
        invoice.notes = notes;
      }
      if (dueDate !== undefined) {
        invoice.dueDate = new Date(dueDate);
      }

      // taxRate arrives as a percentage — convert to decimal
      const taxRateDecimal = taxRate !== undefined ? taxRate / 100 : undefined;

      // Resolve effective lineItems and taxRate before recalculating
      const effectiveLineItems: ILineItem[] = lineItems !== undefined ? lineItems : invoice.lineItems;
      const effectiveTaxRate: number = taxRateDecimal !== undefined ? taxRateDecimal : invoice.taxRate;

      if (lineItems !== undefined) {
        invoice.lineItems = lineItems;
      }
      if (taxRateDecimal !== undefined) {
        invoice.taxRate = taxRateDecimal;
      }

      // Always recalculate when either lineItems or taxRate changed
      if (lineItems !== undefined || taxRate !== undefined) {
        const { subtotal, tax, total } = recalcTotals(effectiveLineItems, effectiveTaxRate);
        invoice.subtotal = subtotal;
        invoice.tax = tax;
        invoice.total = total;
      }

      await invoice.save();
      res.json(invoice);
    } catch (e) {
      next(e);
    }
  }
);

// ─── POST /api/system-admin/billing/invoices/:id/send ────────────────────────
// Mark invoice as sent and email org's billingEmail.

router.post(
  '/invoices/:id/send',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await Invoice.findById(req.params['id'])
        .setOptions({ bypassTenantCheck: true });

      if (!invoice) {
        res.status(404).json({ error: req.t('errors.invoiceNotFound') });
        return;
      }

      const org = await Organization.findById(invoice.organizationId);
      if (!org) {
        res.status(404).json({ error: req.t('errors.orgNotFoundForInvoice') });
        return;
      }

      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await invoice.save();

      // Format amounts for email (cents → currency)
      const fmt = (cents: number): string =>
        `$${(cents / 100).toFixed(2)} CAD`;

      // ── Hub: message + notification for every org admin ──────────────────────
      const orgAdmins = await User.find({
        organizationId: invoice.organizationId,
        role: 'admin',
        isActive: true,
      }).setOptions({ bypassTenantCheck: true });

      if (orgAdmins.length > 0) {
        const systemAdminId = new mongoose.Types.ObjectId(req.user!.userId);
        const orgOid = new mongoose.Types.ObjectId(invoice.organizationId.toString());
        const dueDateStr2 = invoice.dueDate.toLocaleDateString(req.language || 'en', {
          year: 'numeric', month: 'long', day: 'numeric',
        });

        await Promise.all(orgAdmins.flatMap((admin) => [
          Message.create({
            organizationId: orgOid,
            fromUserId: systemAdminId,
            toUserId: admin._id,
            content: `Invoice ${invoice.invoiceNumber} has been issued for ${org.name} — ${fmt(invoice.total)} due ${dueDateStr2}. Visit your Billing page to review and pay: ${config.frontendUrl}/billing`,
          }),

          Notification.create({
            organizationId: orgOid,
            userId: admin._id,
            type: 'system',
            title: `Invoice ${invoice.invoiceNumber} — ${fmt(invoice.total)} due`,
            body: `A new invoice has been issued. Amount: ${fmt(invoice.total)}, due ${dueDateStr2}.`,
            link: '/billing',
          }),
        ]));
      }

      const lineItemRows = invoice.lineItems
        .map(
          (item) =>
            `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e8eef4;color:#5a6a7e;">${item.description}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e8eef4;color:#5a6a7e;text-align:center;">${item.quantity}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e8eef4;color:#5a6a7e;text-align:right;">${fmt(item.unitPrice)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e8eef4;color:#1B2A47;font-weight:600;text-align:right;">${fmt(item.amount)}</td>
            </tr>`
        )
        .join('');

      const periodFrom = invoice.period.from.toLocaleDateString(req.language || 'en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const periodTo = invoice.period.to.toLocaleDateString(req.language || 'en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const dueDateStr = invoice.dueDate.toLocaleDateString(req.language || 'en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const billingUrl = `${config.frontendUrl}/billing`;

      // Load company address from platform settings
      const appSettings = await AppSettings.findOne().setOptions({ bypassTenantCheck: true }).lean();
      const ci = appSettings?.companyInfo;
      const fromLines: string[] = [];
      if (ci?.name) fromLines.push(`<strong>${ci.name}</strong>`);
      if (ci?.line1) fromLines.push(ci.line1);
      if (ci?.line2) fromLines.push(ci.line2);
      const fromCity = [ci?.city, provinceName(ci?.state), ci?.postalCode].filter(Boolean).join(', ');
      if (fromCity) fromLines.push(fromCity);
      if (ci?.country) fromLines.push(countryName(ci.country));
      if (ci?.taxId) fromLines.push(`Tax ID: ${ci.taxId}`);
      if (ci?.phone) fromLines.push(ci.phone);
      if (ci?.email) fromLines.push(ci.email);
      const fromHtml = fromLines.length
        ? `<div style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;font-size:13px;"><strong>From:</strong><br>${fromLines.join('<br>')}</div>`
        : '';

      // Build billing address block for email
      const addr = invoice.billingAddress;
      const addrLines: string[] = [];
      if (addr?.line1) addrLines.push(addr.line1);
      if (addr?.line2) addrLines.push(addr.line2);
      if (addr?.city || addr?.postalCode) addrLines.push([addr.postalCode, addr.city].filter(Boolean).join(' '));
      if (addr?.state) addrLines.push(provinceName(addr.state));
      if (addr?.country) addrLines.push(countryName(addr.country));
      const addrHtml = addrLines.length
        ? `<p style="color:#5a6a7e;margin:0 0 4px;line-height:1.6;">${addrLines.join('<br>')}</p>`
        : '';
      const taxIdHtml = invoice.taxId
        ? `<p style="color:#5a6a7e;margin:0 0 4px;line-height:1.6;"><strong>Tax ID:</strong> ${invoice.taxId}</p>`
        : '';

      const emailHtml = `
        <h2 style="color:#1B2A47;margin:0 0 8px;font-size:22px;">
          Invoice ${invoice.invoiceNumber}
        </h2>
        ${fromHtml}
        <p style="color:#5a6a7e;margin:0 0 4px;line-height:1.6;">
          <strong>Bill to:</strong> ${org.name}
        </p>
        ${addrHtml}
        ${taxIdHtml}
        <p style="color:#5a6a7e;margin:0 0 4px;line-height:1.6;">
          <strong>Billing period:</strong> ${periodFrom} – ${periodTo}
        </p>
        <p style="color:#5a6a7e;margin:0 0 24px;line-height:1.6;">
          <strong>Due date:</strong> ${dueDateStr}
        </p>

        <table width="100%" cellpadding="0" cellspacing="0"
               style="border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr style="background:#f0f4f8;">
              <th style="padding:10px 12px;text-align:left;color:#1B2A47;font-size:13px;">Description</th>
              <th style="padding:10px 12px;text-align:center;color:#1B2A47;font-size:13px;">Qty</th>
              <th style="padding:10px 12px;text-align:right;color:#1B2A47;font-size:13px;">Unit price</th>
              <th style="padding:10px 12px;text-align:right;color:#1B2A47;font-size:13px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemRows}
          </tbody>
        </table>

        <table cellpadding="0" cellspacing="0" style="margin-left:auto;">
          <tr>
            <td style="padding:4px 12px;color:#5a6a7e;text-align:right;">Subtotal</td>
            <td style="padding:4px 12px;color:#1B2A47;font-weight:600;text-align:right;">${fmt(invoice.subtotal)}</td>
          </tr>
          ${invoice.taxBreakdown?.gst
            ? `<tr>
                <td style="padding:4px 12px;color:#5a6a7e;text-align:right;">GST (5%)</td>
                <td style="padding:4px 12px;color:#1B2A47;font-weight:600;text-align:right;">${fmt(invoice.taxBreakdown.gst)}</td>
              </tr>`
            : ''}
          ${invoice.taxBreakdown?.hst
            ? `<tr>
                <td style="padding:4px 12px;color:#5a6a7e;text-align:right;">HST (${(invoice.taxRate * 100).toFixed(0)}%)</td>
                <td style="padding:4px 12px;color:#1B2A47;font-weight:600;text-align:right;">${fmt(invoice.taxBreakdown.hst)}</td>
              </tr>`
            : ''}
          ${invoice.taxBreakdown?.pst
            ? `<tr>
                <td style="padding:4px 12px;color:#5a6a7e;text-align:right;">PST</td>
                <td style="padding:4px 12px;color:#1B2A47;font-weight:600;text-align:right;">${fmt(invoice.taxBreakdown.pst)}</td>
              </tr>`
            : ''}
          ${invoice.taxBreakdown?.qst
            ? `<tr>
                <td style="padding:4px 12px;color:#5a6a7e;text-align:right;">QST (9.975%)</td>
                <td style="padding:4px 12px;color:#1B2A47;font-weight:600;text-align:right;">${fmt(invoice.taxBreakdown.qst)}</td>
              </tr>`
            : ''}
          ${invoice.tax > 0 && !invoice.taxBreakdown
            ? `<tr>
                <td style="padding:4px 12px;color:#5a6a7e;text-align:right;">Tax (${(invoice.taxRate * 100).toFixed(1).replace(/\.0$/, '')}%)</td>
                <td style="padding:4px 12px;color:#1B2A47;font-weight:600;text-align:right;">${fmt(invoice.tax)}</td>
              </tr>`
            : ''}
          <tr style="border-top:2px solid #1B2A47;">
            <td style="padding:8px 12px;color:#1B2A47;font-weight:700;font-size:16px;text-align:right;">Total</td>
            <td style="padding:8px 12px;color:#1B2A47;font-weight:700;font-size:16px;text-align:right;">${fmt(invoice.total)}</td>
          </tr>
        </table>

        ${invoice.notes
          ? `<p style="color:#5a6a7e;margin:24px 0 0;font-size:13px;font-style:italic;">${invoice.notes}</p>`
          : ''}

        <a href="${billingUrl}"
           style="display:inline-block;margin-top:28px;background:#3A9FD6;color:#ffffff;
                  padding:14px 28px;border-radius:6px;text-decoration:none;
                  font-weight:600;font-size:15px;">
          Pay Invoice
        </a>
        <p style="color:#9aa5b4;margin:20px 0 0;font-size:12px;">
          Please pay by ${dueDateStr} to avoid service interruption.
        </p>
      `;

      const pdfBuffer = await generateInvoicePdf(invoice, {
        name: org.name,
        email: org.billingEmail,
        address: invoice.billingAddress,
        taxId: invoice.taxId,
      }, ci as any);

      await sendEmailWithAttachments({
        to: org.billingEmail,
        subject: `Invoice ${invoice.invoiceNumber} from ${ci?.name || 'ARTES'} — ${fmt(invoice.total)} due ${dueDateStr}`,
        html: emailHtml,
        attachments: [{
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }],
      });

      res.json(invoice);
    } catch (e) {
      next(e);
    }
  }
);

// ─── DELETE /api/system-admin/billing/invoices/:id ───────────────────────────
// Void an invoice (soft delete — sets status to 'void').

router.delete(
  '/invoices/:id',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await Invoice.findById(req.params['id'])
        .setOptions({ bypassTenantCheck: true });

      if (!invoice) {
        res.status(404).json({ error: req.t('errors.invoiceNotFound') });
        return;
      }

      if (invoice.status === 'paid') {
        res.status(400).json({ error: req.t('errors.cannotVoidPaidInvoice') });
        return;
      }

      invoice.status = 'void';
      await invoice.save();

      res.json({ message: 'Invoice voided', invoice });
    } catch (e) {
      next(e);
    }
  }
);

// ─── POST /api/system-admin/billing/invoices/:id/remind ──────────────────────
// Send a payment reminder email for a specific invoice.

router.post(
  '/invoices/:id/remind',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await Invoice.findById(req.params['id'])
        .setOptions({ bypassTenantCheck: true });

      if (!invoice) {
        res.status(404).json({ error: req.t('errors.invoiceNotFound') });
        return;
      }

      if (invoice.status !== 'sent' && invoice.status !== 'overdue') {
        res.status(400).json({ error: req.t('errors.canOnlyRemindSentOverdue') });
        return;
      }

      const org = await Organization.findById(invoice.organizationId);
      if (!org) {
        res.status(404).json({ error: req.t('errors.organizationNotFound') });
        return;
      }

      const fmt = (cents: number): string => `$${(cents / 100).toFixed(2)} CAD`;
      const now = new Date();
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const isOverdue = now > invoice.dueDate;

      await sendPaymentReminderEmail({
        email: org.billingEmail,
        orgName: org.name,
        invoiceNumber: invoice.invoiceNumber,
        totalFormatted: fmt(invoice.total),
        dueDateFormatted: invoice.dueDate.toLocaleDateString(req.language || 'en', {
          year: 'numeric', month: 'long', day: 'numeric',
        }),
        daysOverdue,
        isOverdue,
      });

      invoice.reminderSentAt = now;
      invoice.reminderCount = (invoice.reminderCount ?? 0) + 1;
      await invoice.save();

      res.json({ message: 'Reminder sent', reminderCount: invoice.reminderCount });
    } catch (e) {
      next(e);
    }
  }
);

// ─── POST /api/system-admin/billing/mark-overdue ─────────────────────────────
// Scan all sent invoices past their due date and mark them as overdue.
// Optionally sends reminders. Call this periodically (e.g. daily cron).

router.post(
  '/mark-overdue',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sendReminders = false } = req.body as { sendReminders?: boolean };
      const now = new Date();

      // Find sent (subscription) invoices past due — exclude sponsor invoices
      const overdueInvoices = await Invoice.find({
        status: 'sent',
        dueDate: { $lt: now },
        $or: [{ sponsorId: { $exists: false } }, { sponsorId: null }],
      }).setOptions({ bypassTenantCheck: true });

      const results: { invoiceNumber: string; orgId: string; daysOverdue: number; reminderSent: boolean }[] = [];

      for (const invoice of overdueInvoices) {
        invoice.status = 'overdue';
        await invoice.save();

        const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        let reminderSent = false;
        if (sendReminders) {
          const org = await Organization.findById(invoice.organizationId);
          if (org) {
            const fmt = (cents: number): string => `$${(cents / 100).toFixed(2)} CAD`;
            await sendPaymentReminderEmail({
              email: org.billingEmail,
              orgName: org.name,
              invoiceNumber: invoice.invoiceNumber,
              totalFormatted: fmt(invoice.total),
              dueDateFormatted: invoice.dueDate.toLocaleDateString(req.language || 'en', {
                year: 'numeric', month: 'long', day: 'numeric',
              }),
              daysOverdue,
              isOverdue: true,
            });
            invoice.reminderSentAt = now;
            invoice.reminderCount = (invoice.reminderCount ?? 0) + 1;
            await invoice.save();
            reminderSent = true;
          }
        }

        results.push({
          invoiceNumber: invoice.invoiceNumber,
          orgId: invoice.organizationId.toString(),
          daysOverdue,
          reminderSent,
        });
      }

      res.json({
        message: `${results.length} invoice(s) marked overdue`,
        invoices: results,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ─── POST /api/system-admin/billing/suspend-overdue ──────────────────────────
// Suspend organizations with invoices overdue beyond a threshold (default: 30 days).

router.post(
  '/suspend-overdue',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { daysThreshold = 30, dryRun = false } = req.body as {
        daysThreshold?: number;
        dryRun?: boolean;
      };

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysThreshold);

      // Find overdue (subscription) invoices past the threshold — exclude sponsor
      const overdueInvoices = await Invoice.find({
        status: 'overdue',
        dueDate: { $lt: cutoff },
        $or: [{ sponsorId: { $exists: false } }, { sponsorId: null }],
      }).setOptions({ bypassTenantCheck: true });

      // Group by org — only suspend once per org
      const orgIds = [...new Set(overdueInvoices.map((i) => i.organizationId.toString()))];

      const results: { orgId: string; orgName: string; invoiceNumber: string; daysOverdue: number; suspended: boolean }[] = [];

      for (const orgId of orgIds) {
        const org = await Organization.findById(orgId);
        if (!org || !org.isActive) continue;

        const orgInvoices = overdueInvoices.filter((i) => i.organizationId.toString() === orgId);
        const oldestOverdue = orgInvoices.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0]!;
        const daysOverdue = Math.floor((Date.now() - oldestOverdue.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (!dryRun) {
          org.isActive = false;
          org.suspendedAt = new Date();
          org.suspensionReason = `Invoice ${oldestOverdue.invoiceNumber} overdue by ${daysOverdue} days`;
          await org.save();

          const fmt = (cents: number): string => `$${(cents / 100).toFixed(2)} CAD`;
          await sendSuspensionEmail({
            email: org.billingEmail,
            orgName: org.name,
            reason: `Outstanding invoice ${oldestOverdue.invoiceNumber} (${fmt(oldestOverdue.total)}) is ${daysOverdue} days overdue.`,
            invoiceNumber: oldestOverdue.invoiceNumber,
          });

          // Notify org admins
          const admins = await User.find({
            organizationId: org._id,
            role: 'admin',
            isActive: true,
          }).setOptions({ bypassTenantCheck: true });

          const systemAdminId = new mongoose.Types.ObjectId(req.user!.userId);
          await Promise.all(admins.map((admin) =>
            Notification.create({
              organizationId: org._id,
              userId: admin._id,
              type: 'system',
              title: 'Account Suspended — Payment Required',
              body: `Your account has been suspended due to an overdue invoice (${oldestOverdue.invoiceNumber}). Please pay immediately to restore access.`,
              link: '/billing',
            })
          ));
        }

        results.push({
          orgId,
          orgName: org.name,
          invoiceNumber: oldestOverdue.invoiceNumber,
          daysOverdue,
          suspended: !dryRun,
        });
      }

      res.json({
        message: dryRun
          ? `${results.length} organization(s) would be suspended (dry run)`
          : `${results.length} organization(s) suspended`,
        threshold: `${daysThreshold} days`,
        organizations: results,
      });
    } catch (e) {
      next(e);
    }
  }
);

// ─── POST /api/system-admin/billing/reactivate/:orgId ────────────────────────
// Reactivate a suspended organization after payment is resolved.

router.post(
  '/reactivate/:orgId',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const org = await Organization.findById(req.params['orgId']);
      if (!org) {
        res.status(404).json({ error: req.t('errors.organizationNotFound') });
        return;
      }

      if (org.isActive) {
        res.status(400).json({ error: req.t('errors.orgAlreadyActive') });
        return;
      }

      org.isActive = true;
      org.suspendedAt = undefined;
      org.suspensionReason = undefined;
      await org.save();

      // Notify org admins
      const admins = await User.find({
        organizationId: org._id,
        role: 'admin',
        isActive: true,
      }).setOptions({ bypassTenantCheck: true });

      await Promise.all(admins.map((admin) =>
        Notification.create({
          organizationId: org._id,
          userId: admin._id,
          type: 'system',
          title: 'Account Reactivated',
          body: 'Your account has been reactivated. Full platform access has been restored.',
          link: '/dashboard',
        })
      ));

      res.json({ message: 'Organization reactivated', orgId: org._id, name: org.name });
    } catch (e) {
      next(e);
    }
  }
);

// ─── GET /api/system-admin/billing/tax-rates ─────────────────────────────────
// Return Canadian tax rate info for a given province. Used by UI for preview.

router.get(
  '/tax-rates',
  async (req: AuthRequest, res: Response): Promise<void> => {
    const country = (req.query['country'] as string) || 'CA';
    const province = (req.query['province'] as string) || '';
    const rates = getTaxRates(country, province);
    res.json(rates);
  }
);

export default router;
