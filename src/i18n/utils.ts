import { ui, type Locale } from "./ui";
import { DEFAULT_LOCALE, LOCALES, LOCALE_TAGS } from "../consts";

export type { Locale };

/** Locale from a request pathname, e.g. "/en/docs/guide" -> "en", "/docs/guide" -> "es" (default, unprefixed). */
export function getLocaleFromUrl(url: URL): Locale {
  const [, maybeLocale] = url.pathname.split("/");
  if (LOCALES.includes(maybeLocale as Locale)) return maybeLocale as Locale;
  return DEFAULT_LOCALE;
}

/** Bound translator for a locale: t("nav.home") -> "Inicio". Errors loudly on a missing key instead of silently falling back, so a gap is caught at build time. */
export function useTranslations(locale: Locale) {
  const dict = ui[locale];
  return function t(path: string): string {
    const parts = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = dict;
    for (const part of parts) {
      node = node?.[part];
    }
    if (typeof node !== "string") {
      throw new Error(`i18n: missing UI string "${path}" for locale "${locale}"`);
    }
    return node;
  };
}

/** Build a path for the same page in a different locale. es is unprefixed (default locale). */
export function localizePath(path: string, locale: Locale): string {
  const clean = path.replace(/^\/(es|en|ja)(\/|$)/, "/");
  if (locale === DEFAULT_LOCALE) return clean === "" ? "/" : clean;
  const withoutTrailing = clean === "/" ? "" : clean;
  return `/${locale}${withoutTrailing}` || `/${locale}`;
}

/** Strip a locale prefix (if any) from a pathname, always returning a leading-slash path. */
export function stripLocale(pathname: string): string {
  const parts = pathname.split("/");
  if (LOCALES.includes(parts[1] as Locale)) {
    const rest = "/" + parts.slice(2).join("/");
    return rest === "/" ? "/" : rest.replace(/\/$/, "") || "/";
  }
  return pathname === "" ? "/" : pathname;
}

export function htmlLang(locale: Locale): string {
  return LOCALE_TAGS[locale];
}
