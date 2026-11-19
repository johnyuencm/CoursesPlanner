import { strict as assert } from "node:assert";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleRoadmapsRequest } from "../app/api/roadmaps/route";
import { runCatalogCli } from "../catalog-service/cli";
import { readCatalog } from "../lib/catalog";
import { buildSnapshotAssets, type SnapshotManifest } from "../lib/snapshot-manifest";
import { PROGRAMS, PUBLISHED, ROADMAP, plantCrawlOutput, publishedCopy, roadmapFile } from "./published-copy";

const ROOT = process.cwd();
const KEY = "northeastern/computer-science-mscs-sea-8b0d00dbda";

const manifestOf = (assets: Map<string, string>) =>
  JSON.parse(assets.get("_snapshots/manifest.json")!) as SnapshotManifest;

test("the build manifest lists every published snapshot, and each listed file ships", async () => {
  const root = await publishedCopy();
  const assets = await buildSnapshotAssets(root).finally(() => rm(root, { recursive: true, force: true }));
  const manifest = manifestOf(assets);
  assert.deepEqual(manifest.catalogs.map(({ key, tier, file }) => ({ key, tier, file })), [
    { key: "northeastern/computer-science-mscs-sea-8b0d00dbda", tier: "audit", file: "data/catalog.json" },
    ...PUBLISHED.map((key) => ({ key, tier: "map", file: roadmapFile(key) })),
  ]);
  assert.equal(PUBLISHED[0], KEY);
  assert.equal(manifest.catalogs[1].edition, "2026-09-12T01:09:37.140Z");
  assert.deepEqual(
    [...assets.keys()].sort(),
    ["_snapshots/manifest.json", ...manifest.files.map((file) => `_snapshots/${file}`)].sort(),
  );
  // The shipped copies give the same API bodies as the disk files.
  assert.deepEqual(JSON.parse(assets.get("_snapshots/data/catalog.json")!), await readCatalog());
  assert.deepEqual(JSON.parse(assets.get(`_snapshots/${PROGRAMS}`)!), JSON.parse(await readFile(PROGRAMS, "utf8")));
  assert.deepEqual(JSON.parse(assets.get(`_snapshots/${ROADMAP}`)!), JSON.parse(await readFile(ROADMAP, "utf8")));
});

