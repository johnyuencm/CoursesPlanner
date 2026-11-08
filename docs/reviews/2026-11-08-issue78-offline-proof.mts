// Offline rebuild proof for #78. Usage: tsx offline-proof.ts <repoRoot> <outDir>
// Never fetches: fetchImpl throws. Clock fixed at the committed lastUpdated.
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const [repo, outDir] = process.argv.slice(2);
const load = (rel: string) => import(pathToFileURL(path.join(repo, rel)).href);
const { refreshCatalog } = await load("catalog-service/refresh.ts");
const { getAdapter } = await load("catalog-service/adapters.ts");

const NOW = "2026-09-12T06:14:27.155Z";
let fetchCalls = 0;
const fetchImpl = (async () => {
  fetchCalls += 1;
  throw new Error("network disabled");
}) as typeof fetch;

const root = await mkdtemp(path.join(tmpdir(), "issue78-"));
await cp(path.join(repo, "data", "raw"), path.join(root, "data", "raw"), { recursive: true });
const metaPath = path.join(root, "data", "raw", ".catalog-cache.json");
const meta = JSON.parse(await readFile(metaPath, "utf8"));
meta.robots = { fetchedAt: NOW, disallowed: [] };
await writeFile(metaPath, JSON.stringify(meta));
await refreshCatalog({
  rootDir: root,
  sourcesDir: path.join(repo, "catalog-service", "sources"),
  fetchImpl,
  now: () => new Date(NOW),
});

// Roadmap: the adapter roadmap path on the same cached pages.
const committedFile = path.join(repo, "data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json");
const committed = JSON.parse(await readFile(committedFile, "utf8"));
const adapter = getAdapter(committed.adapter);
const raw = (name: string) => readFile(path.join(repo, "data", "raw", name), "utf8");
const scope = adapter.parseProgramScope(await raw("mscs-sea-program.html"), committed.officialUrl);
const origin = new URL(committed.officialUrl).origin;
const sources = adapter.courseSources(scope.programCourseCodes, origin);
const parsed = [];
for (const source of sources) {
  const subject = source.url.match(/course-descriptions\/([a-z]+)\/$/)![1];
  parsed.push(...adapter.parseCourses(await raw(`${subject}.html`), source.url));
}
const courses = adapter.buildRoadmapGraph(parsed, scope.programCourseCodes, origin);
const uncertain = courses.filter((course: { uncertainties: string[] }) => course.uncertainties.length).length;
const roadmap = {
  ...committed,
  program: scope.name,
  adapter: adapter.id,
  programCourseCodes: scope.programCourseCodes,
  courses,
  sources: [...new Set([committed.officialUrl, ...sources.map((source: { url: string }) => source.url)])],
  warnings: [
    `${uncertain} courses have unavailable details or conservatively parsed prerequisite/corequisite clauses; inspect course uncertainties.`,
    committed.warnings[1],
  ],
};

await mkdir(outDir, { recursive: true });
const outputs: Record<string, string> = {
  "catalog.json": await readFile(path.join(root, "data", "catalog.json"), "utf8"),
  "courses.json": await readFile(path.join(root, "data", "courses.json"), "utf8"),
  "requirements.json": await readFile(path.join(root, "data", "requirements.json"), "utf8"),
  "roadmap.json": `${JSON.stringify(roadmap, null, 2)}\n`,
};
const committedFiles: Record<string, string> = {
  "catalog.json": "data/catalog.json",
  "courses.json": "data/courses.json",
  "requirements.json": "data/requirements.json",
  "roadmap.json": "data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json",
};
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
for (const [name, text] of Object.entries(outputs)) {
  await writeFile(path.join(outDir, name), text);
  const original = await readFile(path.join(repo, committedFiles[name]), "utf8");
  console.log(`${name} sha256=${sha(text)} equalsCommitted=${text === original}`);
}
console.log(`fetchCalls=${fetchCalls}`);
