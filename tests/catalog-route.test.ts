import { strict as assert } from "node:assert";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET, POST } from "../app/api/catalog/route";

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
    assert.equal(typeof catalog.requirements.totalCredits, "number");
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
