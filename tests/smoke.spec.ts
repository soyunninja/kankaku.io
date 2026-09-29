import { test, expect, type Page } from "@playwright/test";

// Mirrors playwright.config.ts's own origin so tests below that need a
// fresh browser context (a different navigator locale, empty storage) can
// build an absolute URL: browser.newContext() does not inherit `use.baseURL`.
const PORT = Number(process.env.SITE_TEST_PORT ?? 4399);
const ORIGIN = `http://localhost:${PORT}`;

const LOCALES: { code: string; home: string; guide: string; lang: string }[] = [
  { code: "en", home: "/", guide: "/docs/guide", lang: "en" },
  { code: "es", home: "/es", guide: "/es/docs/guide", lang: "es" },
  { code: "ja", home: "/ja", guide: "/ja/docs/guide", lang: "ja" },
];

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

for (const locale of LOCALES) {
  test.describe(`locale: ${locale.code}`, () => {
    test(`home renders with correct <html lang> and no console errors`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await page.goto(locale.home);
      await expect(page.locator("html")).toHaveAttribute("lang", locale.lang);
      await expect(page.locator("h1")).toBeVisible();
      expect(errors, `console errors: ${errors.join("; ")}`).toEqual([]);
    });

    test(`theme defaults to dark and the toggle persists a choice`, async ({ page }) => {
      await page.goto(locale.home);
      // Default (system, no explicit choice) should resolve to dark in this
      // test environment's color scheme (Playwright defaults to light
      // unless colorScheme is set) OR follow prefers-color-scheme; what we
      // actually assert is the *mechanism*: picking "Light" explicitly
      // persists across reload.
      await page.locator("[data-theme-toggle] summary").click();
      await page.locator('[data-theme-toggle] button[data-theme-value="dark"]').click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

      await page.locator("[data-theme-toggle] summary").click();
      await page.locator('[data-theme-toggle] button[data-theme-value="light"]').click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    });

    test(`language switch keeps the same page`, async ({ page }) => {
      await page.goto(locale.guide);
      await page.locator("[data-lang-switcher] summary").click();
      await page.locator('[data-lang-switcher] a[hreflang="es"]').click();
      await expect(page).toHaveURL(/\/es\/docs\/guide$/);
      await expect(page.locator("h1")).toBeVisible();
    });

    test(`CLI navigation opens the localized docs page`, async ({ page }) => {
      await page.goto(locale.home);
      const cliPath = `${locale.home === "/" ? "" : locale.home}/docs/cli`;
      await page.locator(`.primary-nav a[href="${cliPath}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${cliPath}$`));
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(`.primary-nav a[href="${cliPath}"]`)).toHaveAttribute("aria-current", "page");
    });

    test(`home shows one CLI quick start and an illustrative today transcript`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(locale.home);

      const commands = "npm install -g kankaku\nkankaku setup";
      const quickStart = page.locator(".quick-start");
      await expect(quickStart).toHaveCount(1);
      const button = quickStart.locator("[data-copy-btn]");
      await expect(button).toHaveCount(1);
      await expect(button).toHaveAttribute("data-copy-text", commands);
      await expect(quickStart.locator("pre code")).toHaveText(commands);
      expect((await quickStart.locator("pre code").innerText()).split("\n")).toEqual(commands.split("\n"));
      await button.click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(commands);

      await expect(page.locator(`.hero__guide-link a[href="${locale.guide}#install"]`)).toBeVisible();
      await expect(page.locator("[data-install-command]")).toHaveCount(0);
      const terminal = page.locator("[data-terminal-hero]");
      await expect(terminal.locator(".cmd-block__label")).toHaveText("kankaku");
      const transcript = (await terminal.locator("[data-terminal-body]").innerText()).split("\n");
      expect(transcript).toEqual([
        "$ kankaku today",
        "site  tasks 3  wall 32m  work 24m  wait 8m  $0.82",
        "total  tasks 3  wall 32m  work 24m  wait 8m  $0.82",
      ]);
    });

    test(`copy button copies command text`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto(locale.home);
      const btn = page.locator("[data-copy-btn]").first();
      const expectedText = await btn.getAttribute("data-copy-text");
      await btn.click();
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(expectedText);
    });

    test(`demo section shows the live demo URL and login, and the hub is never "coming soon"`, async ({ page }) => {
      await page.goto(locale.home);
      const demoSection = page.locator("#demo");
      await expect(demoSection.locator('a[href="https://demo.kankaku.io"]').first()).toBeVisible();
      await expect(demoSection).toContainText("demo@kankaku.io");
      await expect(demoSection).toContainText("demokankaku");

      const bodyText = await page.locator("body").innerText();
      for (const phrase of ["Coming soon", "Próximamente", "近日公開"]) {
        expect(bodyText, `found "${phrase}" on ${locale.home}`).not.toContain(phrase);
      }
    });

    for (const width of [390, 768, 1280, 1440]) {
      test(`responsive guide, CLI and commands at ${width}px`, async ({ page, context }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(locale.home);
        const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(homeOverflow, `${locale.home} at ${width}px: document overflow`).toBeLessThanOrEqual(1);
        for (const path of [locale.guide, `${locale.home === "/" ? "" : locale.home}/docs/cli`, `${locale.home === "/" ? "" : locale.home}/docs/commands`]) {
          await page.goto(path);
          await expect(page.locator("h1")).toBeVisible();
          const layout = await page.evaluate(() => {
            const controls = [
              ...document.querySelectorAll<HTMLElement>(
                ".site-header .brand, .site-header .primary-nav a, [data-lang-switcher] summary, [data-theme-toggle] summary",
              ),
            ];
            return {
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              controls: controls.map((element) => {
                const rect = element.getBoundingClientRect();
                return { visible: rect.width > 0 && rect.height > 0, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
              }),
            };
          });
          expect(layout.overflow, `${path} at ${width}px: document overflow`).toBeLessThanOrEqual(1);
          expect(layout.controls, `${path}: missing header controls`).toHaveLength(7);
          for (const [index, control] of layout.controls.entries()) {
            expect(control.visible, `${path}: header control ${index} hidden`).toBe(true);
            expect(control.left, `${path}: header control ${index} offscreen`).toBeGreaterThanOrEqual(0);
            expect(control.right, `${path}: header control ${index} offscreen`).toBeLessThanOrEqual(width + 1);
            for (const other of layout.controls.slice(index + 1)) {
              const overlaps = control.left < other.right && other.left < control.right && control.top < other.bottom && other.top < control.bottom;
              expect(overlaps, `${path}: header controls overlap at ${width}px`).toBe(false);
            }
          }

          if (path === locale.guide && width === 390) {
            const table = page.locator(".env-table-wrap");
            await expect(table).toBeVisible();
            const reach = await table.evaluate((element) => {
              element.scrollLeft = element.scrollWidth;
              const viewport = element.getBoundingClientRect();
              const lastCell = element.querySelector("tbody tr:last-child td:last-child")?.getBoundingClientRect();
              return {
                scrollable: element.scrollWidth > element.clientWidth,
                reachedEnd: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
                lastCellVisible: !!lastCell && lastCell.left < viewport.right && lastCell.right > viewport.left,
              };
            });
            expect(reach, `${path}: mobile environment table is not reachable`).toEqual({
              scrollable: true, reachedEnd: true, lastCellVisible: true,
            });
          }

          if (path.endsWith("/docs/commands")) {
            const rows = page.locator("[data-commands-item]");
            expect(await rows.count()).toBeGreaterThan(0);
            for (const row of await rows.all()) {
              const syntax = row.locator(".commands-row__syntax");
              const description = row.locator(".commands-row__desc");
              const copy = row.locator("[data-copy-btn]");
              await expect(syntax).toBeVisible();
              await expect(description).toBeVisible();
              await expect(copy).toBeVisible();
              const text = (await syntax.textContent())?.trim();
              expect(text).toBeTruthy();
              expect((await description.textContent())?.trim()).toBeTruthy();
              await expect(copy).toHaveAttribute("data-copy-text", text!);
            }

            if (width === 390 || width === 1280) {
              const exportRow = rows.filter({ has: page.locator('.commands-row__syntax:text-is("/kankaku export [csv|json] [all]")') });
              await expect(exportRow).toHaveCount(1);
              const syntax = exportRow.locator(".commands-row__syntax");
              const innerOverflow = await syntax.evaluate((element) => element.scrollWidth - element.clientWidth);
              expect(innerOverflow, `${path} at ${width}px: export syntax scrolls internally`).toBeLessThanOrEqual(1);
              const copy = exportRow.locator("[data-copy-btn]");
              await expect(copy).toHaveAttribute("data-copy-text", "/kankaku export [csv|json] [all]");
              await copy.click();
              const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
              expect(clipboardText).toBe("/kankaku export [csv|json] [all]");
              await expect(copy).toHaveAttribute("data-copied", "true");
            }
          }
        }
      });
    }
  });
}

