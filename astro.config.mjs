// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";

// The production origin is unknown yet (see site/README.md "Before going
// public") — SITE_URL is the single place that changes once one exists.
const SITE_URL = process.env.SITE_URL || "https://kankaku.example";

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  trailingSlash: "never",
  server: { port: 4321 },
  i18n: {
    locales: ["es", "en", "ja"],
    defaultLocale: "es",
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [sitemap(), mdx()],
});
