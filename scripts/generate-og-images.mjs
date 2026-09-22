#!/usr/bin/env node
/**
 * Generates one console-styled Open Graph image per locale (1200x630) as a
 * static SVG rasterized to PNG via sharp/librsvg. Not part of `astro build`
 * — re-run manually (`node scripts/generate-og-images.mjs`) if the copy or
 * palette changes. Output: public/og/<locale>.png.
 *
 * Copy is kept in sync by hand with src/i18n/ui.ts (home.heroKicker,
 * home.heroLine) rather than imported, since this is a plain .mjs script
 * and ui.ts is TypeScript — update both places together.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "public", "og");

// Keep in sync with src/i18n/ui.ts: home.heroKicker and home.heroLine.
const COPY = {
  es: {
    kicker: "pi extension · v0.4.6",
    line: "Sabe cuánto trabajó tu agente en cada cliente, proyecto y tarea. Y cuánto te costó.",
    prompt: "$ pi install npm:kankaku",
  },
  en: {
    kicker: "pi extension · v0.4.6",
    line: "Know how long your agent worked on each client, project and task. And what it cost you.",
    prompt: "$ pi install npm:kankaku",
  },
  ja: {
    kicker: "piエクステンション · v0.4.6",
    line: "エージェントが各クライアント・プロジェクト・タスクにどれだけ作業したかがわかります。かかったコストも。",
    prompt: "$ pi install npm:kankaku",
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

await mkdir(outDir, { recursive: true });
for (const [locale, copy] of Object.entries(COPY)) {
  const svg = svgFor(copy, locale);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(path.join(outDir, `${locale}.png`), png);
  console.log(`public/og/${locale}.png: ${(png.length / 1024).toFixed(1)} KB`);
}
