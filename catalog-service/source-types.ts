export interface PageSource {
  key: string;
  url: string;
  fileName: string;
  required: boolean;
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
