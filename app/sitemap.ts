import type { MetadataRoute } from "next";
import pathwayConfig from "@/config/pathways.json";
import { readCatalog } from "@/lib/catalog";
import { SITE_URL, courseSlug, publicCourses } from "@/lib/course-pages";
import { routes } from "@/lib/routes";
import type { Pathway } from "@/lib/types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await readCatalog();
  const lastModified = new Date(catalog.lastUpdated);
  const paths = [
    routes.overview, routes.explore, routes.courses, routes.paths,
    ...publicCourses(catalog).map((course) => `/courses/${courseSlug(course.code)}`),
    ...(pathwayConfig as Pathway[]).map((pathway) => `/pathways/${pathway.id}`),
  ];
  return paths.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}`, lastModified }));
}