test.describe("install command switcher (InstallCommand)", () => {
  test("defaults to the pi tab and shows the pi install command", async ({ page }) => {
    await page.goto("/docs/guide");
    const root = page.locator("[data-install-command]");
    await expect(root).toHaveCount(1);
    await expect(root.locator('[data-install-tab="pi"]')).toHaveAttribute("aria-selected", "true");
    await expect(root.locator('[data-install-tab="gentle-shell"]')).toHaveAttribute("aria-selected", "false");
    await expect(root.locator("[data-install-command-text]")).toHaveText("pi install npm:kankaku-pi");
    await expect(root.locator("[data-install-hint]")).toBeHidden();
  });

  test("clicking gentle-shell switches the guide command and shows the hint", async ({ page }) => {
    await page.goto("/docs/guide");
    const root = page.locator("[data-install-command]");
    await expect(root).toHaveCount(1);
    await root.locator('[data-install-tab="gentle-shell"]').click();
    await expect(root.locator('[data-install-tab="gentle-shell"]')).toHaveAttribute("aria-selected", "true");
    await expect(root.locator("[data-install-command-text]")).toHaveText("gentle-shell install npm:kankaku-pi");
    await expect(root.locator("[data-install-hint]")).toBeVisible();
  });

  test("the copy button then copies the gentle-shell command", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/docs/guide");
    const root = page.locator("[data-install-command]");
    await expect(root).toHaveCount(1);
    await root.locator('[data-install-tab="gentle-shell"]').click();
    const btn = root.locator("[data-copy-btn]");
    await expect(btn).toHaveAttribute("data-copy-text", "gentle-shell install npm:kankaku-pi");
    await btn.click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe("gentle-shell install npm:kankaku-pi");
  });

  test("the choice persists across reload", async ({ page }) => {
    await page.goto("/docs/guide");
    const root = page.locator("[data-install-command]");
    await expect(root).toHaveCount(1);
    await root.locator('[data-install-tab="gentle-shell"]').click();
    await page.reload();
    await expect(root).toHaveCount(1);
    await expect(root.locator('[data-install-tab="gentle-shell"]')).toHaveAttribute("aria-selected", "true");
    await expect(root.locator("[data-install-command-text]")).toHaveText("gentle-shell install npm:kankaku-pi");
  });
});

