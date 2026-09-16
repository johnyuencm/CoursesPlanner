export interface PageSource {
  key: string;
  url: string;
  fileName: string;
  required: boolean;
}

export type UniversityRegion = "us" | "world";
export type UniversitySupport = "unverified" | "supported" | "unsupported";

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
