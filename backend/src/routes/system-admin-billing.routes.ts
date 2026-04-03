import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { Invoice, ILineItem } from '../models/Invoice.model';
import { Organization } from '../models/Organization.model';
import { User } from '../models/User.model';
import { Message } from '../models/Message.model';
import { Notification } from '../models/Notification.model';
import { sendEmail } from '../services/email.service';
import { config } from '../config/env';
import { Plan } from '../models/Plan.model';

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
      const filter: Record<string, unknown> = {};

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
        notes,
        preview = false,
      } = req.body as {
        organizationId: string;
        periodFrom: string;
        periodTo: string;
        taxRate?: number;
        notes?: string;
        preview?: boolean;
      };

      // taxRate arrives as a percentage (e.g. 21 = 21%) — convert to decimal
      const taxRateDecimal = taxRate / 100;

      if (!organizationId || !periodFrom || !periodTo) {
        res.status(400).json({ error: 'organizationId, periodFrom and periodTo are required' });
        return;
      }

      // Fetch org
      const org = await Organization.findById(organizationId);
      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
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

      const { subtotal, tax, total } = recalcTotals(lineItems, taxRateDecimal);

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

      // Preview mode: return calculated data without persisting
      if (preview) {
        res.json({
          invoiceNumber,
          period: { from: new Date(periodFrom), to: periodToDate },
          lineItems,
          subtotal,
          taxRate: taxRateDecimal,
          tax,
          total,
          currency: 'USD',
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
        taxRate: taxRateDecimal,
        tax,
        total,
        currency: 'USD',
        status: 'draft',
        dueDate,
        billingAddress,
        taxId: org.taxId,
        notes,
      });

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
        res.status(404).json({ error: 'Invoice not found' });
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
        res.status(404).json({ error: 'Invoice not found' });
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
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const org = await Organization.findById(invoice.organizationId);
      if (!org) {
        res.status(404).json({ error: 'Organization not found for this invoice' });
        return;
      }

      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await invoice.save();

      // Format amounts for email (cents → dollars)
      const fmt = (cents: number): string =>
        `$${(cents / 100).toFixed(2)} ${invoice.currency}`;

      // ── Hub: message + notification for every org admin ──────────────────────
      const orgAdmins = await User.find({
        organizationId: invoice.organizationId,
        role: 'admin',
        isActive: true,
      }).setOptions({ bypassTenantCheck: true });

      if (orgAdmins.length > 0) {
        const systemAdminId = new mongoose.Types.ObjectId(req.user!.userId);
        const orgOid = new mongoose.Types.ObjectId(invoice.organizationId.toString());
        const dueDateStr2 = invoice.dueDate.toLocaleDateString('en-US', {
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

      const periodFrom = invoice.period.from.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const periodTo = invoice.period.to.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const dueDateStr = invoice.dueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const billingUrl = `${config.frontendUrl}/billing`;

      // Build billing address block for email
      const addr = invoice.billingAddress;
      const addrLines: string[] = [];
      if (addr?.line1) addrLines.push(addr.line1);
      if (addr?.line2) addrLines.push(addr.line2);
      if (addr?.city || addr?.postalCode) addrLines.push([addr.postalCode, addr.city].filter(Boolean).join(' '));
      if (addr?.state) addrLines.push(addr.state);
      if (addr?.country) addrLines.push(addr.country);
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
        <p style="color:#5a6a7e;margin:0 0 4px;line-height:1.6;">
          <strong>Organization:</strong> ${org.name}
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
          ${invoice.tax > 0
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

      await sendEmail({
        to: org.billingEmail,
        subject: `Invoice ${invoice.invoiceNumber} from People Intelligence Platform — ${fmt(invoice.total)} due ${dueDateStr}`,
        html: emailHtml,
        text: `Invoice ${invoice.invoiceNumber}\n\nOrganization: ${org.name}\nPeriod: ${periodFrom} – ${periodTo}\nDue: ${dueDateStr}\nTotal: ${fmt(invoice.total)}\n\nPay at: ${billingUrl}`,
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
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      if (invoice.status === 'paid') {
        res.status(400).json({ error: 'Cannot void a paid invoice' });
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

export default router;
