import type { Course, DegreeRequirement } from "../lib/types";
import { buildCourseGraph, parseCourses, parseProgramRequirements } from "../scraper/parser";

export interface CatalogAdapter {
  id: string;
  parseProgram(html: string, officialUrl: string, lastUpdated: string): DegreeRequirement;
  parseCourses(html: string, pageUrl: string): Course[];
  buildGraph(courses: Course[], requirements: DegreeRequirement): Course[];
}

const northeasternAcalog: CatalogAdapter = {
  id: "northeastern-acalog",
  parseProgram: parseProgramRequirements,
  parseCourses,
  buildGraph: buildCourseGraph,
};

const adapters: Record<string, CatalogAdapter> = {
  [northeasternAcalog.id]: northeasternAcalog,
};

export function getAdapter(id: string): CatalogAdapter {
  const adapter = adapters[id];
  if (!adapter) {
    throw new Error(
      `No catalog adapter registered for "${id}". Add an adapter in catalog-service/adapters.ts, then point a source JSON file at it.`,
    );
  }
  return adapter;
}

export function registeredAdapters(): string[] {
  return Object.keys(adapters);
}
