// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";

// Production origin: https://kankaku.io. SITE_URL is the single place it is
// read; override the env var only for previews on another origin.
const SITE_URL = process.env.SITE_URL || "https://kankaku.io";

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
