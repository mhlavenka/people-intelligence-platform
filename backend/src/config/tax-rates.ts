/**
 * Canadian sales tax rates by province/territory.
 *
 * Canada has three types of sales tax:
 *   GST (Goods & Services Tax)  — 5% federal, applies everywhere
 *   HST (Harmonized Sales Tax)  — replaces GST+PST in some provinces
 *   PST (Provincial Sales Tax)  — additional provincial tax
 *   QST (Quebec Sales Tax)      — Quebec's provincial tax (9.975%)
 *
 * Province codes use ISO 3166-2:CA (e.g. "ON", "QC", "BC").
 * For non-Canadian clients, no tax is applied.
 */

export interface TaxResult {
  gst: number;     // rate as decimal (e.g. 0.05)
  hst: number;
  pst: number;
  qst: number;
  combined: number; // total effective rate
  label: string;    // display label like "HST 13%", "GST 5% + QST 9.975%"
}

interface ProvinceTaxDef {
  gst: number;
  hst: number;
  pst: number;
  qst: number;
  label: string;
}

// ── Provincial tax definitions ───────────────────────────────────────────────

const PROVINCE_TAX: Record<string, ProvinceTaxDef> = {
  // HST provinces (GST is included in HST — do NOT double-count)
  ON: { gst: 0,    hst: 0.13,   pst: 0, qst: 0, label: 'HST 13%' },
  NB: { gst: 0,    hst: 0.15,   pst: 0, qst: 0, label: 'HST 15%' },
  NL: { gst: 0,    hst: 0.15,   pst: 0, qst: 0, label: 'HST 15%' },
  NS: { gst: 0,    hst: 0.15,   pst: 0, qst: 0, label: 'HST 15%' },
  PE: { gst: 0,    hst: 0.15,   pst: 0, qst: 0, label: 'HST 15%' },

  // GST + PST provinces
  BC: { gst: 0.05, hst: 0, pst: 0.07,    qst: 0, label: 'GST 5% + PST 7%' },
  SK: { gst: 0.05, hst: 0, pst: 0.06,    qst: 0, label: 'GST 5% + PST 6%' },
  MB: { gst: 0.05, hst: 0, pst: 0.07,    qst: 0, label: 'GST 5% + PST 7%' },

  // GST + QST (Quebec — QST is applied on subtotal, not on subtotal+GST since 2013)
  QC: { gst: 0.05, hst: 0, pst: 0, qst: 0.09975, label: 'GST 5% + QST 9.975%' },

  // GST-only provinces / territories
  AB: { gst: 0.05, hst: 0, pst: 0, qst: 0, label: 'GST 5%' },
  NT: { gst: 0.05, hst: 0, pst: 0, qst: 0, label: 'GST 5%' },
  NU: { gst: 0.05, hst: 0, pst: 0, qst: 0, label: 'GST 5%' },
  YT: { gst: 0.05, hst: 0, pst: 0, qst: 0, label: 'GST 5%' },
};

/**
 * Look up Canadian tax rates for a province code.
 * Returns zero taxes for non-Canadian or unknown jurisdictions.
 */
export function getTaxRates(country?: string, province?: string): TaxResult {
  // Only apply Canadian tax when country is CA
  if (!country || country.toUpperCase() !== 'CA') {
    return { gst: 0, hst: 0, pst: 0, qst: 0, combined: 0, label: 'No tax' };
  }

  const code = (province || '').toUpperCase().trim();
  const def = PROVINCE_TAX[code];

  if (!def) {
    // Unknown Canadian province — default to GST only
    return { gst: 0.05, hst: 0, pst: 0, qst: 0, combined: 0.05, label: 'GST 5%' };
  }

  return {
    gst: def.gst,
    hst: def.hst,
    pst: def.pst,
    qst: def.qst,
    combined: def.gst + def.hst + def.pst + def.qst,
    label: def.label,
  };
}

/**
 * Calculate tax amounts from a subtotal in cents.
 * Returns individual tax amounts and total tax — all in cents.
 */
export function calculateTax(subtotalCents: number, country?: string, province?: string): {
  rates: TaxResult;
  gst: number;
  hst: number;
  pst: number;
  qst: number;
  totalTax: number;
} {
  const rates = getTaxRates(country, province);
  const gst = Math.round(subtotalCents * rates.gst);
  const hst = Math.round(subtotalCents * rates.hst);
  const pst = Math.round(subtotalCents * rates.pst);
  const qst = Math.round(subtotalCents * rates.qst);
  return {
    rates,
    gst,
    hst,
    pst,
    qst,
    totalTax: gst + hst + pst + qst,
  };
}

/** All province codes for UI dropdowns. */
export const CANADIAN_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];
