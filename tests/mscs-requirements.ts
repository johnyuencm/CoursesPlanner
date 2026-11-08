import type { BreadthCategory, DegreeRequirementV2 } from "../lib/types";

/** A small v2 tree in the shape that `parseProgramRequirements` emits for MSCS Seattle. Test data only. */
export function mscsRequirements(input: {
  core: string[];
  areas: BreadthCategory[];
  electives: string[];
  breadth?: { count: number; minAreas: number; credits: number };
  electiveCredits?: number;
  totalCredits?: number;
  officialUrl?: string;
  lastUpdated?: string;
}): DegreeRequirementV2 {
  const breadth = input.breadth ?? { count: 3, minAreas: 2, credits: 12 };
  return {
    version: 2,
    name: "MSCS",
    catalogYear: "2026-2027",
    minimumGpa: 3,
    officialUrl: input.officialUrl ?? "https://example.test/program",
    uncertainties: [],
    lastUpdated: input.lastUpdated ?? "2026-09-10",
    root: {
      kind: "all",
      id: "program",
      label: "MSCS",
      rawText: "",
      children: [
        { kind: "choose-courses", id: "core", label: "Core requirements", rawText: "", count: input.core.length, courses: input.core },
        { kind: "choose-areas", id: "breadth", label: "Breadth areas", rawText: "", ...breadth, areas: input.areas },
        {
          kind: "choose-credits",
          id: "electives",
          label: "Electives",
          rawText: "",
          credits: input.electiveCredits ?? 12,
          // Breadth-area courses that breadth did not use count here too, as in the catalog.
          courses: [...new Set([...input.electives, ...input.areas.flatMap((area) => area.courses)])],
        },
        { kind: "total-credits", id: "total", label: "Total credits", rawText: "", credits: input.totalCredits ?? 32 },
      ],
    },
  };
}
