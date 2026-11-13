// Server helpers for the program routes under app/[universityId]/[programId] (#71).
import { notFound } from "next/navigation";
import { CATALOGS } from "./catalog-key";
import { readProgramCatalog } from "./program-catalog";
import { programRoutes } from "./routes";
import type { Catalog } from "./types";

export type ProgramParams = { universityId: string; programId: string };

/** Route params of every published program. Unknown programs are a 404 (`dynamicParams = false`). */
export function programParams(): ProgramParams[] {
  return Object.keys(CATALOGS).map((key) => {
    const [universityId = "", programId = ""] = key.split("/");
    return { universityId, programId };
  });
}

/** College and program name from the snapshot, for descriptions: "<university> <program>". */
export function programName(catalog: Pick<Catalog, "university" | "program" | "requirements">): string {
  return [catalog.university, catalog.program ?? catalog.requirements.name].filter(Boolean).join(" ");
}

/** Short name from the snapshot, for titles: "NEU MSCS Seattle" (#117). A catalog without one gives `programName`. */
export function shortName(catalog: Pick<Catalog, "shortName" | "university" | "program" | "requirements">): string {
  return catalog.shortName ?? programName(catalog);
}

/** Search results show about this many characters of a title and of a description. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;
/** A title keeps at least this many characters for its page part: the course code and the first words of the course title. */
const PAGE_MIN = 30;

/**
 * `text` with at most `max` characters. A longer text stops after a whole word and ends with "…".
 * A dangling separator or joining word goes too: "Design and…" becomes "Design…".
 */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max < 2) return max === 1 ? "…" : "";
  const end = text.lastIndexOf(" ", max - 1);
  return `${text.slice(0, end > 0 ? end : max - 1).replace(/(?:[\s,;:·—–-]|\s(?:and|or|of|for|to|in|on|with|the|a|an|&))+$/i, "")}…`;
}

/** The program name in titles. A long name (no short name, or a long one) is clipped, so the page part keeps PAGE_MIN characters. */
export function titleName(name: string): string {
  return clip(name, TITLE_MAX - " · ".length - PAGE_MIN);
}

/** Title template of the pages of one program: "<page> · <title name>". */
export function titleTemplate(name: string): string {
  return `%s · ${titleName(name)}`;
}

/** The page part of a program page title, clipped so that the full title fits in TITLE_MAX. */
export function pageTitle(page: string, name: string): string {
  return clip(page, TITLE_MAX - titleTemplate(name).replace("%s", "").length);
}

/** Catalog key, catalog, display names and page paths of the program in the URL. An unknown program calls notFound(). */
export async function readProgram(params: Promise<ProgramParams>) {
  const { universityId, programId } = await params;
  const key = `${universityId}/${programId}`;
  if (!Object.hasOwn(CATALOGS, key)) notFound();
  const catalog = await readProgramCatalog(key);
  return { key, catalog, name: programName(catalog), shortName: shortName(catalog), routes: programRoutes(key) };
}
