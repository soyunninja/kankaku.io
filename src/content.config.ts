import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * One collection per locale so `getStaticPaths` and the i18n-completeness
 * check (scripts/check-i18n.mjs) can compare slug sets directly. Frontmatter
 * schema is intentionally small: long-form content is the markdown body,
 * not scattered frontmatter fields.
 */
const docsSchema = z.object({
  title: z.string(),
  description: z.string(),
  /** Nav order within the docs sidebar/menu. */
  order: z.number(),
  /** Set true to badge a page/section as not-yet-released content inline (in addition to inline "coming soon" prose). */
  draft: z.boolean().default(false),
});

function docsCollection(locale: string) {
  return defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: `./src/content/docs/${locale}` }),
    schema: docsSchema,
  });
}

export const collections = {
  "docs-es": docsCollection("es"),
  "docs-en": docsCollection("en"),
  "docs-ja": docsCollection("ja"),
};
