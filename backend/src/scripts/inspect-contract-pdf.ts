/**
 * Inspect a fillable PDF: list every form field with its name, type, and flags.
 *
 *   npx ts-node --project tsconfig.json src/scripts/inspect-contract-pdf.ts
 *   npx ts-node --project tsconfig.json src/scripts/inspect-contract-pdf.ts --fill
 *   npx ts-node --project tsconfig.json src/scripts/inspect-contract-pdf.ts /abs/path/to/file.pdf
 *
 * --fill   Also write a *.sample.pdf next to the source with every text field
 *          set to a canned long value and every checkbox checked, so you can
 *          eyeball the layout before committing the template.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
  PDFButton,
} from 'pdf-lib';

const DEFAULT_PATH = resolve(__dirname, '../templates/contracts/coaching-agreement.pdf');
const SAMPLE_TEXT_SHORT = 'Christopher van der Straeten';
const SAMPLE_TEXT_LONG =
  'Refunds are issued at the Coach\'s discretion within 14 days of payment, less any sessions already delivered and a 10% administration fee. Beyond that window, all fees are non-refundable except where required by Quebec consumer-protection legislation.';

async function main() {
  const args = process.argv.slice(2);
  const fill = args.includes('--fill');
  const pathArg = args.find(a => !a.startsWith('--'));
  const pdfPath = pathArg ? resolve(pathArg) : DEFAULT_PATH;

  console.log(`Inspecting: ${pdfPath}\n`);

  const bytes = readFileSync(pdfPath);
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const fields = form.getFields();

  if (fields.length === 0) {
    console.log('⚠ No form fields found. In LibreOffice, did you tick "Create PDF form" on export?');
    process.exit(1);
  }

  const rows = fields.map(f => {
    const name = f.getName();
    let type = 'Unknown';
    const flags: string[] = [];

    if (f instanceof PDFTextField) {
      type = 'TextField';
      if (f.isMultiline()) flags.push('multiline');
      if (f.isPassword()) flags.push('password');
      if (f.isRequired()) flags.push('required');
      const max = f.getMaxLength();
      if (max != null) flags.push(`maxLen=${max}`);
    } else if (f instanceof PDFCheckBox) {
      type = 'CheckBox';
      if (f.isChecked()) flags.push('default-checked');
    } else if (f instanceof PDFRadioGroup) {
      type = 'RadioGroup';
      flags.push(`options=${f.getOptions().join('|')}`);
    } else if (f instanceof PDFDropdown) {
      type = 'Dropdown';
      flags.push(`options=${f.getOptions().join('|')}`);
    } else if (f instanceof PDFOptionList) {
      type = 'OptionList';
      flags.push(`options=${f.getOptions().join('|')}`);
    } else if (f instanceof PDFButton) {
      type = 'Button';
    }
    return { name, type, flags: flags.join(', ') };
  });

  const nameW = Math.max(...rows.map(r => r.name.length), 'NAME'.length);
  const typeW = Math.max(...rows.map(r => r.type.length), 'TYPE'.length);

  console.log(`${'NAME'.padEnd(nameW)}  ${'TYPE'.padEnd(typeW)}  FLAGS`);
  console.log(`${'-'.repeat(nameW)}  ${'-'.repeat(typeW)}  ${'-'.repeat(20)}`);
  for (const r of rows) console.log(`${r.name.padEnd(nameW)}  ${r.type.padEnd(typeW)}  ${r.flags}`);

  console.log(`\nTotal: ${fields.length} fields`);

  // Duplicate-name check (a common LibreOffice copy-paste mistake)
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.name, (counts.get(r.name) || 0) + 1);
  const dupes = [...counts.entries()].filter(([, c]) => c > 1);
  if (dupes.length) {
    console.log('\n⚠ Duplicate field names (rename so each is unique):');
    for (const [n, c] of dupes) console.log(`   ${n}  (${c}×)`);
  }

  if (!fill) return;

  // Sample-fill mode: stuff every field so you can preview overflow/clipping.
  for (const f of fields) {
    if (f instanceof PDFTextField) {
      const isLong = f.isMultiline() || /policy|goal|address|terms|notes/i.test(f.getName());
      f.setText(isLong ? SAMPLE_TEXT_LONG : SAMPLE_TEXT_SHORT);
    } else if (f instanceof PDFCheckBox) {
      f.check();
    } else if (f instanceof PDFDropdown) {
      const opts = f.getOptions();
      if (opts.length) f.select(opts[0]!);
    } else if (f instanceof PDFRadioGroup) {
      const opts = f.getOptions();
      if (opts.length) f.select(opts[0]!);
    }
  }
  form.flatten();
  const out = await pdf.save();
  const outPath = join(dirname(pdfPath), basename(pdfPath, '.pdf') + '.sample.pdf');
  writeFileSync(outPath, out);
  console.log(`\n✓ Sample-filled copy: ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
