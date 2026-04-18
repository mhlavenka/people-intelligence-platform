import express, { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import { config } from '../config/env';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { Invoice } from '../models/Invoice.model';

const router = Router();
const stripe = new Stripe(config.stripe.secretKey);

// ─── Stripe webhook ───────────────────────────────────────────────────────────
// Must use raw body parser — registered BEFORE the global json() middleware in
// app.ts via: app.use('/api/billing/webhook', express.raw({ type:'application/json' }))
// The inline middleware here is a safety net for direct mounting.

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      res.status(400).json({ error: req.t ? req.t('errors.missingStripeSignature') : 'Missing stripe-signature header' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Webhook signature verification failed';
      res.status(400).json({ error: message });
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        const invoice = await Invoice.findOne({
          stripeCheckoutSessionId: session.id,
        }).setOptions({ bypassTenantCheck: true });

        if (invoice) {
          invoice.status = 'paid';
          invoice.paidAt = new Date();
          if (session.payment_intent && typeof session.payment_intent === 'string') {
            invoice.stripePaymentIntentId = session.payment_intent;
          }
          await invoice.save();
        }
      }

      res.json({ received: true });
    } catch (e) {
      next(e);
    }
  }
);

// ─── Authenticated org-level billing routes ───────────────────────────────────

router.use(authenticateToken, tenantResolver);

// GET /api/billing/invoices — list own org's SUBSCRIPTION invoices.
// Sponsor (coaching) invoices live in the same collection but are
// filtered out here so the org billing page only shows what the org is
// being charged for its own subscription plan. Sponsor invoices are
// reachable via /api/sponsors/:id/billing.
router.get(
  '/invoices',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = req.user!.organizationId;

      const invoices = await Invoice.find({
        organizationId,
        $or: [{ sponsorId: { $exists: false } }, { sponsorId: null }],
      })
        .sort({ createdAt: -1 })
        .lean();

      res.json(invoices);
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/billing/invoices/:id — get single subscription invoice
router.get(
  '/invoices/:id',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = req.user!.organizationId;

      const invoice = await Invoice.findOne({
        _id: req.params['id'],
        organizationId,
        $or: [{ sponsorId: { $exists: false } }, { sponsorId: null }],
      }).lean();

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

// POST /api/billing/invoices/:id/pay — create Stripe Checkout Session
router.post(
  '/invoices/:id/pay',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = req.user!.organizationId;

      const invoice = await Invoice.findOne({
        _id: req.params['id'],
        organizationId,
      });

      if (!invoice) {
        res.status(404).json({ error: req.t('errors.invoiceNotFound') });
        return;
      }

      if (invoice.status !== 'sent' && invoice.status !== 'overdue') {
        res.status(400).json({
          error: req.t('errors.invoiceCannotBePaid', { status: invoice.status }),
        });
        return;
      }

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = invoice.lineItems.map(
        (item) => ({
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: { name: item.description },
            unit_amount: item.unitPrice,
          },
          quantity: item.quantity,
        })
      );

      // Add tax as a separate line item so Stripe charges the full invoice total
      if (invoice.tax > 0) {
        const taxLabel = `Tax (${(invoice.taxRate * 100).toFixed(1).replace(/\.0$/, '')}%)`;
        lineItems.push({
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: { name: taxLabel },
            unit_amount: invoice.tax,
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${config.frontendUrl}/billing?payment=success&invoice={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/billing?payment=cancelled`,
        metadata: {
          invoiceId: (invoice._id as mongoose.Types.ObjectId).toString(),
          invoiceNumber: invoice.invoiceNumber,
        },
      });

      invoice.stripeCheckoutSessionId = session.id;
      await invoice.save();

      res.json({ url: session.url });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
