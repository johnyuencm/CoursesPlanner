import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleRoadmapsRequest } from "../app/api/roadmaps/route";
import { readCatalog } from "../lib/catalog";
import { embeddedJson } from "../lib/embedded-snapshot";

// Cloudflare Workers has no project files. A root with no data/ must still
// serve the committed snapshot from the bundle.
test("readers fall back to the bundled snapshot when the files are missing", async () => {
  const empty = mkdtempSync(path.join(os.tmpdir(), "no-snapshot-"));
  const previous = process.cwd();
  process.chdir(empty);
  try {
    assert.ok(readCatalog(path.join(empty, "data", "catalog.json")).courses.length > 0);
    const response = await handleRoadmapsRequest(
      new NextRequest("http://localhost/api/roadmaps?university=northeastern&program=computer-science-mscs-sea-8b0d00dbda"),
      empty,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).programId, "computer-science-mscs-sea-8b0d00dbda");
    assert.throws(() => readCatalog(path.join(empty, "data", "other.json")), /ENOENT/);
  } finally {
    process.chdir(previous);
  }
});

// The Worker serves only bundled files. A committed ready roadmap that is not in
// lib/embedded-snapshot.ts FILES would answer 503 in production.
test("every committed ready roadmap is in the bundled snapshot", () => {
  const listed = execFileSync("git", ["ls-files", "data/catalogs/*/programs.json"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  assert.ok(listed.length > 0, "expected at least one committed programs.json");
  for (const file of listed) {
    assert.notEqual(embeddedJson(path.resolve(file)), undefined, `${file} is not in lib/embedded-snapshot.ts FILES`);
    const { programs } = JSON.parse(readFileSync(file, "utf8")) as { programs: { id: string; status: string }[] };
    for (const program of programs.filter((item) => item.status === "ready")) {
      const roadmap = path.join(path.dirname(file), "roadmaps", `${program.id}.json`);
      assert.notEqual(embeddedJson(path.resolve(roadmap)), undefined, `${roadmap} is not in lib/embedded-snapshot.ts FILES`);
    }
  }
});
