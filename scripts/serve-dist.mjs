// Minimal static server for the BUILT site, used by the Playwright suite.
// `astro preview` refuses to start while another Astro server of this project
// is running (single-instance guard), which is the normal situation while
// someone has `pnpm dev`/`pnpm preview` open — and testing against THAT server
// would test the dev toolbar, not the build. No dependencies on purpose.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 4399);
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};

async function fileFor(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const target = resolve(root, safe);
  if (target !== root && !target.startsWith(root + sep)) return undefined; // no traversal
  for (const candidate of [target, join(target, "index.html"), `${target}.html`]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch { /* try the next candidate */ }
  }
  return undefined;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  let file = await fileFor(pathname);
  let status = 200;
  if (!file) {
    // Localised 404 pages live at /<locale>/404/index.html; fall back to the root one.
    const locale = pathname.split("/")[1];
    file = (await fileFor(`/${locale}/404`)) ?? (await fileFor("/404.html"));
    status = 404;
  }
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    return;
  }
  res.writeHead(status, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
}).listen(port, "127.0.0.1", () => console.log(`serving ${root} on http://localhost:${port}`));
