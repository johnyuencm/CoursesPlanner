import { cp, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const ROADMAP = "data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json";
export const PROGRAMS = "data/catalogs/northeastern/programs.json";

/**
 * A temp copy of the tracked published files. Read the committed snapshot through it, so
 * ignored local crawl output under data/catalogs/ cannot change a result (#123), and a test
 * can break one file without touching the repo.
 */
export async function publishedCopy(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "snapshots-"));
  for (const file of ["catalog-service/universities.json", "data/catalog.json", "data/published.json", PROGRAMS, ROADMAP]) {
    await cp(path.join(process.cwd(), file), path.join(root, file));
  }
  return root;
}
