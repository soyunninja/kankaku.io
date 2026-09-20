#!/usr/bin/env node
/**
 * Static link checker over the built `dist/` output: verifies every
 * internal <a href> (and its #anchor, if any) resolves to an existing
 * file/route and an existing id in the target page. External links (http/
 * https to another host) are not fetched — this only guards internal
 * navigation and in-page anchors.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(here, "..", "dist");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function toRoute(filePath) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, "/");
  if (rel.endsWith("/index.html")) return "/" + rel.slice(0, -"/index.html".length);
  if (rel === "index.html") return "/";
  return "/" + rel.replace(/\.html$/, "");
}

async function resolveRouteToFile(route) {
  const clean = route.split("?")[0].split("#")[0];
  const candidates = [
    path.join(distDir, clean, "index.html"),
    path.join(distDir, `${clean}.html`),
    path.join(distDir, clean),
  ];
  for (const c of candidates) {
    try {
      const s = await stat(c);
      if (s.isFile()) return c;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /<a\b[^>]*\bhref="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

function extractIds(html) {
  const ids = new Set();
  const re = /\bid="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

const files = await walk(distDir);
const idCache = new Map();
async function idsFor(filePath) {
  if (!idCache.has(filePath)) {
    try {
      idCache.set(filePath, extractIds(await readFile(filePath, "utf8")));
    } catch {
      idCache.set(filePath, new Set());
    }
  }
  return idCache.get(filePath);
}

let errors = 0;
let checked = 0;

for (const file of files) {
  const html = await readFile(file, "utf8");
  const route = toRoute(file);
  for (const href of extractHrefs(html)) {
    if (/^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    if (!href.startsWith("/") && !href.startsWith("#")) continue; // ignore relative asset-ish hrefs we don't expect
    checked++;
    const [pathname, hash] = href.startsWith("#") ? [route, href.slice(1)] : href.split("#");
    const targetPath = pathname === "" ? route : pathname;
    const targetFile = await resolveRouteToFile(targetPath);
    if (!targetFile) {
      console.error(`✗ ${route}: broken link "${href}" (no matching page)`);
      errors++;
      continue;
    }
    if (hash) {
      const ids = await idsFor(targetFile);
      // Browsers percent-decode a URL fragment before matching it against an
      // element id, so a link generated from Unicode heading text (which
      // markdown serializes as a percent-encoded href) is not broken even
      // though the raw strings differ — decode before comparing.
      let decodedHash = hash;
      try {
        decodedHash = decodeURIComponent(hash);
      } catch {
        /* malformed percent-encoding: fall through and compare raw */
      }
      if (!ids.has(hash) && !ids.has(decodedHash)) {
        console.error(`✗ ${route}: broken anchor "${href}" (no id="${hash}" on target page)`);
        errors++;
      }
    }
  }
}

console.log(`\nChecked ${checked} internal link(s) across ${files.length} page(s).`);
if (errors > 0) {
  console.error(`${errors} broken link(s)/anchor(s) found.`);
  process.exit(1);
}
console.log("No broken internal links or anchors found.");