test("the build fails when a published snapshot is missing or invalid", async () => {
  const root = await publishedCopy();
  try {
    await writeFile(path.join(root, "data/published.json"), JSON.stringify([KEY, KEY]));
    await assert.rejects(buildSnapshotAssets(root), /invalid or duplicate catalog key/);
    await writeFile(path.join(root, "data/published.json"), JSON.stringify([KEY]));
    await writeFile(path.join(root, ROADMAP), "{ not json");
    await assert.rejects(buildSnapshotAssets(root), new RegExp(`Published snapshot ${KEY} is missing or invalid`));
    await writeFile(path.join(root, ROADMAP), JSON.stringify({ programId: "x" }));
    await assert.rejects(buildSnapshotAssets(root), /missing or invalid: Program roadmap/);
    await rm(path.join(root, ROADMAP));
    await assert.rejects(buildSnapshotAssets(root), /missing or invalid/);
    await writeFile(path.join(root, "data/published.json"), JSON.stringify(["northeastern/not-a-program"]));
    await assert.rejects(buildSnapshotAssets(root), /not-a-program is missing or invalid: Unknown roadmap program/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the build reads only tracked files: ignored crawl output, an invalid status file included, changes nothing (#127)", async (t) => {
  const clean = await publishedCopy();
  const dirty = await publishedCopy();
  t.after(() => Promise.all([clean, dirty].map((root) => rm(root, { recursive: true, force: true }))));
  await plantCrawlOutput(dirty);
  assert.deepEqual(await buildSnapshotAssets(dirty), await buildSnapshotAssets(clean));
});

test("a roadmap read without programs.json is 404, also when the local crawl status says discovery is ready (#127)", async (t) => {
  const root = await publishedCopy();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "data/catalogs/northeastern/.roadmap-crawl-status.json"), JSON.stringify({
    version: 1, universityId: "northeastern", status: "ready", discoveryStatus: "ready",
    queue: [], counts: { queued: 0, ready: PUBLISHED.length, unsupported: 0, error: 0 }, updatedAt: "2026-11-08T00:00:00.000Z",
  }));
  await rm(path.join(root, PROGRAMS));
  const response = await handleRoadmapsRequest(
    new NextRequest(`http://localhost/api/roadmaps?university=northeastern&program=${KEY.split("/")[1]}`),
    root,
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Unknown roadmap program." });
});

test("the app reads only tracked files: with local crawl output, each roadmap API answer is as from a clean copy (#127)", async (t) => {
  const clean = await publishedCopy();
  const dirty = await publishedCopy();
  t.after(() => Promise.all([clean, dirty].map((root) => rm(root, { recursive: true, force: true }))));
  await plantCrawlOutput(dirty);
  const get = async (root: string, query: string) => {
    const response = await handleRoadmapsRequest(new NextRequest(`http://localhost/api/roadmaps${query}`), root);
    return { status: response.status, body: await response.json() };
  };
  // Other universities have no files, and their status time is the request time.
  const northeastern = async (root: string) => {
    const list = await get(root, "");
    return { status: list.status, entry: list.body.universities?.find((entry: { id: string }) => entry.id === "northeastern") };
  };
  for (const query of ["", "?university=northeastern", ...PUBLISHED.map((key) => `?university=${key.replace("/", "&program=")}`)]) {
    const read = query ? (root: string) => get(root, query) : northeastern;
    const expected = await read(clean);
    assert.equal(expected.status, 200, query);
    assert.deepEqual(await read(dirty), expected, query);
  }
  // The CLI roadmap read is the same read.
  for (const key of PUBLISHED) {
    const [university, program] = key.split("/");
    const roadmap = async (root: string) => {
      let output = "";
      await runCatalogCli([`--roadmap=${program}`, `--university=${university}`], { rootDir: root, write: (text) => { output += text; } });
      return output;
    };
    assert.deepEqual(await roadmap(dirty), await roadmap(clean), key);
  }
});

test("only the crawler's operator view reads the crawl status, and an invalid status names its file", async (t) => {
  const root = await publishedCopy();
  t.after(() => rm(root, { recursive: true, force: true }));
  await plantCrawlOutput(root);
  const message = `${path.join(root, "data/catalogs/northeastern/.roadmap-crawl-status.json")}: Roadmap crawl status universityId is invalid`;
  for (const command of [["--list-programs", "--university=northeastern"], ["--list-universities"]]) {
    await assert.rejects(runCatalogCli(command, { rootDir: root, write: () => {} }), { message }, command[0]);
  }
});

test("the manifest tier comes from validation: credits that do not add up give the Map tier", async () => {
  const root = await publishedCopy();
  try {
    const file = path.join(root, "data/catalog.json");
    const catalog = JSON.parse(await readFile(file, "utf8"));
    catalog.requirements.root.children.find((group: { id: string }) => group.id === "electives").credits = 8; // 8 core + 12 breadth + 8 electives is not 32
    await writeFile(file, JSON.stringify(catalog));
    assert.equal(manifestOf(await buildSnapshotAssets(root)).catalogs[0].tier, "map");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("removing a program from the allowlist removes it from the shipped site", async () => {
  const root = await publishedCopy();
  try {
    await writeFile(path.join(root, "data/published.json"), "[]");
    const manifest = manifestOf(await buildSnapshotAssets(root));
    assert.deepEqual(manifest.catalogs.map((entry) => entry.tier), ["audit"]);
    assert.deepEqual(manifest.files, ["catalog-service/universities.json", "data/catalog.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// PR #54 finding 3: no module bundles snapshot files, so Node tools treat a deleted folder as missing.
test("the CLI and readers still work when a snapshot folder is deleted", async () => {
  const root = await publishedCopy();
  try {
    await rm(path.join(root, "data/catalogs/northeastern"), { recursive: true });
    let output = "";
    await runCatalogCli(["--list-programs", "--university=northeastern"], {
      rootDir: root,
      write: (text) => { output += text; },
    });
    assert.deepEqual(JSON.parse(output).programs, []);
    const response = await handleRoadmapsRequest(
      new NextRequest(`http://localhost/api/roadmaps?university=northeastern&program=${KEY.split("/")[1]}`),
      root,
    );
    assert.equal(response.status, 404);
    await assert.rejects(readCatalog(path.join(root, "data", "other.json")), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("no source file imports a snapshot JSON file into the Worker bundle", async () => {
  const offenders: string[] = [];
  for (const dir of ["app", "lib", "components", "catalog-service", "."]) {
    const entries = dir === "." ? ["worker.ts", "vite.config.ts"] : await readdir(path.join(ROOT, dir), { recursive: true });
    for (const entry of entries) {
      if (!/\.tsx?$/.test(entry)) continue;
      const source = await readFile(path.join(ROOT, dir, entry), "utf8");
      if (/from\s+["'][^"']*(data\/catalog|universities)[^"']*\.json["']/.test(source)) offenders.push(`${dir}/${entry}`);
    }
  }
  assert.deepEqual(offenders, []);
});
