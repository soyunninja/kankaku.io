#!/usr/bin/env node
/**
 * Build-time i18n completeness check. Fails (non-zero exit) when:
 *  1. src/i18n/ui.ts's es/en/ja dictionaries don't have identical key sets.
 *  2. src/content/docs/{es,en,ja}/ don't have identical slug sets.
 *  3. src/data/commands-i18n/{es,en,ja}.json don't have identical key sets.
 *
 * Run via `pnpm run i18n:check`. Intended to run before `astro build` in CI.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
let failed = false;

function fail(msg) {
  console.error(`✗ ${msg}`);
  failed = true;
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function diff(a, b) {
  const setB = new Set(b);
  return a.filter((x) => !setB.has(x));
}

// 1. UI dictionary
const { ui } = await import(path.join(root, "src/i18n/ui.ts"));
const locales = Object.keys(ui);
const keysByLocale = Object.fromEntries(locales.map((l) => [l, collectKeys(ui[l]).sort()]));
const [first, ...rest] = locales;
let uiOk = true;
for (const l of rest) {
  const missing = diff(keysByLocale[first], keysByLocale[l]);
  const extra = diff(keysByLocale[l], keysByLocale[first]);
  if (missing.length) {
    fail(`ui.ts: locale "${l}" is missing keys: ${missing.join(", ")}`);
    uiOk = false;
  }
  if (extra.length) {
    fail(`ui.ts: locale "${l}" has extra keys not in "${first}": ${extra.join(", ")}`);
    uiOk = false;
  }
}
if (uiOk) ok(`ui.ts: ${keysByLocale[first].length} keys match across ${locales.join(", ")}`);

// 2. Content collections (docs)
const docsDirs = { es: "src/content/docs/es", en: "src/content/docs/en", ja: "src/content/docs/ja" };
const slugsByLocale = {};
for (const [locale, dir] of Object.entries(docsDirs)) {
  const entries = await readdir(path.join(root, dir));
  slugsByLocale[locale] = entries.map((f) => f.replace(/\.(md|mdx)$/, "")).sort();
}
let docsOk = true;
const docLocales = Object.keys(slugsByLocale);
for (const l of docLocales.slice(1)) {
  const missing = diff(slugsByLocale[docLocales[0]], slugsByLocale[l]);
  const extra = diff(slugsByLocale[l], slugsByLocale[docLocales[0]]);
  if (missing.length) {
    fail(`docs: locale "${l}" is missing pages: ${missing.join(", ")}`);
    docsOk = false;
  }
  if (extra.length) {
    fail(`docs: locale "${l}" has extra pages not in "${docLocales[0]}": ${extra.join(", ")}`);
    docsOk = false;
  }
}
if (docsOk) ok(`docs: ${slugsByLocale[docLocales[0]].length} pages match across ${docLocales.join(", ")}`);

// 3. Commands i18n data
const cmdI18n = {};
for (const l of ["es", "en", "ja"]) {
  cmdI18n[l] = (await import(path.join(root, `src/data/commands-i18n/${l}.json`), { with: { type: "json" } })).default;
}
let cmdOk = true;
const cmdKeysByLocale = Object.fromEntries(Object.entries(cmdI18n).map(([l, v]) => [l, collectKeys(v).sort()]));
for (const l of ["en", "ja"]) {
  const missing = diff(cmdKeysByLocale.es, cmdKeysByLocale[l]);
  const extra = diff(cmdKeysByLocale[l], cmdKeysByLocale.es);
  if (missing.length) {
    fail(`commands-i18n: locale "${l}" is missing keys: ${missing.join(", ")}`);
    cmdOk = false;
  }
  if (extra.length) {
    fail(`commands-i18n: locale "${l}" has extra keys not in "es": ${extra.join(", ")}`);
    cmdOk = false;
  }
}
if (cmdOk) ok(`commands-i18n: ${cmdKeysByLocale.es.length} keys match across es, en, ja`);

if (failed) {
  console.error("\ni18n completeness check FAILED.");
  process.exit(1);
} else {
  console.log("\ni18n completeness check passed.");
}
