#!/usr/bin/env node
/**
 * Generates one console-styled Open Graph image per locale (1200x630) as a
 * static SVG rasterized to PNG via sharp/librsvg. Not part of `astro build`
 * — re-run manually (`node scripts/generate-og-images.mjs`) if the copy or
 * palette changes. `--check` compares the copy and generated PNG bytes
 * without writing files. Output: public/og/<locale>.png.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "public", "og");
const uiPath = path.join(here, "..", "src", "i18n", "ui.ts");
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
  console.error("Usage: node scripts/generate-og-images.mjs [--check]");
  process.exit(1);
}
const check = args[0] === "--check";

// Keep in sync with src/i18n/ui.ts: home.heroKicker and home.heroLine.
const COPY = {
  es: {
    kicker: "pi · Claude Code · CLI · v1.0.0",
    line: "Mide cuánto tiempo trabajó tu agente de IA y cuánto costó, por cliente, proyecto y tarea.",
    prompt: "$ npm install -g kankaku",
  },
  en: {
    kicker: "pi · Claude Code · CLI · v1.0.0",
    line: "Know how long your agent worked on each client, project and task. And what it cost you.",
    prompt: "$ npm install -g kankaku",
  },
  ja: {
    kicker: "pi · Claude Code · CLI · v1.0.0",
    line: "エージェントが各クライアント・プロジェクト・タスクにどれだけ作業したかがわかります。かかったコストも。",
    prompt: "$ npm install -g kankaku",
  },
};

// Dark theme tokens (see src/styles/tokens.css [data-theme="dark"]),
// converted to sRGB hex since librsvg does not support the CSS oklch()
// function.
const BG = "#060407"; // --background
const CARD = "#100A0F"; // --card
const BORDER = "#563040"; // --border
const FG = "#F6EFF3"; // --foreground
const MUTED = "#A78E9B"; // --muted-foreground
const PRIMARY = "#F095C8"; // --primary

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Greedy word-wrap for space-separated scripts (es/en). */
function wrapWords(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Character-wrap for scripts with no spaces (ja). */
function wrapChars(text, maxChars) {
  const chars = [...text];
  const lines = [];
  let current = "";
  for (const ch of chars) {
    current += ch;
    if (current.length >= maxChars) {
      lines.push(current);
      current = "";
    }
  }
  if (current) lines.push(current);
  return lines;
}

function svgFor({ kicker, line, prompt }, locale) {
  const isJa = locale === "ja";
  // Text box: card is x=48..1152 (width 1104); text starts at x=88, so the
  // usable width before the card's right padding is ~1024px.
  const maxWidth = 1024;
  const lineFontSize = isJa ? 28 : 30;
  // Rough average glyph width for this monospace-ish rendering: full-width
  // (CJK) glyphs are ~1em wide, Latin glyphs in a mono font are ~0.6em.
  const maxChars = isJa
    ? Math.floor(maxWidth / lineFontSize)
    : Math.floor(maxWidth / (lineFontSize * 0.6));
  const lines = isJa ? wrapChars(line, maxChars) : wrapWords(line, maxChars);
  const lineHeight = lineFontSize + 12;

  const subtitleStartY = 260;
  const linesSvg = lines
    .map((l, i) => `<text x="88" y="${subtitleStartY + i * lineHeight}" font-family="JetBrains Mono, monospace" font-size="${lineFontSize}" fill="${MUTED}">${escapeXml(l)}</text>`)
    .join("\n    ");

  const promptY = subtitleStartY + lines.length * lineHeight + 30;
  const footerY = promptY + 64 + 46;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${BG}"/>
    <rect x="48" y="48" width="1104" height="534" rx="16" fill="${CARD}" stroke="${BORDER}" stroke-width="2"/>
    <g transform="translate(88,120)">
      <circle cx="0" cy="0" r="8" fill="${BORDER}"/>
      <circle cx="26" cy="0" r="8" fill="${BORDER}"/>
      <circle cx="52" cy="0" r="8" fill="${BORDER}"/>
    </g>
    <text x="88" y="170" font-family="JetBrains Mono, monospace" font-size="22" letter-spacing="2" fill="${PRIMARY}">${escapeXml(kicker.toUpperCase())}</text>
    <text x="88" y="225" font-family="JetBrains Mono, monospace" font-size="56" font-weight="700" fill="${FG}">kankaku</text>
    ${linesSvg}
    <rect x="88" y="${promptY}" width="720" height="64" rx="8" fill="${BG}" stroke="${BORDER}" stroke-width="2"/>
    <text x="112" y="${promptY + 40}" font-family="JetBrains Mono, monospace" font-size="26" fill="${PRIMARY}">${escapeXml(prompt)}</text>
    <text x="88" y="${footerY}" font-family="JetBrains Mono, monospace" font-size="22" fill="${MUTED}">kankaku.io</text>
  </svg>`;
}

// Parse the TypeScript dictionary rather than executing it or matching source
// text: non-literal hero strings should fail the check, not silently pass.
function property(object, name) {
  if (!ts.isObjectLiteralExpression(object)) throw new Error(`Expected object for ${name}`);
  const match = object.properties.find((p) =>
    ts.isPropertyAssignment(p) && p.name.getText() === name);
  if (!match) throw new Error(`Missing UI property: ${name}`);
  return match.initializer;
}

async function checkCopy() {
  const source = ts.createSourceFile(uiPath, await readFile(uiPath, "utf8"), ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) throw new Error("Cannot parse src/i18n/ui.ts");
  const declaration = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((item) => item.name.getText() === "ui");
  if (!declaration) throw new Error("Missing ui dictionary");
  const dictionary = ts.isAsExpression(declaration.initializer)
    ? declaration.initializer.expression : declaration.initializer;
  if (!ts.isObjectLiteralExpression(dictionary)) throw new Error("Expected ui dictionary object");
  const locales = dictionary.properties.map((p) => p.name?.getText());
  if (locales.length !== 3 || new Set(locales).size !== 3 ||
      locales.some((locale) => !Object.hasOwn(COPY, locale))) {
    throw new Error(`UI locales differ from OG locales: ${locales.join(", ")}`);
  }
  for (const [locale, copy] of Object.entries(COPY)) {
    const home = property(property(dictionary, locale), "home");
    for (const [field, expected] of [["heroKicker", copy.kicker], ["heroLine", copy.line]]) {
      const value = property(home, field);
      if (!ts.isStringLiteral(value) || value.text !== expected) {
        throw new Error(`OG COPY mismatch: ${locale}.home.${field}`);
      }
    }
  }
}

if (check) await checkCopy();
else await mkdir(outDir, { recursive: true });

for (const [locale, copy] of Object.entries(COPY)) {
  const png = await sharp(Buffer.from(svgFor(copy, locale))).png().toBuffer();
  const output = path.join(outDir, `${locale}.png`);
  if (check) {
    const existing = await readFile(output);
    if (!png.equals(existing)) throw new Error(`OG image differs: public/og/${locale}.png`);
  } else {
    await writeFile(output, png);
  }
  console.log(`public/og/${locale}.png: ${(png.length / 1024).toFixed(1)} KB${check ? " matches" : ""}`);
}
