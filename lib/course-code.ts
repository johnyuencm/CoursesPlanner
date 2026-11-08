/**
 * Course-code grammar per catalog adapter (#62, expand step of #60).
 *
 * - Canonical code: the key in `Course.code` (Northeastern: "CS 5800").
 * - Display code: the text that the UI shows.
 * - Slug: the `/courses/<slug>` URL segment.
 *
 * Call sites still use their own `SUBJ 1234` patterns. #68 moves them to this grammar.
 * This file has no Node or cheerio imports, so client code can use it.
 */
export interface CourseCodeGrammar {
  /** Matches exactly one canonical code. */
  readonly pattern: RegExp;
  /** Loose text (user input, URL parameter, catalog HTML) -> canonical code, or null when it is not a code. */
  normalize(input: string): string | null;
  display(canonical: string): string;
  slug(canonical: string): string;
  /** Subject part of a canonical code (per-subject catalog pages), or null when the code has none. */
  subject(canonical: string): string | null;
}

const NORTHEASTERN_LOOSE = /^([A-Z]{2,6})[\s-]*([0-9]{2,4}[A-Z]{0,2})$/i;

/** Northeastern `SUBJ 1234[A]` codes. Gives the same results as the hardcoded patterns. */
export const northeasternCodeGrammar: CourseCodeGrammar = {
  pattern: /^[A-Z]{2,6} \d{2,4}[A-Z]{0,2}$/,
  normalize(input) {
    const match = input.trim().replace(/\+/g, " ").match(NORTHEASTERN_LOOSE);
    return match ? `${match[1]!.toUpperCase()} ${match[2]!.toUpperCase()}` : null;
  },
  display: (canonical) => canonical,
  slug: (canonical) => canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  subject: (canonical) => canonical.match(/^([A-Z]{2,6}) /)?.[1] ?? null,
};

/** Keyed by adapter id (`Catalog.adapter`, `CatalogAdapter.id`). Keep in sync with catalog-service/adapters.ts. */
const grammars: Record<string, CourseCodeGrammar> = {
  "northeastern-acalog": northeasternCodeGrammar,
};

export function courseCodeGrammar(adapterId: string): CourseCodeGrammar {
  const grammar = grammars[adapterId];
  if (!grammar) throw new Error(`No course-code grammar for adapter "${adapterId}". Add it in lib/course-code.ts.`);
  return grammar;
}
