/** Site-wide constants that are not per-locale strings (those live in src/i18n/). */

export const SITE_URL = process.env.SITE_URL || "https://kankaku.io";
export const SITE_NAME = "kankaku";

/** kankaku client facts (the three packages share one version) — keep in sync with the kankaku monorepo. Never invent numbers here. */
export const KANKAKU = {
  version: "1.2.0",
  npmPackage: "kankaku-pi",
  cliPackage: "kankaku",
  claudePackage: "kankaku-claude",
  hubNpmPackage: "kankaku-hub",
  cliInstall: "npm install -g kankaku",
  repo: "https://github.com/soyunninja/kankaku",
  repoShort: "github.com/soyunninja/kankaku",
  homepage: "https://github.com/soyunninja/kankaku#readme",
};

/** The public, read-only demo of the hub — fictional data, viewer login only.
 * Keep in sync with the actual demo deployment; never invent credentials. */
export const DEMO = {
  url: "https://demo.kankaku.io",
  email: "demo@kankaku.io",
  password: "demokankaku",
};

/** The hub's own source repository (separate from the kankaku extension repo above). */
export const HUB_REPO = "https://github.com/soyunninja/kankaku_hub";

/** The npm spec every `<tool> install` command installs — single source for
 * the hero, the bottom Install section and the guide's install doc section
 * (see InstallCommand.astro, which builds "pi install <this>" and
 * "gentle-shell install <this>" from it). */
export const INSTALL_PACKAGE = "npm:kankaku-pi";

export const LOCALES = ["en", "es", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** BCP-47 tags for <html lang> and hreflang. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en",
  es: "es",
  ja: "ja",
};

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ja: "日本語",
};

/** language_TERRITORY tags for the Open Graph og:locale/og:locale:alternate meta (its own convention — distinct from the bare BCP-47 tags used by <html lang> and hreflang). */
export const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  ja: "ja_JP",
};

/** The site has exactly three docs pages per locale: guide, CLI, and pi command reference. */
export const DOC_SLUGS = ["guide", "cli", "commands"] as const;
export type DocSlug = (typeof DOC_SLUGS)[number];
