import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export interface ILineItem {
  description: string;
  quantity: number;
  unitPrice: number;  // in cents
  amount: number;     // quantity * unitPrice, in cents
}

export interface IBillingAddressSnapshot {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ITaxBreakdown {
  gst: number;       // cents — 5% federal GST (all of Canada)
  hst: number;       // cents — HST replaces GST+PST in ON, NB, NL, NS, PE
  pst: number;       // cents — provincial (BC, SK, MB)
  qst: number;       // cents — Quebec provincial tax (9.975%)
}

export interface IInvoice extends Document {
  organizationId: mongoose.Types.ObjectId;
  invoiceNumber: string;        // INV-2024-0001
  period: { from: Date; to: Date };
  lineItems: ILineItem[];
  subtotal: number;             // cents
  taxRate: number;              // effective combined rate as decimal (e.g. 0.14975)
  tax: number;                  // total tax in cents
  taxBreakdown?: ITaxBreakdown; // per-component breakdown for Canadian taxes
  total: number;                // cents
  currency: string;             // 'CAD'
  status: InvoiceStatus;
  dueDate: Date;
  billingAddress?: IBillingAddressSnapshot;  // snapshot from org at invoice time
  taxId?: string;               // VAT / EIN / GST/HST # snapshot
  paidAt?: Date;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  notes?: string;
  sentAt?: Date;
  reminderSentAt?: Date;        // last payment reminder sent
  reminderCount: number;        // how many reminders sent
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema<ILineItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    period: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    lineItems: [LineItemSchema],
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue', 'void'],
      default: 'draft',
    },
    dueDate: { type: Date, required: true },
    billingAddress: {
      type: new Schema({
        line1:      { type: String },
        line2:      { type: String },
        city:       { type: String },
        state:      { type: String },
        postalCode: { type: String },
        country:    { type: String },
      }, { _id: false }),
    },
    taxBreakdown: {
      type: new Schema({
        gst: { type: Number, default: 0 },
        hst: { type: Number, default: 0 },
        pst: { type: Number, default: 0 },
        qst: { type: Number, default: 0 },
      }, { _id: false }),
    },
    taxId: { type: String },
    paidAt: { type: Date },
    stripeCheckoutSessionId: { type: String },
    stripePaymentIntentId: { type: String },
    notes: { type: String },
    sentAt: { type: Date },
    reminderSentAt: { type: Date },
    reminderCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

InvoiceSchema.plugin(tenantFilterPlugin);
InvoiceSchema.index({ organizationId: 1, status: 1 });
InvoiceSchema.index({ organizationId: 1, createdAt: -1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
