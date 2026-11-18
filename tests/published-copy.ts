import { readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const ROADMAP = "data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json";
export const PROGRAMS = "data/catalogs/northeastern/programs.json";
/** The tracked allowlist of published catalog keys. */
export const PUBLISHED: string[] = JSON.parse(readFileSync(path.join(process.cwd(), "data", "published.json"), "utf8"));
/** The committed roadmap snapshot of a catalog key. */
export const roadmapFile = (key: string) => `data/catalogs/${key.split("/")[0]}/roadmaps/${key.split("/")[1]}.json`;

/**
 * A temp copy of the tracked published files. Read the committed snapshot through it, so
 * ignored local crawl output under data/catalogs/ cannot change a result (#123), and a test
 * can break one file without touching the repo.
 */
export async function publishedCopy(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "snapshots-"));
  for (const file of ["catalog-service/universities.json", "data/catalog.json", "data/published.json", PROGRAMS, ...PUBLISHED.map(roadmapFile)]) {
    await cp(path.join(process.cwd(), file), path.join(root, file));
  }
  return root;
}

/**
 * Plant what a local crawl leaves behind under data/catalogs/. Git ignores all of it.
 * The status file is invalid, so a reader that reads it throws (#123, #127).
 */
export async function plantCrawlOutput(root: string): Promise<void> {
  const crawl = path.join(root, "data", "catalogs", "northeastern");
  await writeFile(path.join(crawl, ".roadmap-crawl-status.json"), JSON.stringify({ version: 1 }));
  await mkdir(path.join(crawl, "raw"), { recursive: true });
  await writeFile(path.join(crawl, "raw", "x.html"), "<html></html>");
  await writeFile(path.join(crawl, "roadmaps", "zz-extra.json"), "{ not json");
  await mkdir(path.join(root, "data", "catalogs", "neu-mscs-seattle"), { recursive: true });
  await writeFile(path.join(root, "data", "catalogs", "neu-mscs-seattle", "catalog.json"), "{}");
}