test("404 page renders for an unknown route", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toContainText("command not found");
});

test("commands filter narrows the list", async ({ page }) => {
  await page.goto("/docs/commands");
  const before = await page.locator("[data-commands-item]:visible").count();
  await page.locator("[data-commands-filter]").fill("export");
  const after = await page.locator("[data-commands-item]:visible").count();
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThan(0);
});

const SITE_ORIGIN = "https://kankaku.io";
const EQUIVALENT_PAGES = [
  { en: "/", es: "/es", ja: "/ja" },
  { en: "/docs/guide", es: "/es/docs/guide", ja: "/ja/docs/guide" },
  { en: "/docs/cli", es: "/es/docs/cli", ja: "/ja/docs/cli" },
  { en: "/docs/commands", es: "/es/docs/commands", ja: "/ja/docs/commands" },
] as const;
const canonicalUrl = (path: string) => new URL(path, SITE_ORIGIN).toString();

test("SEO: canonical and reciprocal hreflang targets match all twelve equivalent pages", async ({ page }) => {
  for (const family of EQUIVALENT_PAGES) {
    const alternates = {
      en: canonicalUrl(family.en),
      es: canonicalUrl(family.es),
      ja: canonicalUrl(family.ja),
      "x-default": canonicalUrl(family.en),
    };
    // Checking the complete set on every member proves reciprocity, not just
    // that one language links outward to its translations.
    for (const path of Object.values(family)) {
      await page.goto(path);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonicalUrl(path));
      const links = page.locator('link[rel="alternate"][hreflang]');
      await expect(links).toHaveCount(4);
      for (const [lang, target] of Object.entries(alternates)) {
        // Select by hreflang to reject duplicate or unexpected alternates.
        const alternate = page.locator(`link[rel="alternate"][hreflang="${lang}"]`);
        await expect(alternate).toHaveCount(1);
        await expect(alternate).toHaveAttribute("href", target);
      }
    }
  }
});

