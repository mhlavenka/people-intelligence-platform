import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { Sponsor } from '../models/Sponsor.model';
import { CoachingEngagement } from '../models/CoachingEngagement.model';
import { CoachingSession } from '../models/CoachingSession.model';
import { User } from '../models/User.model';
import { Invoice, ILineItem } from '../models/Invoice.model';
import {
  calculateTax,
  getTaxRates,
  CANADIAN_PROVINCES,
} from '../config/tax-rates';

const router = Router();
router.use(authenticateToken, tenantResolver);

/**
 * Visibility:
 *   admin / hr_manager -> every sponsor in the org
 *   coach              -> only sponsors attached to engagements they own
 *   coachee            -> not allowed (no menu either)
 */
async function sponsorIdsForCoach(coachId: string, orgId: string): Promise<mongoose.Types.ObjectId[]> {
  const engagements = await CoachingEngagement.find({
    coachId,
    organizationId: orgId,
    sponsorId: { $ne: null },
  }).select('sponsorId').lean();
  return engagements.map((e) => e.sponsorId).filter(Boolean) as mongoose.Types.ObjectId[];
}

// ─── Tax-rates lookup (UI dropdown) ─────────────────────────────────────────
// MUST be declared BEFORE GET /:id otherwise Express matches "tax-rates"
// against the :id parameter and never reaches this handler.
router.get(
  '/tax-rates',
  requirePermission('MANAGE_SPONSORS'),
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const provinces = CANADIAN_PROVINCES.map((p) => ({
        ...p, ...getTaxRates('CA', p.code),
      }));
      res.json({ provinces });
    } catch (e) { next(e); }
  },
);

// ─── List ───────────────────────────────────────────────────────────────────
// Sponsors are an organization-wide resource: every coach/admin/HR sees
// every sponsor in their org.
router.get(
  '/',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const sponsors = await Sponsor.find({ organizationId: orgId })
        .populate('coacheeId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .lean();

      const counts = await CoachingEngagement.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(orgId),
            sponsorId: { $in: sponsors.map((s) => s._id) },
          },
        },
        {
          $group: {
            _id: '$sponsorId',
            totalEngagements: { $sum: 1 },
            activeEngagements: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
          },
        },
      ]);
      const countsBySponsor = new Map(counts.map((c) => [c._id.toString(), c]));

      res.json(sponsors.map((s) => {
        const c = countsBySponsor.get(s._id.toString());
        return {
          ...s,
          totalEngagements: c?.totalEngagements || 0,
          activeEngagements: c?.activeEngagements || 0,
        };
      }));
    } catch (e) { next(e); }
  },
);

// ─── Get one ────────────────────────────────────────────────────────────────
router.get(
  '/:id',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const sponsor = await Sponsor.findOne({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      }).populate('coacheeId', 'firstName lastName email');
      if (!sponsor) { res.status(404).json({ error: req.t('errors.sponsorNotFound') }); return; }
      res.json(sponsor);
    } catch (e) { next(e); }
  },
);

// ─── Create ─────────────────────────────────────────────────────────────────
router.post(
  '/',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, email, organization, phone, billingAddress, defaultHourlyRate, notes, coacheeId } = req.body;
      if (!name || !email) {
        res.status(400).json({ error: req.t('errors.nameAndEmailRequired') });
        return;
      }
      try {
        const sponsor = await Sponsor.create({
          organizationId: req.user!.organizationId,
          name, email, organization, phone, billingAddress,
          defaultHourlyRate, notes, coacheeId: coacheeId || null,
          isActive: true,
        });
        res.status(201).json(sponsor);
      } catch (err) {
        if ((err as { code?: number })?.code === 11000) {
          res.status(409).json({ error: req.t('errors.sponsorEmailExists') });
          return;
        }
        throw err;
      }
    } catch (e) { next(e); }
  },
);

