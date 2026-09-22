# kankaku site

Public, developer-facing site for **kankaku** (the pi extension) and its
optional hub. Astro, static output, no server, three locales (es default, en,
ja). Separate Astro project, not part of the `web/` app — see
[`docs/adr/`](../docs/adr) for why.

## Stack

- **Astro** (latest stable), TypeScript strict, `astro:content` collections + MDX.
- **Plain CSS** with the app's own design tokens ported as CSS custom
  properties (`src/styles/tokens.css`) — no Tailwind. Justification: this
  site is almost entirely long-form docs and a handful of static sections;
  a utility-class framework buys little here and a second build toolchain
  (Tailwind content scanning across `.astro`/`.mdx`) isn't worth it for a
  page count this small. Dark-by-default with a light/system switcher, no
  flash of wrong theme (inline head script).
- **pnpm** for package management (standalone package — not a workspace
  member of the repo root).
- Self-hosted **Nerd Font subset** (JetBrains Mono NF), ~88 KB total for
  Regular+Bold. No Google Fonts, no third-party requests — the site works
  fully offline.

## Develop

```
pnpm install
pnpm dev            # http://localhost:4321
```

## Build & preview

```
pnpm build
pnpm preview
```

## Tests

```
pnpm run i18n:check       # es/en/ja key parity (ui.ts, docs pages, commands data)
pnpm build && pnpm run links:check   # broken internal links/anchors in dist/
pnpm run test:e2e         # Playwright smoke: renders, theme, i18n, copy button, no overflow
pnpm run test:a11y        # axe-core, every page, light + dark
```

`pnpm run check` runs `astro check` (TypeScript).

The Playwright suites build the site and serve `dist/` themselves with
`scripts/serve-dist.mjs` on port 4399 (`SITE_TEST_PORT` to change it). They do
not use `astro preview`: Astro will not start a second server for this project
while `pnpm dev` is open, and testing against a dev server would test the dev
toolbar rather than the build. You can keep `pnpm dev` running while they run.

## Adding a page

There are exactly three pages per locale: Home, **Guide**
(`src/content/docs/<locale>/guide.mdx`), and **Commands**
(`src/content/docs/<locale>/commands.mdx`, rendered from
`src/data/kankaku-commands.ts` + `src/data/commands-i18n/<locale>.json`).
To add content, edit the Guide — add a section + an entry in its
`<GuideToc>` — rather than adding a new top-level page; the owner's explicit
direction is to keep the nav to Home/Guide/Commands only.

## Adding a locale

1. Add the locale to `LOCALES` in `src/consts.ts` and `astro.config.mjs`'s `i18n.locales`.
2. Add a block to every locale object in `src/i18n/ui.ts` (the build-time
   check fails if keys don't match across locales).
3. Add `src/content/docs/<locale>/{guide,commands}.mdx`.
4. Add a `src/data/commands-i18n/<locale>.json`.
5. Add a `src/pages/<locale>/index.astro`, `404.astro`, `docs/[slug].astro`
   (copy an existing locale's three files, change the locale prop / collection name).
6. Run `pnpm run i18n:check`.

## Refreshing screenshots

The home page shows hand-taken window captures of the hub
(`src/assets/screenshots/hub-*.webp`, ~1280px wide, 50–95 KB each), made
against the isolated demo stack (`scripts/isolated-stack.sh up <dir> --seed
--seed-profile rich` in the repo root), so every screen shows fictional data
only (SITE-REQ-009). To refresh: take new window captures, export as WebP,
replace the files keeping their names, and check the figure `alt` texts in
`src/components/pages/HomePage.astro` still describe them. The web app's own
full-page e2e screenshots live in `../web/docs/screenshots/` and are not used
here any more (they were several MB each).
## Rebuilding the font subset

```
# 1. Download "JetBrainsMono.zip" from
#    https://github.com/ryanoasis/nerd-fonts/releases/latest and extract
#    JetBrainsMonoNerdFontMono-{Regular,Bold}.ttf into scripts/.font-src/
node scripts/build-font.mjs
```

Only ~24 Nerd Font glyphs are actually used (see `ICONS` in
`scripts/build-font.mjs` and `src/components/icons/NerdIcon.astro` — keep
them in sync). Adding a new icon: verify the codepoint exists in the source
font first (a quick `fontkit` script, not checked in), add it to both
`ICONS` maps, then rerun `build-font.mjs`.

## Regenerating OG images

```
node scripts/generate-og-images.mjs
```

## Deploying

Static output (`dist/`) — deploy anywhere that serves static files
(Netlify, Vercel, Cloudflare Pages, GitHub Pages, a plain nginx `location /`
pointed at `dist/`, PocketBase's own `publicDir`, ...). The production origin is
`https://kankaku.io` (the default `SITE_URL`, read once in
`astro.config.mjs`); set the `SITE_URL` environment variable only to build
a preview for another origin.

## Before this goes public

- DNS for `kankaku.io` pointing at the host that serves `dist/`, with HTTPS.
- A public repo link for the hub (kankaku-hub is private today).
- Native review of the Japanese copy — flagged in the footer as
  machine-authored.
