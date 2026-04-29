import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';

const TEMPLATE_DIR = resolve(__dirname, '../templates/contracts');

export type ContractFieldType =
  | 'text' | 'multiline' | 'number' | 'currency' | 'date' | 'select' | 'radio' | 'checkbox';

export interface ContractFieldOption {
  value: string;
  label: string;
  /** PDF checkbox names ticked when this option is selected (radio type only). */
  checks?: string[];
}

export interface ContractField {
  key: string;
  label: string;
  type: ContractFieldType;
  autofill?: string;
  default?: string | number | boolean;
  required?: boolean;
  options?: ContractFieldOption[];
  helpText?: string;
}

export interface ContractSection {
  id: string;
  label: string;
  helpText?: string;
  fields: ContractField[];
}

export interface ContractManifest {
  version: number;
  title: string;
  pdfTemplate: string;
  sections: ContractSection[];
}

let cachedManifest: ContractManifest | null = null;
let cachedTemplate: Uint8Array | null = null;

export function loadManifest(): ContractManifest {
  if (!cachedManifest) {
    const path = resolve(TEMPLATE_DIR, 'coaching-agreement.fields.json');
    cachedManifest = JSON.parse(readFileSync(path, 'utf-8')) as ContractManifest;
  }
  return cachedManifest;
}

function loadTemplate(): Uint8Array {
  if (!cachedTemplate) {
    const manifest = loadManifest();
    cachedTemplate = readFileSync(resolve(TEMPLATE_DIR, manifest.pdfTemplate));
  }
  return cachedTemplate;
}

export interface AutofillContext {
  engagement: {
    goals?: string[];
    hourlyRate?: number;
    startDate?: Date | string;
    [k: string]: unknown;
  };
  sponsor?: { defaultHourlyRate?: number } | null;
  coachee: { firstName: string; lastName: string; email: string };
  coach: { firstName: string; lastName: string; email: string };
  org: { name: string };
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

function formatCurrency(amountInDollars: number): string {
  return `$${amountInDollars.toFixed(2)}`;
}

/** Resolves an autofill key (e.g. "client.fullName") to its string value. */
export function resolveAutofill(source: string, ctx: AutofillContext): string {
  switch (source) {
    case 'today':
      return dateFormatter.format(new Date());
    case 'client.fullName':
      return `${ctx.coachee.firstName} ${ctx.coachee.lastName}`.trim();
    case 'client.firstName':
      return ctx.coachee.firstName;
    case 'client.lastName':
      return ctx.coachee.lastName;
    case 'client.email':
      return ctx.coachee.email;
    case 'coach.fullName':
      return `${ctx.coach.firstName} ${ctx.coach.lastName}`.trim();
    case 'coach.email':
      return ctx.coach.email;
    case 'engagement.goals': {
      const goals = ctx.engagement.goals || [];
      return goals.length ? goals.map(g => `• ${g}`).join('\n') : '';
    }
    case 'engagement.fee': {
      // Per-engagement rate, falling back to sponsor.defaultHourlyRate.
      const rate = ctx.engagement.hourlyRate ?? ctx.sponsor?.defaultHourlyRate;
      return rate ? formatCurrency(rate) : '';
    }
    case 'engagement.startDate': {
      const d = ctx.engagement.startDate;
      return d ? dateFormatter.format(new Date(d as string | Date)) : '';
    }
    case 'org.name':
      return ctx.org.name;
    default:
      return '';
  }
}

/** Build a map of { fieldKey: autofillValue } for every manifest field with an autofill source. */
export function buildAutofillValues(ctx: AutofillContext): Record<string, string> {
  const manifest = loadManifest();
  const values: Record<string, string> = {};
  for (const section of manifest.sections) {
    for (const field of section.fields) {
      if (!field.autofill) continue;
      const v = resolveAutofill(field.autofill, ctx);
      if (v) values[field.key] = v;
    }
  }
  return values;
}

/**
 * Fill the AcroForm template with `values` and flatten to a final PDF.
 * Logical keys like `AgreementDate` resolve to every PDF field matching
 * `AgreementDate` or `AgreementDate_N` (LibreOffice disambiguates duplicates
 * on export — same logical placeholder appears multiple times in the doc).
 */
export async function generateContractPdf(values: Record<string, unknown>): Promise<Buffer> {
  const manifest = loadManifest();
  const pdf = await PDFDocument.load(loadTemplate());
  const form = pdf.getForm();
  const allFields = form.getFields();

  const fieldsByLogicalName = (logical: string) => {
    const re = new RegExp(`^${logical}(?:_\\d+)?$`);
    return allFields.filter(f => re.test(f.getName()));
  };

  const setText = (logical: string, value: string) => {
    for (const f of fieldsByLogicalName(logical)) {
      if (f instanceof PDFTextField) f.setText(value);
    }
  };
  const setCheckbox = (logical: string, checked: boolean) => {
    for (const f of fieldsByLogicalName(logical)) {
      if (f instanceof PDFCheckBox) {
        if (checked) f.check(); else f.uncheck();
      }
    }
  };

  for (const section of manifest.sections) {
    for (const field of section.fields) {
      const v = values[field.key];
      if (v == null || v === '') continue;

      switch (field.type) {
        case 'radio': {
          // First clear every option's target checkbox, then check the selected one's targets.
          for (const opt of field.options || []) {
            for (const c of opt.checks || []) setCheckbox(c, false);
          }
          const opt = field.options?.find(o => o.value === v);
          if (opt?.checks) {
            for (const c of opt.checks) setCheckbox(c, true);
          }
          break;
        }
        case 'checkbox':
          setCheckbox(field.key, !!v);
          break;
        case 'select':
        case 'text':
        case 'multiline':
        case 'number':
        case 'currency':
        case 'date':
          setText(field.key, String(v));
          break;
      }
    }
  }

  form.flatten();
  const out = await pdf.save();
  return Buffer.from(out);
}
