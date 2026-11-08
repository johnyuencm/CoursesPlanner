import type { MetadataRoute } from "next";
import { readCatalog } from "@/lib/catalog";
import { CATALOGS } from "@/lib/catalog-key";
import { SITE_URL, programPagePaths } from "@/lib/course-pages";
import { programRoutes } from "@/lib/routes";

/** The program picker (`/`) and every page of every published program. Plan is left out: it has no catalog text of its own. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await readCatalog(); // ponytail: every catalog key serves the default catalog today
  const lastModified = new Date(catalog.lastUpdated);
  return [{ url: `${SITE_URL}/`, lastModified }, ...Object.keys(CATALOGS).flatMap((key) => {
    const plan = programRoutes(key).plan;
    return programPagePaths(key, catalog)
      .filter((path) => path !== plan)
      .map((path) => ({ url: `${SITE_URL}${path}`, lastModified }));
  })];
}
