// Server helpers for the program routes under app/[universityId]/[programId] (#71).
import { notFound } from "next/navigation";
import { readCatalog } from "./catalog";
import { CATALOGS } from "./catalog-key";
import { programRoutes } from "./routes";

export type ProgramParams = { universityId: string; programId: string };

/** Route params of every published program. Unknown programs are a 404 (`dynamicParams = false`). */
export function programParams(): ProgramParams[] {
  return Object.keys(CATALOGS).map((key) => {
    const [universityId = "", programId = ""] = key.split("/");
    return { universityId, programId };
  });
}

/** Catalog key, catalog and page paths of the program in the URL. An unknown program calls notFound(). */
export async function readProgram(params: Promise<ProgramParams>) {
  const { universityId, programId } = await params;
  const key = `${universityId}/${programId}`;
  if (!Object.hasOwn(CATALOGS, key)) notFound();
  // ponytail: every catalog key serves the default catalog today (CATALOGS has one entry).
  return { key, catalog: await readCatalog(), routes: programRoutes(key) };
}
