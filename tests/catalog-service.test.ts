import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { assertAllowedUrl, createTurnWaiter, fetchOfficialHtml } from "../catalog-service/crawler";
import { defaultCatalogId, loadRegistry, parseSourceDefinition } from "../catalog-service/registry";
import { refreshSource } from "../catalog-service/refresh";
import { parseRobots, pathDisallowed } from "../catalog-service/robots";
import { isDue, runDueSources } from "../catalog-service/scheduler";
import { handleCatalogRequest } from "../catalog-service/server";
import type { CatalogSourceDefinition } from "../catalog-service/source-types";
import { readCatalog } from "../lib/catalog";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "data", "raw", name), "utf8");

function neuTemplate(): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(process.cwd(), "catalog-service", "sources", "neu-mscs-seattle.json"), "utf8")) as Record<string, unknown>;
}

function sourceFor(id: string): CatalogSourceDefinition {
  const raw = neuTemplate();
  raw.id = id;
  delete raw.storage;
  return parseSourceDefinition(raw, `${id}.json`);
}

function htmlResponse(html: string, etag: string) {
  return new Response(html, { status: 200, headers: { "content-type": "text/html", etag } });
}

function mockCatalogFetch(options: { notModified?: boolean; etag?: string; calls?: string[] } = {}): typeof fetch {
    const program = fixture("mscs-sea-program.html");
    const courses = fixture("cs.html");
    return async (input) => {
      const url = String(input);
      options.calls?.push(url);
      if (url.endsWith("/robots.txt")) {
        return new Response("User-agent: *\nDisallow: /search/\nDisallow: /xsearch/\n", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      if (options.notModified) return new Response(null, { status: 304 });
      if (url.includes("computer-science-mscs-sea")) return htmlResponse(program, options.etag ?? '"program"');
      if (url.includes("/course-descriptions/cs/")) return htmlResponse(courses, options.etag ?? '"cs"');
      if (/\/course-descriptions\/(?:cy|ds|dads)\//.test(url)) return new Response("missing", { status: 404 });
      throw new Error(`unexpected catalog fetch ${url}`);
    };
}

test("registry loads the enabled Northeastern source and ignores example templates", async () => {
  const sources = await loadRegistry();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, "neu-mscs-seattle");
  assert.equal(sources[0].adapter, "northeastern-acalog");
  assert.equal(sources[0].enabled, true);
  assert.equal(defaultCatalogId(), "neu-mscs-seattle");
});

test("crawler refuses robots-disallowed catalog search paths", async () => {
  const [source] = await loadRegistry();
  assert.throws(
    () => assertAllowedUrl(source, "https://catalog.northeastern.edu/search/?P=CS%205800"),
    /Refused catalog path/,
  );
  assert.equal(pathDisallowed("/search/?P=CS%205800".split("?")[0], parseRobots("User-agent: *\nDisallow: /search/\n")), true);
  await assert.rejects(
    () =>
      fetchOfficialHtml(source, { ...source.programSource, url: "https://catalog.northeastern.edu/search/" }, fetch, createTurnWaiter(0)),
    /Refused catalog path/,
  );
});

test("conditional GET 304 keeps the cached body", async () => {
  const [source] = await loadRegistry();
  const result = await fetchOfficialHtml(source, source.programSource, async () => new Response(null, { status: 304 }), createTurnWaiter(0), {
    etag: '"abc"',
  });
  assert.equal(result.notModified, true);
  assert.equal(result.html, "");
  assert.equal(result.etag, '"abc"');
});

test("scheduler refreshes a due source once per poll interval", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "catalog-scheduler-"));
  const definition = sourceFor("scheduler-demo");
  definition.pollIntervalMs = 1_000;
  let now = new Date("2026-09-11T00:00:00.000Z");
  let calls = 0;
  try {
    assert.equal(isDue(definition, undefined, now), true);
    const first = await runDueSources({
      sources: [definition],
      rootDir,
      now: () => now,
      refresh: async () => {
        calls += 1;
        return { changed: false };
      },
    });
    assert.equal(first.length, 1);
    assert.equal(calls, 1);
    assert.equal(isDue(definition, first[0], now), false);
    const skipped = await runDueSources({
      sources: [definition],
      rootDir,
      now: () => now,
      refresh: async () => {
        calls += 1;
        return { changed: false };
      },
    });
    assert.equal(skipped.length, 0);
    assert.equal(calls, 1);
    now = new Date("2026-09-11T00:00:01.000Z");
    const second = await runDueSources({
      sources: [definition],
      rootDir,
      now: () => now,
      refresh: async () => {
        calls += 1;
        return { changed: true };
      },
    });
    assert.equal(second.length, 1);
    assert.equal(calls, 2);
    assert.equal(second[0].lastChangedAt, second[0].lastFinishedAt);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("304 catalog check keeps lastUpdated and records If-None-Match", { timeout: 60_000 }, async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "catalog-304-"));
  const definition = sourceFor("neu-304");
  const calls: string[] = [];
  try {
    const first = await refreshSource(definition, {
      rootDir,
      force: true,
      delayMs: 0,
      now: () => new Date("2026-09-11T00:00:00.000Z"),
      fetchImpl: mockCatalogFetch({ etag: '"v1"', calls }),
    });
    assert.equal(first.changed, true);
    const secondCalls: string[] = [];
    const ifNoneMatch: string[] = [];
    const notModifiedFetch = mockCatalogFetch({ notModified: true, calls: secondCalls });
    const secondFetch: typeof fetch = async (input, init) => {
      const header = new Headers(init?.headers).get("If-None-Match");
      if (header) ifNoneMatch.push(header);
      return notModifiedFetch(input, init);
    };
    const second = await refreshSource(definition, {
      rootDir,
      checkOnly: true,
      delayMs: 0,
      now: () => new Date("2026-09-11T00:00:30.000Z"),
      fetchImpl: secondFetch,
    });
    assert.equal(second.changed, false);
    assert.equal(second.catalog.lastUpdated, first.catalog.lastUpdated);
    assert.ok(ifNoneMatch.includes('"v1"'));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("two registered sources refresh independently from the same fixtures", { timeout: 60_000 }, async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "catalog-multi-"));
  const sourcesDir = path.join(rootDir, "sources");
  await mkdir(sourcesDir, { recursive: true });
  const alpha = neuTemplate();
  const beta = neuTemplate();
  alpha.id = "neu-alpha";
  beta.id = "neu-beta";
  delete alpha.storage;
  delete beta.storage;
  await writeFile(path.join(sourcesDir, "alpha.json"), `${JSON.stringify(alpha, null, 2)}\n`);
  await writeFile(path.join(sourcesDir, "beta.json"), `${JSON.stringify(beta, null, 2)}\n`);
  const registry = await loadRegistry(sourcesDir);
  assert.deepEqual(registry.map((source) => source.id), ["neu-alpha", "neu-beta"]);
  try {
    const fetchImpl = mockCatalogFetch();
    const first = await refreshSource(registry[0], {
      rootDir,
      sourcesDir,
      force: true,
      delayMs: 0,
      now: () => new Date("2026-09-11T00:00:00.000Z"),
      fetchImpl,
    });
    const second = await refreshSource(registry[1], {
      rootDir,
      sourcesDir,
      force: true,
      delayMs: 0,
      now: () => new Date("2026-09-11T00:01:00.000Z"),
      fetchImpl,
    });
    assert.equal(first.catalog.id, "neu-alpha");
    assert.equal(second.catalog.id, "neu-beta");
    assert.equal(first.catalog.requirements.totalCredits, 32);
    assert.equal(second.catalog.requirements.totalCredits, 32);
    assert.ok(first.catalog.courses.some((course) => course.code === "CS 5010"));
    const alphaFile = JSON.parse(await readFile(path.join(rootDir, "data", "catalogs", "neu-alpha", "catalog.json"), "utf8")) as { id: string };
    const betaFile = JSON.parse(await readFile(path.join(rootDir, "data", "catalogs", "neu-beta", "catalog.json"), "utf8")) as { id: string };
    assert.equal(alphaFile.id, "neu-alpha");
    assert.equal(betaFile.id, "neu-beta");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("catalog service HTTP handlers list sources and reject unsafe refresh bodies", async () => {
  const sources = await loadRegistry();
  const catalog = readCatalog();
  const health = await handleCatalogRequest("GET", new URL("http://127.0.0.1/health"), Buffer.alloc(0), {
    sources,
    rootDir: process.cwd(),
    refresh: async () => ({ catalog, changed: false }),
    statuses: () => ({}),
  });
  assert.equal(health.status, 200);
  assert.match(health.body, /"ok":true/);

  const listed = await handleCatalogRequest("GET", new URL("http://127.0.0.1/catalogs"), Buffer.alloc(0), {
    sources,
    rootDir: process.cwd(),
    refresh: async () => ({ catalog, changed: false }),
    statuses: () => ({}),
  });
  assert.equal(listed.status, 200);
  assert.match(listed.body, /neu-mscs-seattle/);

  const missing = await handleCatalogRequest("POST", new URL("http://127.0.0.1/catalogs/missing-source/refresh"), Buffer.alloc(0), {
    sources,
    rootDir: process.cwd(),
    refresh: async () => ({ catalog, changed: false }),
    statuses: () => ({}),
  });
  assert.equal(missing.status, 404);

  const withBody = await handleCatalogRequest("POST", new URL("http://127.0.0.1/catalogs/neu-mscs-seattle/refresh"), Buffer.from("{}"), {
    sources,
    rootDir: process.cwd(),
    refresh: async () => ({ catalog, changed: false }),
    statuses: () => ({}),
  });
  assert.equal(withBody.status, 400);
});
