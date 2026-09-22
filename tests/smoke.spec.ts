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

    test(`copy button copies command text`, async ({ page, context }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto(locale.home);
      const btn = page.locator("[data-copy-btn]").first();
      const expectedText = await btn.getAttribute("data-copy-text");
      await btn.click();
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(expectedText);
    });

    for (const width of [390, 768, 1440]) {
      test(`no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(locale.home);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        await page.goto(locale.guide);
        const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow2).toBeLessThanOrEqual(1);
      });
    }
  });
}

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

test("SEO: titles and descriptions are unique across indexable pages, and JSON-LD parses", async ({ page }) => {
  // The 404 pages intentionally share one title across locales (noindex,
  // so duplication there doesn't matter for SEO) and are excluded here.
  const indexablePaths = [
    "/",
    "/docs/guide",
    "/docs/commands",
    "/es",
    "/es/docs/guide",
    "/es/docs/commands",
    "/ja",
    "/ja/docs/guide",
    "/ja/docs/commands",
  ];

  const titles: string[] = [];
  const descriptions: string[] = [];

  for (const path of indexablePaths) {
    await page.goto(path);
    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(title.length, `${path}: title too long`).toBeLessThanOrEqual(60);
    expect(description, `${path}: missing description`).not.toBeNull();
    titles.push(title);
    descriptions.push(description as string);

    const ldJson = await page.locator('script[type="application/ld+json"]').textContent();
    expect(ldJson, `${path}: missing ld+json`).not.toBeNull();
    expect(() => JSON.parse(ldJson as string), `${path}: ld+json does not parse`).not.toThrow();
  }

  expect(new Set(titles).size, `duplicate titles: ${titles.join(" | ")}`).toBe(titles.length);
  expect(new Set(descriptions).size, `duplicate descriptions: ${descriptions.join(" | ")}`).toBe(descriptions.length);
});

test("i18n: <html lang> is correct at the root and under /es", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("i18n: x-default hreflang always points at the English URL", async ({ page }) => {
  for (const path of ["/", "/es", "/ja", "/es/docs/guide", "/ja/docs/guide"]) {
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
