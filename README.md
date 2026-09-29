# kankaku site

Public, developer-facing site for **kankaku 1.2.0**: the CLI, pi extension,
Claude Code integration, and optional hub. Astro static output, with three
locales (en default, es, ja). This is a standalone site project.

## Stack

- **Astro 7**, TypeScript strict, `astro:content` collections + MDX.
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

```sh
pnpm install
pnpm dev            # http://localhost:4321
```

## Build & preview

```sh
pnpm build
pnpm preview
```

## Tests

```sh
pnpm run i18n:check       # es/en/ja key parity (ui.ts, docs pages, commands data)
pnpm run og:check         # localized OG copy and generated PNG bytes
pnpm build && pnpm run links:check   # build includes og:check; verify internal links/anchors
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

Each locale has Home plus three docs pages: **Guide**, **CLI**, and
**Commands** (`src/content/docs/<locale>/{guide,cli,commands}.mdx`). Commands
is the pi `/kankaku` reference, rendered from `src/data/kankaku-commands.ts`
and `src/data/commands-i18n/<locale>.json`; the CLI has its own page. Add a
section with a stable `id` to the existing page when the topic belongs there.
A new docs slug needs an MDX file in all three locales and a navigation link.
Keep `DOC_SLUGS` in `src/consts.ts` and the smoke/a11y page sets in sync.

## Adding a locale

1. Add the locale to `LOCALES` in `src/consts.ts` and `astro.config.mjs`'s `i18n.locales`.
2. Add a block to every locale object in `src/i18n/ui.ts` (the build-time
   check fails if keys don't match across locales).
3. Add `src/content/docs/<locale>/{guide,cli,commands}.mdx`.
4. Add a `src/data/commands-i18n/<locale>.json`.
5. Add a `src/pages/<locale>/index.astro`, `404.astro`, `docs/[slug].astro`
   (copy an existing non-default locale's three files, change the locale
   prop / collection name). The default locale's three files instead live
   unprefixed at `src/pages/{index,404,docs/[slug]}.astro` — see "Locale
   routing" below.
6. Run `pnpm run i18n:check`.

## Locale routing and the first-visit redirect

English is the default locale and is unprefixed: `/`, `/docs/guide`,
`/docs/cli`, `/docs/commands`. Spanish lives under `/es/...`, Japanese under
`/ja/...`.
`src/i18n/utils.ts#localizePath` and everything that derives from
`DEFAULT_LOCALE` (canonical URLs, hreflang alternates, `x-default` — always
the English URL — `og:locale`, JSON-LD `inLanguage`, the sitemap) follow
this automatically; content collections keep their existing per-locale
folders (`src/content/docs/{en,es,ja}`), only routing changed.

A tiny inline script in `BaseLayout.astro` (`is:inline`, no dependencies)
redirects a first-time visitor on an English page to `/es` or `/ja` when
their browser's preferred language is Spanish or Japanese:

```js
(function () {
  var KEY = "kankaku-lang";
  var lang = document.documentElement.lang;
  try {
    if (lang !== "en") {
      localStorage.setItem(KEY, lang); // direct /es or /ja visit: that IS the choice
      return;
    }
    if (localStorage.getItem(KEY)) return; // explicit choice already made: never override it
    var langs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var l = (langs[i] || "").slice(0, 2).toLowerCase();
      if (l === "es" || l === "ja") {
        location.replace("/" + l + (location.pathname === "/" ? "" : location.pathname));
      }
      if (l === "es" || l === "ja" || l === "en") return; // first es/ja/en entry decides it
    }
  } catch (e) {
    /* private browsing / blocked storage: skip the redirect */
  }
})();
```

Rules:

- Runs once, only on English (root) pages; a URL that already has a locale
  prefix (`/es/...`, `/ja/...`) is never redirected.
- `localStorage["kankaku-lang"]` is the record of an explicit choice. It is
  set when the visitor lands directly on `/es` or `/ja` (they chose by
  URL), and when they click a `LangSwitcher` link (`src/components/
  LangSwitcher.astro`, before navigation happens). Once set, the redirect
  never runs again for that browser.
- Anything else (browser language is `en`, or doesn't match `es`/`ja`/`en`
  at all) does nothing — the visitor stays on the English page.

This is client-side only, so it cannot help a crawler or a JS-disabled
visitor land on the right locale; a host that wants that can add a
server-side `Accept-Language` redirect for `/` only (never for `/es` or
`/ja`, which are explicit). Example, nginx, entirely optional:

```nginx
# Optional: redirect first-time "/" visits by Accept-Language. Client-side
# localStorage still wins after that — this only helps the very first
# request (crawlers, JS disabled). Never applies to /es or /ja, which are
# explicit already.
map $http_accept_language $kankaku_lang_redirect {
    default       "";
    ~*^es         /es;
    ~*^ja         /ja;
}

server {
    location = / {
        if ($kankaku_lang_redirect) {
            return 302 $kankaku_lang_redirect;
        }
        try_files /index.html =404;
    }
}
```

## Demo content

The home page links to the read-only hub at `https://demo.kankaku.io` instead
of embedding hub screenshots. Demo credentials and the hub source link are
centralized in `src/consts.ts`. Keep any future screenshot or example data
fictional, and verify its alternative text if displayed.

## Rebuilding the font subset

```sh
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

```sh
node scripts/generate-og-images.mjs
```

## Deploying

Static output (`dist/`) — deploy anywhere that serves static files
(Netlify, Vercel, Cloudflare Pages, GitHub Pages, a plain nginx `location /`
pointed at `dist/`, PocketBase's own `publicDir`, ...). The production origin is
`https://kankaku.io` (the default `SITE_URL`, read once in
`astro.config.mjs`); set the `SITE_URL` environment variable only to build
a preview for another origin.

The hub source is public at
[github.com/soyunninja/kankaku_hub](https://github.com/soyunninja/kankaku_hub).
The Japanese copy is marked as machine-authored in the footer; have a native
speaker review it before treating the translation as final.
