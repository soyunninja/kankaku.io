#!/usr/bin/env node
/**
 * Re-copies the hub app's reference screenshots (web/docs/screenshots/)
 * into site/src/assets/screenshots/ for use on the landing page and docs.
 * This site never imports across the project boundary at build time — this
 * script is the explicit, one-way copy step, run manually whenever the
 * other project's screenshots are refreshed.
 *
 * All source screenshots show only demo/seed data (Cajamar, Acme, Turismo
 * Níjar, etc. are fixtures) — never real client data.
 */
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, "..", "..", "web", "docs", "screenshots");
const outDir = path.join(here, "..", "src", "assets", "screenshots");

/**
 * Curated subset actually used by the site (dashboard, tasks, commands,
 * unassigned queue, clients). Screens the other writer is currently
 * changing (entries explorer, sessions queue, agent icons in the
 * dashboard) are deliberately NOT auto-added here even if new files
 * appear — re-review this list by hand after their work lands.
 */
const FILES = [
  "dashboard-dark.png",
  "dashboard-light.png",
  "dashboard-mobile-dark.png",
  "tasks-dark.png",
  "tasks-light.png",
  "commands-dark.png",
  "commands-light.png",
  "commands-mobile-dark.png",
  "unassigned-dark.png",
  "clients-dark.png",
];

await mkdir(outDir, { recursive: true });
let ok = 0;
for (const file of FILES) {
  try {
    await copyFile(path.join(srcDir, file), path.join(outDir, file));
    ok++;
  } catch (err) {
    console.error(`skip ${file}: ${err.message}`);
  }
}
console.log(`copied ${ok}/${FILES.length} screenshot(s) into src/assets/screenshots/`);
