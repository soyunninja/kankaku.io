/** Site-wide constants that are not per-locale strings (those live in src/i18n/). */

export const SITE_URL = process.env.SITE_URL || "https://kankaku.io";
export const SITE_NAME = "kankaku";

/** kankaku (the pi extension) facts — keep in sync with the kankaku repo. Never invent numbers here. */
export const KANKAKU = {
  version: "0.4.6",
  npmPackage: "kankaku",
  repo: "https://github.com/soyunninja/kankaku",
  repoShort: "github.com/soyunninja/kankaku",
  homepage: "https://github.com/soyunninja/kankaku#readme",
};

export const LOCALES = ["es", "en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

/** BCP-47 tags for <html lang> and hreflang. */
export const LOCALE_TAGS: Record<Locale, string> = {
  es: "es",
  en: "en",
  ja: "ja",
};

export const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  en: "English",
  ja: "日本語",
};

/** The site has exactly two docs pages per locale: one long-form guide, one command reference. */
export const DOC_SLUGS = ["guide", "commands"] as const;
export type DocSlug = (typeof DOC_SLUGS)[number];