// Self-pay shortcut: create a Sponsor record for an existing coachee user.
router.post(
  '/from-coachee/:coacheeId',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coachee = await User.findOne({
        _id: req.params['coacheeId'],
        organizationId: req.user!.organizationId,
        role: 'coachee',
      }).select('_id firstName lastName email');
      if (!coachee) { res.status(404).json({ error: req.t('errors.coacheeNotFoundShort') }); return; }

      // Idempotent: return the existing sponsor when one already exists
      const existing = await Sponsor.findOne({
        organizationId: req.user!.organizationId,
        email: coachee.email,
      });
      if (existing) { res.json(existing); return; }

      const sponsor = await Sponsor.create({
        organizationId: req.user!.organizationId,
        name: `${coachee.firstName} ${coachee.lastName}`.trim(),
        email: coachee.email,
        coacheeId: coachee._id,
        isActive: true,
      });
      res.status(201).json(sponsor);
    } catch (e) { next(e); }
  },
);

// ─── Update ─────────────────────────────────────────────────────────────────
router.put(
  '/:id',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const update = { ...req.body };
      delete update.organizationId;
      delete update._id;
      try {
        const sponsor = await Sponsor.findOneAndUpdate(
          { _id: req.params['id'], organizationId: req.user!.organizationId },
          update,
          { new: true, runValidators: true },
        );
        if (!sponsor) { res.status(404).json({ error: req.t('errors.sponsorNotFound') }); return; }
        res.json(sponsor);
      } catch (err) {
        if ((err as { code?: number })?.code === 11000) {
          res.status(409).json({ error: req.t('errors.sponsorEmailExists') });
          return;
        }
        throw err;
      }
    } catch (e) { next(e); }
  },
);

// ─── Delete ─────────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Block delete when active engagements still reference this sponsor.
      const activeRefs = await CoachingEngagement.countDocuments({
        organizationId: req.user!.organizationId,
        sponsorId: req.params['id'],
        status: { $in: ['prospect', 'contracted', 'active', 'paused'] },
      });
      if (activeRefs > 0) {
        res.status(400).json({
          error: req.t('errors.cannotDeleteSponsorActive', { count: activeRefs }),
        });
        return;
      }
      const sponsor = await Sponsor.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!sponsor) { res.status(404).json({ error: req.t('errors.sponsorNotFound') }); return; }
      res.json({ message: 'Sponsor deleted' });
    } catch (e) { next(e); }
  },
);

