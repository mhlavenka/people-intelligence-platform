#!/usr/bin/env node

/**
 * Pre-deploy translation check.
 * Ensures all language files have the same keys as en.json (the reference).
 * Exits with code 1 if any keys are missing.
 *
 * Usage: node scripts/check-translations.js
 */

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'frontend', 'src', 'assets', 'i18n');

function collectKeys(obj, prefix = '') {
  const keys = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      keys.push(...collectKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function resolve(obj, dotPath) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

// Discover all language files
const files = fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.json'));
if (files.length < 2) {
  console.log('⚠  Only one language file found — nothing to compare.');
  process.exit(0);
}

// Load reference (en.json)
const enPath = path.join(I18N_DIR, 'en.json');
if (!fs.existsSync(enPath)) {
  console.error('✗ en.json not found at', enPath);
  process.exit(1);
}
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = collectKeys(en);

console.log(`Reference: en.json (${enKeys.length} keys)`);
console.log(`Languages: ${files.map(f => f.replace('.json', '')).join(', ')}\n`);

let allPassed = true;

for (const file of files) {
  if (file === 'en.json') continue;

  const lang = file.replace('.json', '');
  const filePath = path.join(I18N_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const langKeys = collectKeys(data);

  // Keys in en.json but missing from this language
  const missingInLang = enKeys.filter(k => resolve(data, k) === undefined);
  // Keys in this language but not in en.json (extra/stale)
  const extraInLang = langKeys.filter(k => resolve(en, k) === undefined);

  if (missingInLang.length === 0 && extraInLang.length === 0) {
    console.log(`✓ ${lang}.json — ${langKeys.length} keys, all match`);
  } else {
    allPassed = false;
    if (missingInLang.length > 0) {
      console.log(`✗ ${lang}.json — ${missingInLang.length} MISSING key(s):`);
      missingInLang.forEach(k => console.log(`    - ${k}`));
    }
    if (extraInLang.length > 0) {
      console.log(`⚠ ${lang}.json — ${extraInLang.length} EXTRA key(s) not in en.json:`);
      extraInLang.forEach(k => console.log(`    + ${k}`));
    }
  }
}

console.log('');
if (allPassed) {
  console.log('✓ All translation files are in sync.');
  process.exit(0);
} else {
  console.log('✗ Translation files are out of sync. Fix missing keys before deploying.');
  process.exit(1);
}
