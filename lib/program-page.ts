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

/** College and program name from the snapshot, for titles and descriptions: "<university> <program>". */
export function programName(catalog: Pick<Catalog, "university" | "program" | "requirements">): string {
  return [catalog.university, catalog.program ?? catalog.requirements.name].filter(Boolean).join(" ");
}

/** Catalog key, catalog, display name and page paths of the program in the URL. An unknown program calls notFound(). */
export async function readProgram(params: Promise<ProgramParams>) {
  const { universityId, programId } = await params;
  const key = `${universityId}/${programId}`;
  if (!Object.hasOwn(CATALOGS, key)) notFound();
  const catalog = await readProgramCatalog(key);
  return { key, catalog, name: programName(catalog), routes: programRoutes(key) };
}