// ─── Billing summary for one sponsor ────────────────────────────────────────
router.get(
  '/:id/billing',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const sponsor = await Sponsor.findOne({ _id: req.params['id'], organizationId: orgId })
        .populate('coacheeId', 'firstName lastName email');
      if (!sponsor) { res.status(404).json({ error: req.t('errors.sponsorNotFound') }); return; }

      // Sponsor billing is org-wide: show every engagement billed to this
      // sponsor regardless of coach. A coach viewing the page sees all
      // coachees + coaches under this sponsor so they can see total owed.
      const engagementFilter: Record<string, unknown> = {
        organizationId: orgId,
        sponsorId: sponsor._id,
        billingMode: 'sponsor',
      };

      const engagements = await CoachingEngagement.find(engagementFilter)
        .populate('coachId', 'firstName lastName email profilePicture')
        .populate('coacheeId', 'firstName lastName email')
        .lean();

      const engagementIds = engagements.map((e) => e._id);
      const sessions = await CoachingSession.find({
        organizationId: orgId,
        engagementId: { $in: engagementIds },
      }).select('-coachNotes').sort({ date: -1 }).lean();

      // Build a set of engagement IDs already in any non-void invoice
      // (so the UI can show a "Billed" flag).
      const priorInvoices = await Invoice.find({
        organizationId: orgId,
        sponsorId: sponsor._id,
        status: { $ne: 'void' },
      }).select('engagementIds invoiceNumber status').lean();
      const billedMap = new Map<string, { invoiceNumber: string; status: string }>();
      for (const inv of priorInvoices) {
        for (const id of inv.engagementIds || []) {
          billedMap.set(String(id), { invoiceNumber: inv.invoiceNumber, status: inv.status });
        }
      }

      const items = engagements.map((eng) => {
        const engSessions = sessions.filter(
          (s) => s.engagementId.toString() === eng._id.toString(),
        );
        const completed = engSessions.filter((s) => s.status === 'completed');
        const rate = eng.hourlyRate ?? sponsor.defaultHourlyRate ?? 0;
        const billedHours = eng.sessionsPurchased ?? 0;
        const totalAmount = billedHours * rate;
        const completedHours = completed.reduce((sum, s) => sum + (s.duration || 60), 0) / 60;
        const billedRef = billedMap.get(String(eng._id));
        return {
          engagementId: eng._id,
          coach: eng.coachId,
          coachee: eng.coacheeId,
          status: eng.status,
          hourlyRate: rate,
          sessionsPurchased: eng.sessionsPurchased,
          sessionsUsed: eng.sessionsUsed,
          sessionsCompleted: completed.length,
          sessionsTotal: engSessions.length,
          billedHours,
          completedHours: Math.round(completedHours * 100) / 100,
          totalAmount: Math.round(totalAmount * 100) / 100,
          billed: !!billedRef,
          billedInvoiceNumber: billedRef?.invoiceNumber,
          billedInvoiceStatus: billedRef?.status,
        };
      });

      const grandTotal = items.reduce((sum, i) => sum + i.totalAmount, 0);
      // "Estimate" = total of every engagement that's not yet on a non-void invoice.
      const unbilledEstimate = items
        .filter((i) => !i.billed)
        .reduce((sum, i) => sum + i.totalAmount, 0);

      // Group engagements by coachee for the UI
      const byCoachee = new Map<string, typeof items>();
      for (const it of items) {
        const key = it.coachee?._id?.toString?.() || 'unknown';
        if (!byCoachee.has(key)) byCoachee.set(key, []);
        byCoachee.get(key)!.push(it);
      }
      const coacheeGroups = Array.from(byCoachee.entries()).map(([_id, list]) => ({
        coachee: list[0].coachee,
        engagements: list,
        subtotal: Math.round(list.reduce((s, e) => s + e.totalAmount, 0) * 100) / 100,
      }));

      // Existing invoices for this sponsor
      const invoices = await Invoice.find({
        organizationId: orgId,
        sponsorId: sponsor._id,
      }).sort({ createdAt: -1 }).lean();

      res.json({
        sponsor,
        engagements: items,
        coacheeGroups,
        invoices,
        grandTotal: Math.round(grandTotal * 100) / 100,
        unbilledEstimate: Math.round(unbilledEstimate * 100) / 100,
      });
    } catch (e) { next(e); }
  },
);

