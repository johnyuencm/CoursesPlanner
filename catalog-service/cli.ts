import path from "node:path";
import { fileURLToPath } from "node:url";
import { json, refreshCatalog, refreshEnabledSources } from "./refresh";
import { loadUniversityDirectory } from "./registry";
import { crawlRoadmaps, findUniversity, listRoadmapUniversities, readProgramDirectory, readReadyRoadmap, type RoadmapCrawlOptions } from "./roadmaps";

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const current = path.resolve(fileURLToPath(import.meta.url));
  const invoked = path.resolve(entry);
  return process.platform === "win32" ? current.toLowerCase() === invoked.toLowerCase() : current === invoked;
}

export async function runCatalogCli(
  arguments_: string[],
  options: Omit<RoadmapCrawlOptions, "limit" | "universityId" | "retryErrors"> & { write?: (text: string) => void } = {},
): Promise<void> {
  const flags = new Map<string, string | true>();
  const switches = new Set(["--force", "--all", "--list-universities", "--list-programs", "--crawl-roadmaps", "--retry-errors"]);
  const values = new Set(["--id", "--limit", "--university", "--roadmap"]);
  for (const argument of arguments_) {
    const separator = argument.indexOf("=");
    const key = separator === -1 ? argument : argument.slice(0, separator);
    const value = separator === -1 ? true : argument.slice(separator + 1);
    if ((switches.has(key) && value !== true) || (values.has(key) && (value === true || !value)) || (!switches.has(key) && !values.has(key))) {
      throw new Error(`Unknown or invalid catalog option: ${argument}`);
    }
    if (flags.has(key)) throw new Error(`Duplicate catalog option: ${key}`);
    flags.set(key, value);
  }
  const write = options.write ?? ((text: string) => { process.stdout.write(text); });
  const rootDir = options.rootDir ?? process.cwd();
  const modes = ["--list-universities", "--list-programs", "--crawl-roadmaps", "--roadmap"].filter((key) => flags.has(key));
  if (modes.length > 1) throw new Error("Choose one roadmap command");
  const mode = modes[0];
  const universityId = flags.get("--university") as string | undefined;
  if (mode) {
    if (["--force", "--all", "--id"].some((key) => flags.has(key))) throw new Error("Catalog refresh options cannot be combined with roadmap commands");
    if (mode !== "--crawl-roadmaps" && (flags.has("--limit") || flags.has("--retry-errors"))) {
      throw new Error("--limit and --retry-errors require --crawl-roadmaps");
    }
    if (mode === "--crawl-roadmaps") {
      const limit = flags.get("--limit");
      if (typeof limit !== "string" || !/^\d+$/.test(limit)) throw new Error("--crawl-roadmaps requires --limit=<1..100>");
      write(json(await crawlRoadmaps({ ...options, universityId, limit: Number(limit), retryErrors: flags.has("--retry-errors") })));
      return;
    }
    const universities = options.universities ?? await loadUniversityDirectory(path.join(rootDir, "catalog-service", "universities.json"));
    const selected = universityId === undefined ? undefined : findUniversity(universities, universityId);
    if (mode === "--list-universities") {
      write(json({ universities: await listRoadmapUniversities(selected ? [selected] : universities, rootDir) }));
    } else {
      if (!selected) throw new Error(`${mode} requires --university=<id>`);
      write(json(mode === "--list-programs"
        ? await readProgramDirectory(selected, rootDir)
        : await readReadyRoadmap(selected, flags.get("--roadmap") as string, rootDir)));
    }
    return;
  }
  if (["--limit", "--university", "--retry-errors"].some((key) => flags.has(key))) throw new Error("Roadmap controls require a roadmap command");
  const refreshOptions = {
    rootDir, sourcesDir: path.join(rootDir, "catalog-service", "sources"),
    force: flags.has("--force"), fetchImpl: options.fetchImpl, now: options.now,
  };
  if (flags.has("--all")) {
    const catalogs = await refreshEnabledSources(refreshOptions);
    for (const catalog of catalogs) {
      write(`${catalog.id ?? "catalog"}: ${catalog.courses.length} courses, ${catalog.requirements.catalogYear}, ${catalog.warnings.length} warnings.\n`);
    }
    return;
  }
  const catalog = await refreshCatalog({ ...refreshOptions, sourceId: flags.get("--id") as string | undefined });
  write(`Catalog refreshed: ${catalog.id ?? "catalog"} · ${catalog.courses.length} courses, ${catalog.requirements.catalogYear}, ${catalog.warnings.length} warnings.\n`);
}

if (invokedDirectly()) {
  runCatalogCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
