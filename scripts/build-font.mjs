#!/usr/bin/env node
/**
 * Rebuilds the self-hosted Nerd Font subset used by the site.
 *
 * Source: "JetBrains Mono Nerd Font Mono" (Regular + Bold), from the
 * nerd-fonts project (https://github.com/ryanoasis/nerd-fonts), which
 * patches JetBrains Mono (SIL OFL-1.1) with extra glyph sets. We only ship
 * a small subset: Latin + Latin-1 + Latin Extended-A (covers Spanish and
 * English), general punctuation, arrows, box-drawing and block elements
 * (for the ASCII/box diagrams and terminal chrome), and ~24 explicitly
 * chosen Nerd Font glyphs actually used in the UI (see ICONS below).
 *
 * Usage:
 *   1. Download the release zip for "JetBrainsMono.zip" from
 *      https://github.com/ryanoasis/nerd-fonts/releases/latest and extract
 *      `JetBrainsMonoNerdFontMono-Regular.ttf` and `-Bold.ttf` into
 *      scripts/.font-src/ (gitignored, not committed — ~2.5MB each).
 *   2. Run `node scripts/build-font.mjs`.
 *
 * This does not run as part of `astro build` — the output is committed to
 * `public/fonts/` like any other static asset, and this script exists so
 * the subset can be reproduced or extended (e.g. adding a new icon) later.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, ".font-src");
const outDir = path.join(here, "..", "public", "fonts");

/** Standard Unicode ranges the site's Latin UI text needs. */
const RANGES = [
  [0x0020, 0x007e], // Basic Latin
  [0x00a0, 0x00ff], // Latin-1 Supplement (á é í ó ú ü ñ ¿ ¡ etc.)
  [0x0100, 0x017f], // Latin Extended-A (headroom)
  [0x2000, 0x206f], // General Punctuation (curly quotes, dashes, ellipsis, bullet)
  [0x2190, 0x2199], // basic arrows
  [0x2500, 0x257f], // Box Drawing (ASCII/box diagrams)
  [0x2580, 0x259f], // Block Elements
];

/**
 * Nerd Font glyphs actually used in the site's UI, verified present in the
 * source font's cmap (see scripts/_inspect-font.mjs). Keep this list in
 * sync with src/components/icons/NerdIcon.astro's ICONS map.
 */
export const ICONS = {
  terminal: 0xf120,
  github: 0xf09b,
  folder: 0xf07b,
  folderOpen: 0xf07c,
  check: 0xf00c,
  times: 0xf00d,
  clock: 0xf017,
  briefcase: 0xf0b1,
  database: 0xf1c0,
  lock: 0xf023,
  globe: 0xf0ac,
  bolt: 0xf0e7,
  book: 0xf02d,
  cog: 0xf013,
  download: 0xf019,
  warning: 0xf071,
  info: 0xf05a,
  rocket: 0xf135,
  code: 0xf121,
  shield: 0xf132,
  refresh: 0xf021,
  link: 0xf0c1,
  gitBranch: 0xf418,
  chevronRight: 0xf054,
};

function rangesToText(ranges) {
  let text = "";
  for (const [start, end] of ranges) {
    for (let cp = start; cp <= end; cp++) text += String.fromCodePoint(cp);
  }
  return text;
}

async function buildOne(srcFile, outFile) {
  if (!existsSync(srcFile)) {
    console.error(`Missing source font: ${srcFile}`);
    console.error("See the header of this script for how to obtain it.");
    process.exitCode = 1;
    return;
  }
  const input = await readFile(srcFile);
  const text = rangesToText(RANGES) + Object.values(ICONS).map((cp) => String.fromCodePoint(cp)).join("");
  const buffer = await subsetFont(input, text, { targetFormat: "woff2" });
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, buffer);
  console.log(`${path.relative(process.cwd(), outFile)}: ${(buffer.length / 1024).toFixed(1)} KB`);
}

await buildOne(path.join(srcDir, "JetBrainsMonoNerdFontMono-Regular.ttf"), path.join(outDir, "jbm-nerd-regular.woff2"));
await buildOne(path.join(srcDir, "JetBrainsMonoNerdFontMono-Bold.ttf"), path.join(outDir, "jbm-nerd-bold.woff2"));
