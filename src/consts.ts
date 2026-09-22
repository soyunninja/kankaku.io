/** Site-wide constants that are not per-locale strings (those live in src/i18n/). */

export const SITE_URL = process.env.SITE_URL || "https://kankaku.io";
export const SITE_NAME = "kankaku";

/** kankaku (the pi extension) facts — keep in sync with the kankaku repo. Never invent numbers here. */
export const KANKAKU = {
  version: "0.5.0",
  npmPackage: "kankaku",
  repo: "https://github.com/soyunninja/kankaku",
  repoShort: "github.com/soyunninja/kankaku",
  homepage: "https://github.com/soyunninja/kankaku#readme",
};

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

/** The site has exactly two docs pages per locale: one long-form guide, one command reference. */
export const DOC_SLUGS = ["guide", "commands"] as const;
export type DocSlug = (typeof DOC_SLUGS)[number];