// ─── Generate an invoice for one sponsor ────────────────────────────────────
//
// Bundles every billable engagement (billingMode='sponsor') under the sponsor
// into line items grouped per engagement: "<Coachee name> — <N> sessions @
// $X/hr". Status starts as 'draft'. The coach/admin can then send / mark paid
// from the existing invoice flow.
router.post(
  '/:id/invoice',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const sponsor = await Sponsor.findOne({ _id: req.params['id'], organizationId: orgId });
      if (!sponsor) { res.status(404).json({ error: req.t('errors.sponsorNotFound') }); return; }

      // Skip engagements that already appear in any non-void invoice for
      // this sponsor (drafts count too — re-generating shouldn't double-bill).
      const priorInvoices = await Invoice.find({
        organizationId: orgId,
        sponsorId: sponsor._id,
        status: { $ne: 'void' },
      }).select('engagementIds').lean();
      const billedEngagementIds = new Set<string>();
      for (const inv of priorInvoices) {
        for (const id of inv.engagementIds || []) billedEngagementIds.add(String(id));
      }

      const allEngagements = await CoachingEngagement.find({
        organizationId: orgId,
        sponsorId: sponsor._id,
        billingMode: 'sponsor',
      })
        .populate('coacheeId', 'firstName lastName')
        .lean();

      const engagements = allEngagements.filter(
        (e) => !billedEngagementIds.has(String(e._id)),
      );

      if (!allEngagements.length) {
        res.status(400).json({ error: req.t('errors.noBillableEngagements') });
        return;
      }
      if (!engagements.length) {
        res.status(400).json({ error: req.t('errors.allEngagementsInvoiced') });
        return;
      }

      const lineItems: ILineItem[] = engagements.map((eng) => {
        const coachee = eng.coacheeId as unknown as { firstName: string; lastName: string };
        const coacheeName = coachee
          ? `${coachee.firstName} ${coachee.lastName}`
          : 'Coachee';
        const rate = eng.hourlyRate ?? sponsor.defaultHourlyRate ?? 0;
        const hours = eng.sessionsPurchased ?? 0;
        const unitPriceCents = Math.round(rate * 100);
        const amountCents = unitPriceCents * hours;
        return {
          description: `${coacheeName} — ${hours} session(s) @ ${rate.toFixed(2)}/hr`,
          quantity: hours,
          unitPrice: unitPriceCents,
          amount: amountCents,
        };
      }).filter((li) => li.amount > 0);

      if (!lineItems.length) {
        res.status(400).json({
          error: req.t('errors.noBillableAmount'),
        });
        return;
      }

      const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);

      // Snapshot billing address + apply Canadian tax rules.
      const billingAddress = sponsor.billingAddress
        ? {
            line1:      sponsor.billingAddress.line1,
            line2:      sponsor.billingAddress.line2,
            city:       sponsor.billingAddress.city,
            state:      sponsor.billingAddress.state,
            postalCode: sponsor.billingAddress.postalCode,
            country:    sponsor.billingAddress.country,
          }
        : undefined;
      const country = billingAddress?.country?.toUpperCase();
      const province = billingAddress?.state?.toUpperCase();

      let tax = 0, taxRate = 0;
      let taxBreakdown: { gst: number; hst: number; pst: number; qst: number } | undefined;
      if (!sponsor.taxExempt && country === 'CA') {
        const calc = calculateTax(subtotal, country, province);
        tax = calc.totalTax;
        taxRate = calc.rates.combined;
        taxBreakdown = { gst: calc.gst, hst: calc.hst, pst: calc.pst, qst: calc.qst };
      }
      const total = subtotal + tax;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // Preview mode: return the calculated invoice without persisting.
      if (req.body?.preview === true) {
        res.json({
          preview: true,
          sponsor: { name: sponsor.name, email: sponsor.email, taxExempt: !!sponsor.taxExempt },
          billingAddress,
          lineItems,
          subtotal, taxRate, tax, taxBreakdown, total,
          taxLabel: country === 'CA' ? getTaxRates(country, province).label : 'No tax',
          currency: 'CAD',
          dueDate,
          engagementCount: engagements.length,
        });
        return;
      }

      const year = new Date().getFullYear();
      const prefix = `SPN-${year}-`;

      // Sponsor-invoice sequence is independent of the org-level INV- series.
      // Pick the next number from the count of existing SPN- invoices and
      // retry once on the rare race-condition collision.
      let invoice = null;
      for (let attempt = 0; attempt < 5 && !invoice; attempt++) {
        const count = await Invoice.countDocuments({
          organizationId: orgId,
          invoiceNumber: { $regex: `^${prefix}` },
        });
        const invoiceNumber = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
        try {
          invoice = await Invoice.create({
            organizationId: orgId,
            sponsorId: sponsor._id,
            engagementIds: engagements.map((e) => e._id),
            invoiceNumber,
            period: {
              from: new Date(Math.min(...engagements.map((e) => new Date(e.startDate || e.createdAt).getTime()))),
              to: new Date(),
            },
            lineItems,
            subtotal,
            taxRate,
            tax,
            taxBreakdown,
            total,
            currency: 'CAD',
            status: 'draft',
            dueDate,
            billingAddress,
            taxId: sponsor.taxId,
          });
        } catch (err) {
          if ((err as { code?: number })?.code === 11000) continue; // try next number
          throw err;
        }
      }

      if (!invoice) {
        res.status(500).json({ error: req.t('errors.couldNotAllocateInvoiceNumber') });
        return;
      }
      res.status(201).json(invoice);
    } catch (e) { next(e); }
  },
);

