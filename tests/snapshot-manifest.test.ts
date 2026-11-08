import { strict as assert } from "node:assert";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleRoadmapsRequest } from "../app/api/roadmaps/route";
import { runCatalogCli } from "../catalog-service/cli";
import { readCatalog } from "../lib/catalog";
import { buildSnapshotAssets, type SnapshotManifest } from "../lib/snapshot-manifest";

const ROOT = process.cwd();
const KEY = "northeastern/computer-science-mscs-sea-8b0d00dbda";
const ROADMAP = "data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json";
const PROGRAMS = "data/catalogs/northeastern/programs.json";

/** A copy of the published repo files, so a test can break one without touching the repo. */
async function publishedCopy(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "snapshots-"));
  for (const file of ["catalog-service/universities.json", "data/catalog.json", "data/published.json", PROGRAMS, ROADMAP]) {
    await cp(path.join(ROOT, file), path.join(root, file));
  }
  return root;
}

const manifestOf = (assets: Map<string, string>) =>
  JSON.parse(assets.get("_snapshots/manifest.json")!) as SnapshotManifest;

test("the build manifest lists every published snapshot, and each listed file ships", async () => {
  const assets = await buildSnapshotAssets(ROOT);
  const manifest = manifestOf(assets);
  assert.deepEqual(manifest.catalogs.map(({ key, tier, file }) => ({ key, tier, file })), [
    { key: "northeastern/computer-science-mscs-sea-8b0d00dbda", tier: "audit", file: "data/catalog.json" },
    { key: KEY, tier: "map", file: ROADMAP },
  ]);
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

test("the manifest tier comes from validation: credits that do not add up give the Map tier", async () => {
  const root = await publishedCopy();
  try {
    const file = path.join(root, "data/catalog.json");
    const catalog = JSON.parse(await readFile(file, "utf8"));
    catalog.requirements.electiveCredits = 8; // 8 core + 12 breadth + 8 electives is not 32
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
