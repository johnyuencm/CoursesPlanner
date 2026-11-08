/**
 * Course-code grammar per catalog adapter (#62, #68).
 *
 * - Canonical code: the key in `Course.code` (Northeastern: "CS 5800").
 * - Display code: the text that the UI shows.
 * - Slug: the `/courses/<slug>` URL segment.
 *
 * Every course-code check (catalog trust boundary, plan validation, route parsing,
 * target-path parsing, scraper, adapter, registry) gets its pattern from here.
 * Do not write a course-code pattern in another file.
 * This file has no Node or cheerio imports, so client code can use it.
 */
import { CATALOGS, DEFAULT_CATALOG_KEY, canonicalCatalogKey } from "./catalog-key";

export interface CourseCodeGrammar {
  /** Matches exactly one canonical code. */
  readonly pattern: RegExp;
  /**
   * Finds a code inside free text (catalog HTML, prerequisite text). Not anchored, no capture groups,
   * case-insensitive. Give the matched text to `normalize` to get the canonical code.
   */
  readonly textPattern: RegExp;
  /** Matches exactly one subject key (`subjectSources` keys in catalog source files). */
  readonly subjectPattern: RegExp;
  /** Loose text (user input, URL parameter, catalog HTML) -> canonical code, or null when it is not a code. */
  normalize(input: string): string | null;
  display(canonical: string): string;
  slug(canonical: string): string;
  /** Subject part of a canonical code (per-subject catalog pages), or null when the code has none. */
  subject(canonical: string): string | null;
}

const NORTHEASTERN_LOOSE = /^([A-Z]{2,6})[\s-]*([0-9]{2,4}[A-Z]{0,2})$/i;

/** Northeastern `SUBJ 1234[A]` codes. */
export const northeasternCodeGrammar: CourseCodeGrammar = {
  pattern: /^[A-Z]{2,6} \d{2,4}[A-Z]{0,2}$/,
  textPattern: /\b[A-Z]{2,6}\s+\d{2,4}[A-Z]{0,2}\b/i,
  subjectPattern: /^[A-Z]{2,6}$/,
  normalize(input) {
    const match = input.trim().replace(/\+/g, " ").match(NORTHEASTERN_LOOSE);
    return match ? `${match[1]!.toUpperCase()} ${match[2]!.toUpperCase()}` : null;
  },
  display: (canonical) => canonical,
  slug: (canonical) => canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  subject: (canonical) => canonical.match(/^([A-Z]{2,6}) /)?.[1] ?? null,
};

/**
 * Keyed by adapter id (`Catalog.adapter`, `CatalogAdapter.id`). This is the one list of adapter ids:
 * `KNOWN_ADAPTER_IDS` comes from it, and a test checks it against catalog-service/adapters.ts.
 */
const grammars: Record<string, CourseCodeGrammar> = {
  "northeastern-acalog": northeasternCodeGrammar,
};

export const KNOWN_ADAPTER_IDS: readonly string[] = Object.keys(grammars);

/** Adapter of a snapshot that has no `adapter` field (v1 Northeastern snapshots). */
export const DEFAULT_ADAPTER_ID = "northeastern-acalog";

export function courseCodeGrammar(adapterId: string): CourseCodeGrammar {
  if (!Object.hasOwn(grammars, adapterId)) {
    throw new Error(`No course-code grammar for adapter "${adapterId}". Add it in lib/course-code.ts.`);
  }
  return grammars[adapterId]!;
}

/**
 * Grammar of the active catalog (or roadmap). An unknown adapter throws.
 *
 * With no catalog (the plan and pathway edits load from LocalStorage before the catalog)
 * or no `adapter` field, the adapter comes from the catalog key of that storage (#69).
 * ponytail: `CATALOGS` in lib/catalog-key.ts is a hand-written list with one entry; an unknown key throws.
 * Read it from the snapshot manifest when a second full catalog ships.
 */
export function catalogCodeGrammar(
  catalog?: { adapter?: string } | null,
  catalogKey: string = DEFAULT_CATALOG_KEY,
): CourseCodeGrammar {
  if (catalog?.adapter !== undefined) return courseCodeGrammar(catalog.adapter);
  const key = canonicalCatalogKey(catalogKey);
  if (!key) throw new Error(`Unknown catalog key "${catalogKey}". Add it in lib/catalog-key.ts.`);
  return courseCodeGrammar(CATALOGS[key]!.adapter);
}
