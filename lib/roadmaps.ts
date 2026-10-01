import { programMapCodes } from "./graph";
import type { Catalog, Course, DiscoveredProgram, ProgramRoadmap } from "./types";
import type { UniversityRoadmapSummary } from "@/lib/source-types";

export function groupUniversities<T extends { region: "us" | "world" }>(
  entries: readonly T[],
): { us: T[]; world: T[] } {
  return {
    us: entries.filter((entry) => entry.region === "us"),
    world: entries.filter((entry) => entry.region === "world"),
  };
}

export function universityStatusText(entry: UniversityRoadmapSummary): string {
  if (entry.support === "unverified") return "Unverified";
  if (entry.support === "unsupported") return "Unsupported";
  if (entry.status.status === "ready") return "Ready";
  if (entry.status.status === "unsupported") return "Unsupported";
  if (entry.status.status === "error") return "Unavailable";
  return "Queued";
}

/**
 * A university is worth selecting once it has at least one ready program (D1).
 * The overall status stays "queued" while any program is still queued, so a
 * partial local crawl must still count; production ships no data/catalogs/, so
 * every university there has `counts.ready === 0` and the selector stays hidden.
 */
export function isUniversitySelectable(entry: UniversityRoadmapSummary): boolean {
  const { status, counts } = entry.status;
  return entry.support === "supported" && status !== "unsupported" && status !== "error" && counts.ready > 0;
}

export function programStatusText(program: DiscoveredProgram): string {
  switch (program.status) {
    case "ready":
      return "Ready";
    case "queued":
      return "Queued";
    case "unverified":
      return "Unverified";
    case "unsupported":
      return "Unsupported";
    case "error":
      return "Unavailable";
  }
}

export function isProgramSelectable(program: DiscoveredProgram): boolean {
  return program.status === "ready";
}

export function programDisplayName(program: Pick<DiscoveredProgram, "id" | "name">): string {
  const name = program.name?.trim();
  if (name) return name;
  const readableId = program.id
    .replace(/-[a-f0-9]{10}$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return readableId ? readableId.replace(/\b\w/g, (character) => character.toUpperCase()) : "Unnamed program";
}

export function sortPrograms(programs: readonly DiscoveredProgram[]): DiscoveredProgram[] {
  return [...programs].sort(
    (left, right) =>
      Number(!isProgramSelectable(left)) - Number(!isProgramSelectable(right)) ||
      programDisplayName(left).localeCompare(programDisplayName(right), undefined, { numeric: true, sensitivity: "base" }) ||
      left.id.localeCompare(right.id, undefined, { numeric: true }),
  );
}

export function resolveGraphCourses(
  catalog: Catalog | null,
  roadmap: ProgramRoadmap | null,
): Course[] {
  return roadmap ? roadmap.courses : (catalog?.courses ?? []);
}

export function resolveProgramScope(
  catalog: Catalog | null,
  roadmap: ProgramRoadmap | null,
): Set<string> {
  if (roadmap) return new Set(roadmap.programCourseCodes);
  return catalog ? programMapCodes(catalog.courses, catalog.requirements) : new Set<string>();
}

export function roadmapFocusCourse(roadmap: ProgramRoadmap): string {
  return roadmap.programCourseCodes[0] ?? "";
}

export function roadmapProgramLabel(roadmap: ProgramRoadmap | null): string {
  return roadmap ? roadmap.program : "MSCS Seattle";
}
