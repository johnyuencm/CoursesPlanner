import type { RoadmapCrawlStatus } from "../lib/types";

export type UniversityRoadmapSummary = Omit<UniversityDirectoryEntry, "crawl"> & { status: RoadmapCrawlStatus };

export interface PageSource {
  key: string;
  url: string;
  fileName: string;
  required: boolean;
  format?: "html" | "xml";
}

export type UniversityRegion = "us" | "world";
export type UniversitySupport = "unverified" | "supported" | "unsupported";

/**
 * Known adapter ids, mirrored from the registry in catalog-service/adapters.ts.
 * The read-only directory parser cannot import the adapter registry (that would
 * pull cheerio into the /api/roadmaps bundle), so a test compares this list to
 * registeredAdapters() and fails if the two drift.
 */
export const KNOWN_ADAPTER_IDS: readonly string[] = ["northeastern-acalog"];

export interface UniversityCrawlConfig {
  adapter: string;
  discoverySource: PageSource;
  requestDelayMs: number;
  robotsUrl?: string;
  allowedOrigins: string[];
}

export interface UniversityDirectoryEntry {
  id: string;
  university: string;
  region: UniversityRegion;
  priority: number;
  catalogUrl: string;
  support: UniversitySupport;
  enabled: boolean;
  crawl?: UniversityCrawlConfig;
}

export interface CatalogSourceDefinition {
  id: string;
  university: string;
  program: string;
  adapter: string;
  enabled: boolean;
  pollIntervalMs: number;
  requestDelayMs: number;
  cacheTtlMs: number;
  requestTimeoutMs: number;
  userAgent: string;
  robotsUrl?: string;
  allowedOrigins: string[];
  disallowedPathPatterns: string[];
  programSource: PageSource;
  subjectSources: Record<string, PageSource>;
  storage?: {
    rawDir?: string;
    catalogFile?: string;
    coursesFile?: string;
    requirementsFile?: string;
  };
}