// ─── View one sponsor invoice (full details, used by print/view page) ───────
router.get(
  '/:id/invoices/:invoiceId',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const sponsor = await Sponsor.findOne({ _id: req.params['id'], organizationId: orgId });
      if (!sponsor) { res.status(404).json({ error: req.t('errors.sponsorNotFound') }); return; }

      const invoice = await Invoice.findOne({
        _id: req.params['invoiceId'],
        organizationId: orgId,
        sponsorId: sponsor._id,
      }).lean();
      if (!invoice) { res.status(404).json({ error: req.t('errors.invoiceNotFound') }); return; }

      res.json({ invoice, sponsor });
    } catch (e) { next(e); }
  },
);

// ─── Edit a sponsor invoice (only while draft) ──────────────────────────────
router.put(
  '/:id/invoices/:invoiceId',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const invoice = await Invoice.findOne({
        _id: req.params['invoiceId'],
        organizationId: orgId,
        sponsorId: req.params['id'],
      });
      if (!invoice) { res.status(404).json({ error: req.t('errors.invoiceNotFound') }); return; }
      if (invoice.status !== 'draft') {
        res.status(400).json({ error: req.t('errors.cannotEditInvoiceStatus', { status: invoice.status }) });
        return;
      }

      const { lineItems, dueDate, notes, taxRate } = req.body as {
        lineItems?: ILineItem[];
        dueDate?: string;
        notes?: string;
        taxRate?: number;  // percentage
      };

      if (Array.isArray(lineItems)) invoice.lineItems = lineItems;
      if (dueDate) invoice.dueDate = new Date(dueDate);
      if (notes !== undefined) invoice.notes = notes;
      if (taxRate !== undefined) invoice.taxRate = taxRate / 100;

      // Recalc subtotal/tax/total whenever lineItems or taxRate changed.
      if (Array.isArray(lineItems) || taxRate !== undefined) {
        const subtotal = invoice.lineItems.reduce((s, li) => s + li.amount, 0);
        const tax = Math.round(subtotal * (invoice.taxRate || 0));
        invoice.subtotal = subtotal;
        invoice.tax = tax;
        invoice.total = subtotal + tax;
        // Manual taxRate override clears the per-province breakdown.
        if (taxRate !== undefined) invoice.taxBreakdown = undefined;
      }

      await invoice.save();
      res.json(invoice);
    } catch (e) { next(e); }
  },
);

