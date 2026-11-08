import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET, POST } from "../app/api/catalog/route";
import { CATALOGS, DEFAULT_CATALOG_KEY } from "../lib/catalog-key";

const TOKEN_ENV = "CATALOG_REFRESH_TOKEN";
const TOKEN = "test-catalog-refresh-token";

function catalogRequest(method: string, headers?: HeadersInit) {
  return new NextRequest("http://127.0.0.1:3000/api/catalog", { method, headers });
}

async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("GET /api/catalog returns the cached catalog without a refresh token", async () => {
  await withEnv({ [TOKEN_ENV]: undefined, NODE_ENV: "production" }, async () => {
    const response = await GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const catalog = await response.json();
    assert.ok(Array.isArray(catalog.courses));
    assert.ok(catalog.requirements);
    assert.equal(catalog.requirements.version, 2);
    assert.equal(catalog.requirements.root.kind, "all");
  });
});

test("GET /api/catalog reports refreshAvailable=false when the UI cannot refresh (CR3)", async () => {
  await withEnv({ [TOKEN_ENV]: undefined, NODE_ENV: "production" }, async () => {
    const body = await (await GET()).json();
    assert.equal(body.refreshAvailable, false);
  });
  await withEnv({ [TOKEN_ENV]: undefined, NODE_ENV: "development" }, async () => {
    const body = await (await GET()).json();
    assert.equal(body.refreshAvailable, true);
  });
  await withEnv({ [TOKEN_ENV]: TOKEN, NODE_ENV: "production" }, async () => {
    // The browser never sends x-catalog-refresh-token, so a configured token
    // still means the in-browser refresh would 401.
    const body = await (await GET()).json();
    assert.equal(body.refreshAvailable, false);
  });
});

test("unauthenticated POST /api/catalog without a refresh token is 401", async () => {
  await withEnv({ [TOKEN_ENV]: TOKEN, NODE_ENV: "production" }, async () => {
    const response = await POST(catalogRequest("POST"));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Catalog refresh is not authorized." });
  });
});

test("POST /api/catalog without a configured token is 401 outside development", async () => {
  await withEnv({ [TOKEN_ENV]: undefined, NODE_ENV: "production" }, async () => {
    const response = await POST(catalogRequest("POST"));
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, "Catalog refresh is not authorized.");
    assert.doesNotMatch(body.error, /[/\\]|catalog\.json|data[/\\]/);
  });
});

test("cross-site POST /api/catalog is still 403", async () => {
  await withEnv({ [TOKEN_ENV]: TOKEN }, async () => {
    const response = await POST(
      catalogRequest("POST", {
        "sec-fetch-site": "cross-site",
        origin: "https://evil.example",
        "x-catalog-refresh-token": TOKEN,
      }),
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Cross-site catalog refresh refused." });
  });
});

function getRequest(query: string) {
  return new NextRequest(`http://127.0.0.1:3000/api/catalog${query}`);
}

test("GET /api/catalog?key= serves the snapshot of that catalog key; an old id is an alias (#69)", async () => {
  await withEnv({ [TOKEN_ENV]: undefined, NODE_ENV: "production" }, async () => {
    const plain = await (await GET()).text();
    assert.equal(JSON.parse(plain).key, DEFAULT_CATALOG_KEY);
    for (const query of [`?key=${encodeURIComponent(DEFAULT_CATALOG_KEY)}`, `?key=${DEFAULT_CATALOG_KEY}`, "?key=neu-mscs-seattle"]) {
      const response = await GET(getRequest(query));
      assert.equal(response.status, 200, query);
      // One memoized body per catalog: the same bytes for the key, the alias, and no key.
      assert.equal(await response.text(), plain, query);
    }
  });
});

test("GET /api/catalog with an unknown key is 404 (#69)", async () => {
  const traversal = ["../catalog", "..%2F..%2Fdata%2Fcatalog.json", "%2e%2e/%2e%2e/etc/passwd", "northeastern/../neu-mscs-seattle",
    `${encodeURIComponent(DEFAULT_CATALOG_KEY)}%00`, "__proto__", "constructor", "hasOwnProperty", " neu-mscs-seattle", "NEU-MSCS-SEATTLE"];
  for (const query of ["?key=nope", "?key=northeastern/nope", "?key=", ...traversal.map((key) => `?key=${key}`), `?key=${"a".repeat(100_000)}`]) {
    const response = await GET(getRequest(query));
    assert.equal(response.status, 404, query);
    const { error } = await response.json();
    assert.match(error, /No catalog has the key/);
    assert.ok(error.length < 200, "the echoed key is cut");
  }
});

test("GET /api/catalog keeps one memoized body for any number of user keys (#69 review)", async () => {
  await withEnv({ [TOKEN_ENV]: undefined, NODE_ENV: "production" }, async () => {
    const first = await (await GET(getRequest("?key=neu-mscs-seattle"))).text();
    for (let i = 0; i < 200; i += 1) await GET(getRequest(`?key=junk-${i}`));
    assert.equal(await (await GET(getRequest(`?key=${DEFAULT_CATALOG_KEY}`))).text(), first);
  });
});

test("the default catalog key is a published program and matches data/catalog.json (#69)", () => {
  const root = process.cwd();
  const published = JSON.parse(readFileSync(path.join(root, "data", "published.json"), "utf8")) as string[];
  const catalog = JSON.parse(readFileSync(path.join(root, "data", "catalog.json"), "utf8")) as { id: string; adapter: string };
  assert.ok(published.includes(DEFAULT_CATALOG_KEY));
  assert.deepEqual(CATALOGS[DEFAULT_CATALOG_KEY], { id: catalog.id, adapter: catalog.adapter });
});
