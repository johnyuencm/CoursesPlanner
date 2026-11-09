import type { MetadataRoute } from "next";
import { CATALOGS } from "@/lib/catalog-key";
import { readProgramCatalog } from "@/lib/program-catalog";
import { SITE_URL, programPagePaths } from "@/lib/course-pages";
import { programRoutes } from "@/lib/routes";

/** The program picker (`/`) and every page of every published program. Plan is left out: it has no catalog text of its own. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const programs = await Promise.all(Object.keys(CATALOGS).map(async (key) => ({ key, catalog: await readProgramCatalog(key) })));
  const lastModified = new Date(Math.max(...programs.map(({ catalog }) => Date.parse(catalog.lastUpdated))));
  return [{ url: `${SITE_URL}/`, lastModified }, ...programs.flatMap(({ key, catalog }) => {
    const plan = programRoutes(key).plan;
    const edited = new Date(catalog.lastUpdated);
    return programPagePaths(key, catalog)
      .filter((path) => path !== plan)
      .map((path) => ({ url: `${SITE_URL}${path}`, lastModified: edited }));
  })];
}