test("SEO: titles and descriptions are unique across indexable pages, and JSON-LD parses", async ({ page }) => {
  // The 404 pages intentionally share one title across locales (noindex).
  const indexablePaths = EQUIVALENT_PAGES.flatMap((family) => Object.values(family));

  const titles: string[] = [];
  const descriptions: string[] = [];

  for (const path of indexablePaths) {
    await page.goto(path);
    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(title.trim(), `${path}: blank title`).not.toBe("");
    expect(title.length, `${path}: title too long`).toBeLessThanOrEqual(60);
    expect(description?.trim(), `${path}: blank or missing description`).toBeTruthy();
    expect(description!.length, `${path}: description too long`).toBeLessThanOrEqual(160);
    titles.push(title);
    descriptions.push(description!);

    const ldJson = await page.locator('script[type="application/ld+json"]').textContent();
    expect(ldJson, `${path}: missing ld+json`).not.toBeNull();
    expect(() => JSON.parse(ldJson as string), `${path}: ld+json does not parse`).not.toThrow();
  }

  expect(new Set(titles).size, `duplicate titles: ${titles.join(" | ")}`).toBe(titles.length);
  expect(new Set(descriptions).size, `duplicate descriptions: ${descriptions.join(" | ")}`).toBe(descriptions.length);
});

test("SEO: generated sitemap contains all twelve canonical URLs and robots advertises its index", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap-index.xml`);

  const index = await request.get("/sitemap-index.xml");
  expect(index.ok()).toBe(true);
  const sitemapPaths = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
    const url = new URL(match[1]);
    expect(url.origin).toBe(SITE_ORIGIN);
    return url.pathname;
  });
  expect(sitemapPaths.length, "sitemap index has no child sitemaps").toBeGreaterThan(0);

  const urls = new Set<string>();
  for (const path of sitemapPaths) {
    const sitemap = await request.get(path);
    expect(sitemap.ok(), `${path}: missing sitemap`).toBe(true);
    for (const [, url] of (await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(url);
  }
  for (const family of EQUIVALENT_PAGES) {
    for (const path of Object.values(family)) {
      expect(urls.has(canonicalUrl(path)), `${path}: canonical URL missing from sitemap`).toBe(true);
    }
  }
});

test("i18n: <html lang> is correct at the root and under /es", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("i18n: x-default hreflang always points at the English URL", async ({ page }) => {
  for (const path of ["/", "/es", "/ja", "/es/docs/guide", "/ja/docs/guide", "/docs/cli", "/es/docs/cli", "/ja/docs/cli"]) {
    await page.goto(path);
    const href = await page.locator('link[rel="alternate"][hreflang="x-default"]').getAttribute("href");
    expect(href, `${path}: missing x-default hreflang`).not.toBeNull();
    expect(new URL(href as string).pathname, `${path}: x-default does not point at the English URL`).toBe(
      path.replace(/^\/(es|ja)(\/|$)/, "/").replace(/\/$/, "") || "/",
    );
  }
});

test("i18n redirect: es-ES browser locale with empty storage redirects / to /es", async ({ browser }) => {
  const context = await browser.newContext({ locale: "es-ES" });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/`);
  await page.waitForURL(/\/es$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await context.close();
});

test("i18n redirect: an explicit kankaku-lang=en choice is never overridden", async ({ browser }) => {
  const context = await browser.newContext({ locale: "es-ES" });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("kankaku-lang", "en"));
  await page.goto(`${ORIGIN}/`);
  await expect(page).toHaveURL(`${ORIGIN}/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await context.close();
});

test("i18n redirect: visiting /es directly under a ja-JP browser locale does not redirect", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ja-JP" });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/es`);
  await expect(page).toHaveURL(`${ORIGIN}/es`);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await context.close();
});
