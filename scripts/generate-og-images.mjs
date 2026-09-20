#!/usr/bin/env node
/**
 * Generates one console-styled Open Graph image per locale (1200x630) as a
 * static SVG rasterized to PNG via sharp/librsvg. Not part of `astro build`
 * — re-run manually (`node scripts/generate-og-images.mjs`) if the copy or
 * palette changes. Output: public/og/<locale>.png.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "public", "og");

const COPY = {
  es: {
    kicker: "pi extension · v0.4.6",
    title: "Wall-clock time miente.",
    subtitle: "kankaku mide lo que tu agente trabajó de verdad.",
    prompt: "$ pi install npm:kankaku",
  },
  en: {
    kicker: "pi extension · v0.4.6",
    title: "Wall-clock time lies.",
    subtitle: "kankaku measures what the agent actually worked.",
    prompt: "$ pi install npm:kankaku",
  },
  ja: {
    kicker: "pi エクステンション · v0.4.6",
    title: "Wall-clock timeは嘘をつく。",
    subtitle: "kankaku はエージェントが実際に作業した時間を測定します。",
    prompt: "$ pi install npm:kankaku",
  },
};

// Dark theme tokens (see src/styles/tokens.css), converted to sRGB hex
// since librsvg does not support the CSS oklch() function.
const BG = "#252525";
const CARD = "#2e2e2e";
const BORDER = "#4d4d4d";
const FG = "#f7f7f7";
const MUTED = "#adadad";
const PRIMARY = "#4fb8ad";

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function svgFor({ kicker, title, subtitle, prompt }) {
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="${BG}"/>
    <rect x="48" y="48" width="1104" height="534" rx="16" fill="${CARD}" stroke="${BORDER}" stroke-width="2"/>
    <g transform="translate(88,120)">
      <circle cx="0" cy="0" r="8" fill="${BORDER}"/>
      <circle cx="26" cy="0" r="8" fill="${BORDER}"/>
      <circle cx="52" cy="0" r="8" fill="${BORDER}"/>
    </g>
    <text x="88" y="200" font-family="JetBrains Mono, monospace" font-size="24" letter-spacing="2" fill="${PRIMARY}">${escapeXml(kicker.toUpperCase())}</text>
    <text x="88" y="280" font-family="JetBrains Mono, monospace" font-size="56" font-weight="700" fill="${FG}">${escapeXml(title)}</text>
    <text x="88" y="340" font-family="JetBrains Mono, monospace" font-size="30" fill="${MUTED}">${escapeXml(subtitle)}</text>
    <rect x="88" y="420" width="720" height="64" rx="8" fill="${BG}" stroke="${BORDER}" stroke-width="2"/>
    <text x="112" y="460" font-family="JetBrains Mono, monospace" font-size="26" fill="${PRIMARY}">${escapeXml(prompt)}</text>
    <text x="88" y="540" font-family="JetBrains Mono, monospace" font-size="22" fill="${MUTED}">kankaku · github.com/soyunninja/kankaku</text>
  </svg>`;
}

await mkdir(outDir, { recursive: true });
for (const [locale, copy] of Object.entries(COPY)) {
  const svg = svgFor(copy);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(path.join(outDir, `${locale}.png`), png);
  console.log(`public/og/${locale}.png: ${(png.length / 1024).toFixed(1)} KB`);
}
