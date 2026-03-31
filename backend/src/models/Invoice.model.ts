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

export interface IInvoice extends Document {
  organizationId: mongoose.Types.ObjectId;
  invoiceNumber: string;        // INV-2024-0001
  period: { from: Date; to: Date };
  lineItems: ILineItem[];
  subtotal: number;             // cents
  taxRate: number;              // e.g. 0.21
  tax: number;                  // cents
  total: number;                // cents
  currency: string;             // 'USD'
  status: InvoiceStatus;
  dueDate: Date;
  billingAddress?: IBillingAddressSnapshot;  // snapshot from org at invoice time
  taxId?: string;               // VAT / EIN snapshot
  paidAt?: Date;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  notes?: string;
  sentAt?: Date;
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
    taxId: { type: String },
    paidAt: { type: Date },
    stripeCheckoutSessionId: { type: String },
    stripePaymentIntentId: { type: String },
    notes: { type: String },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

InvoiceSchema.plugin(tenantFilterPlugin);
InvoiceSchema.index({ organizationId: 1, status: 1 });
InvoiceSchema.index({ organizationId: 1, createdAt: -1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