// ─── Send a sponsor invoice (status draft -> sent + email) ──────────────────
router.post(
  '/:id/invoices/:invoiceId/send',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const sponsor = await Sponsor.findOne({ _id: req.params['id'], organizationId: orgId });
      if (!sponsor) { res.status(404).json({ error: req.t('errors.sponsorNotFound') }); return; }

      const invoice = await Invoice.findOne({
        _id: req.params['invoiceId'],
        organizationId: orgId,
        sponsorId: sponsor._id,
      });
      if (!invoice) { res.status(404).json({ error: req.t('errors.invoiceNotFound') }); return; }
      if (invoice.status !== 'draft' && invoice.status !== 'overdue') {
        res.status(400).json({ error: req.t('errors.cannotSendInvoiceStatus', { status: invoice.status }) });
        return;
      }

      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await invoice.save();

      // Best-effort sponsor email (uses the existing email service).
      // Not blocking — even if email fails the status change persists.
      try {
        const { sendEmail } = await import('../services/email.service');
        const fmt = (cents: number) => `$${(cents / 100).toFixed(2)} CAD`;
        const lines = invoice.lineItems.map((li) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;">${li.description}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;text-align:center;">${li.quantity}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;text-align:right;">${fmt(li.unitPrice)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;text-align:right;font-weight:600;">${fmt(li.amount)}</td>
          </tr>`).join('');
        const dueStr = invoice.dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const html = `
          <div style="font-family:Arial,sans-serif;color:#1B2A47;max-width:640px;margin:0 auto;">
            <h2 style="margin:0 0 12px;">Invoice ${invoice.invoiceNumber}</h2>
            <p>Hello ${sponsor.name},</p>
            <p>A new coaching invoice is ready for your review. Total <strong>${fmt(invoice.total)}</strong> due ${dueStr}.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
              <thead>
                <tr style="background:#f7f9fc;">
                  <th style="padding:10px 12px;text-align:left;color:#6b7c93;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
                  <th style="padding:10px 12px;color:#6b7c93;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;color:#6b7c93;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Unit price</th>
                  <th style="padding:10px 12px;text-align:right;color:#6b7c93;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
                </tr>
              </thead>
              <tbody>${lines}</tbody>
              <tfoot>
                <tr><td colspan="3" style="text-align:right;padding:6px 12px;color:#6b7c93;">Subtotal</td><td style="text-align:right;padding:6px 12px;">${fmt(invoice.subtotal)}</td></tr>
                ${invoice.tax > 0 ? `<tr><td colspan="3" style="text-align:right;padding:6px 12px;color:#6b7c93;">Tax</td><td style="text-align:right;padding:6px 12px;">${fmt(invoice.tax)}</td></tr>` : ''}
                <tr><td colspan="3" style="text-align:right;padding:10px 12px;font-weight:700;border-top:2px solid #1B2A47;">Total due</td><td style="text-align:right;padding:10px 12px;font-weight:700;border-top:2px solid #1B2A47;">${fmt(invoice.total)}</td></tr>
              </tfoot>
            </table>
            <p style="color:#6b7c93;font-size:12px;">Sent by ARTES on behalf of your coach.</p>
          </div>`;
        await sendEmail({
          to: sponsor.email,
          subject: `Invoice ${invoice.invoiceNumber} — ${fmt(invoice.total)} due ${dueStr}`,
          html,
        });
      } catch (err) {
        console.error('[Sponsor] Failed to email invoice:', err);
      }

      res.json(invoice);
    } catch (e) { next(e); }
  },
);

// ─── Cancel (void) a sponsor invoice ────────────────────────────────────────
// Voiding releases its engagements so they become billable again.
router.patch(
  '/:id/invoices/:invoiceId/void',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const invoice = await Invoice.findOneAndUpdate(
        { _id: req.params['invoiceId'], organizationId: orgId, sponsorId: req.params['id'] },
        { status: 'void' },
        { new: true },
      );
      if (!invoice) { res.status(404).json({ error: req.t('errors.invoiceNotFound') }); return; }
      res.json(invoice);
    } catch (e) { next(e); }
  },
);

// ─── Delete a sponsor invoice (only when draft or void) ─────────────────────
router.delete(
  '/:id/invoices/:invoiceId',
  requirePermission('MANAGE_SPONSORS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const invoice = await Invoice.findOne({
        _id: req.params['invoiceId'],
        organizationId: orgId,
        sponsorId: req.params['id'],
      });
      if (!invoice) { res.status(404).json({ error: req.t('errors.invoiceNotFound') }); return; }
      if (invoice.status !== 'draft' && invoice.status !== 'void') {
        res.status(400).json({
          error: req.t('errors.cannotDeleteInvoiceStatus', { status: invoice.status }),
        });
        return;
      }
      await invoice.deleteOne();
      res.json({ message: 'Invoice deleted' });
    } catch (e) { next(e); }
  },
);

export default router;
