import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleRoadmapsRequest } from "../app/api/roadmaps/route";
import { readCatalog } from "../lib/catalog";

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
