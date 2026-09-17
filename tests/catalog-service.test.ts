import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { assertAllowedUrl, createTurnWaiter, fetchOfficialHtml } from "../catalog-service/crawler";
import {
  defaultCatalogId,
  enabledUniversities,
  loadRegistry,
  loadUniversityDirectory,
  parseSourceDefinition,
  parseUniversityDirectory,
} from "../catalog-service/registry";
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

function universityEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "mit",
    university: "MIT",
    region: "us",
    priority: 1,
    catalogUrl: "https://catalog.mit.edu/",
    support: "unverified",
    enabled: false,
    ...overrides,
  };
}

function supportedUniversity(): Record<string, unknown> {
  return universityEntry({
    id: "northeastern",
    university: "Northeastern",
    priority: 20,
    catalogUrl: "https://catalog.northeastern.edu/",
    support: "supported",
    enabled: true,
    crawl: {
      adapter: "northeastern-acalog",
      discoverySource: {
        key: "programs",
        url: "https://catalog.northeastern.edu/programs/",
        fileName: "programs.html",
        required: true,
      },
      requestDelayMs: 750,
      robotsUrl: "https://catalog.northeastern.edu/robots.txt",
      allowedOrigins: ["https://catalog.northeastern.edu"],
    },
  });
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

test("university directory loads the approved 20 US and 20 world entries", async () => {
  const raw = JSON.parse(
    readFileSync(path.join(process.cwd(), "catalog-service", "universities.json"), "utf8"),
  ) as Array<{ id: string; university: string; catalogUrl: string }>;
  const universities = await loadUniversityDirectory();
  const expected = [
    ["mit", "MIT", "https://catalog.mit.edu/"],
    ["stanford", "Stanford", "https://bulletin.stanford.edu/"],
    ["carnegie-mellon", "Carnegie Mellon", "https://coursecatalog.web.cmu.edu/"],
    ["uc-berkeley", "UC Berkeley", "https://registrar.berkeley.edu/catalog/"],
    ["uiuc", "UIUC", "https://catalog.illinois.edu/"],
    ["georgia-tech", "Georgia Tech", "https://catalog.gatech.edu/"],
    ["washington", "University of Washington", "https://www.washington.edu/students/gencat/degree_programs.html"],
    ["cornell", "Cornell", "https://courses.cornell.edu/"],
    ["princeton", "Princeton", "https://ua.princeton.edu/"],
    ["ut-austin", "UT Austin", "https://catalog.utexas.edu/"],
    ["uc-san-diego", "UC San Diego", "https://catalog.ucsd.edu/"],
    ["michigan", "University of Michigan", "https://admissions.umich.edu/academics-majors/majors-degrees"],
    ["ucla", "UCLA", "https://catalog.registrar.ucla.edu/"],
    ["columbia", "Columbia", "https://bulletin.columbia.edu/"],
    ["harvard", "Harvard", "https://www.harvard.edu/programs/"],
    ["caltech", "Caltech", "https://catalog.caltech.edu/"],
    ["penn", "University of Pennsylvania", "https://catalog.upenn.edu/"],
    ["yale", "Yale", "https://catalog.yale.edu/"],
    ["purdue", "Purdue", "https://catalog.purdue.edu/"],
    ["northeastern", "Northeastern", "https://catalog.northeastern.edu/"],
    ["oxford", "Oxford", "https://www.ox.ac.uk/courses"],
    ["cambridge", "Cambridge", "https://www.undergraduate.study.cam.ac.uk/courses"],
    ["eth-zurich", "ETH Zurich", "https://ethz.ch/en/studies/bachelor/bachelors-degree-programmes.html"],
    ["imperial", "Imperial College London", "https://www.imperial.ac.uk/study/courses/"],
    ["toronto", "University of Toronto", "https://future.utoronto.ca/programs/"],
    ["nus", "National University of Singapore", "https://nus.edu.sg/oam/undergraduate-programmes"],
    ["tsinghua", "Tsinghua", "https://www.tsinghua.edu.cn/en/Admissions/Undergraduate/Degree_Programs.htm"],
    ["epfl", "EPFL", "https://www.epfl.ch/education/bachelor/programs/"],
    ["waterloo", "University of Waterloo", "https://uwaterloo.ca/future-students/programs"],
    ["ucl", "UCL", "https://www.ucl.ac.uk/prospective-students/undergraduate/degrees"],
    ["edinburgh", "University of Edinburgh", "https://study.ed.ac.uk/programmes"],
    ["ntu", "Nanyang Technological University", "https://www.ntu.edu.sg/education/degree-programmes"],
    ["peking", "Peking University", "https://dean.pku.edu.cn/web/student_info.php?id=2&type=1"],
    ["ubc", "University of British Columbia", "https://you.ubc.ca/programs/"],
    ["tokyo", "University of Tokyo", "https://www.u-tokyo.ac.jp/en/academics/faculties.html"],
    ["kaist", "KAIST", "https://kaist.ac.kr/en/html/edu/03.html"],
    ["seoul-national", "Seoul National University", "https://en.snu.ac.kr/academics/programs/undergraduate"],
    ["tum", "Technical University of Munich", "https://www.tum.de/en/studies/degree-programs"],
    ["melbourne", "University of Melbourne", "https://study.unimelb.edu.au/find"],
    ["hkust", "HKUST", "https://hkust.edu.hk/directory/academic-programs"],
  ];

  assert.deepEqual(
    raw.map(({ id, university, catalogUrl }) => [id, university, catalogUrl]),
    expected,
  );
  assert.equal(universities.length, 40);
  assert.deepEqual(
    universities.map(({ id, university, catalogUrl }) => [id, university, catalogUrl]),
    expected,
  );
  assert.deepEqual(universities.slice(0, 20).map(({ region, priority }) => [region, priority]), [
    ...Array.from({ length: 20 }, (_, index) => ["us", index + 1]),
  ]);
  assert.deepEqual(universities.slice(20).map(({ region, priority }) => [region, priority]), [
    ...Array.from({ length: 20 }, (_, index) => ["world", index + 1]),
  ]);
  assert.deepEqual(enabledUniversities(universities).map((entry) => entry.id), ["northeastern"]);
  assert.equal(universities.filter((entry) => entry.support === "unverified").length, 39);
});

test("production university directory rejects incomplete and sparse regions", async () => {
  const directory = JSON.parse(
    readFileSync(path.join(process.cwd(), "catalog-service", "universities.json"), "utf8"),
  ) as Array<Record<string, unknown>>;
  const rootDir = await mkdtemp(path.join(tmpdir(), "university-directory-"));
  const incompletePath = path.join(rootDir, "incomplete.json");
  const sparsePath = path.join(rootDir, "sparse.json");
  try {
    await writeFile(
      incompletePath,
      `${JSON.stringify(directory.filter((entry) => entry.id !== "northeastern"), null, 2)}\n`,
    );
    await assert.rejects(() => loadUniversityDirectory(incompletePath), {
      message: "incomplete.json must contain exactly 20 us entries with priorities exactly 1 through 20",
    });

    await writeFile(
      sparsePath,
      `${JSON.stringify(directory.filter((entry) => entry.id !== "cambridge"), null, 2)}\n`,
    );
    await assert.rejects(() => loadUniversityDirectory(sparsePath), {
      message: "sparse.json must contain exactly 20 world entries with priorities exactly 1 through 20",
    });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("university directory sorts US before world and skips metadata-only entries", () => {
  const universities = parseUniversityDirectory(
    [
      universityEntry({
        id: "oxford",
        university: "Oxford",
        region: "world",
        catalogUrl: "https://www.ox.ac.uk/courses",
      }),
      universityEntry({
        id: "stanford",
        university: "Stanford",
        priority: 2,
        catalogUrl: "https://bulletin.stanford.edu/",
      }),
      universityEntry(),
    ],
    "test universities",
  );

  assert.deepEqual(
    universities.map((entry) => entry.id),
    ["mit", "stanford", "oxford"],
  );
  assert.deepEqual(enabledUniversities(universities), []);
});

test("enabled universities require supported adapter and discovery crawl config", () => {
  const supported = supportedUniversity();

  const [parsed] = parseUniversityDirectory([supported], "test universities");
  assert.equal(parsed.crawl?.adapter, "northeastern-acalog");
  assert.throws(
    () => parseUniversityDirectory([{ ...supported, support: "unverified" }], "test universities"),
    /enabled only when support is supported/,
  );
  const { crawl: _crawl, ...withoutCrawl } = supported;
  assert.throws(
    () => parseUniversityDirectory([withoutCrawl], "test universities"),
    /enabled requires crawl config/,
  );
});

test("university crawl URLs must use allowed origins", () => {
  const supported = supportedUniversity();
  const crawl = supported.crawl as Record<string, unknown>;
  const discoverySource = crawl.discoverySource as Record<string, unknown>;

  assert.throws(
    () =>
      parseUniversityDirectory(
        [
          {
            ...supported,
            crawl: {
              ...crawl,
              allowedOrigins: ["https://user:password@catalog.northeastern.edu"],
            },
          },
        ],
        "test universities",
      ),
    {
      message: "test universities[0].crawl.allowedOrigins[0] must be an HTTPS origin",
    },
  );
  assert.throws(
    () =>
      parseUniversityDirectory(
        [
          {
            ...supported,
            crawl: {
              ...crawl,
              discoverySource: { ...discoverySource, url: "https://example.com/programs/" },
            },
          },
        ],
        "test universities",
      ),
    {
      message:
        "test universities[0].crawl.discoverySource.url origin must be listed in test universities[0].crawl.allowedOrigins",
    },
  );
  assert.throws(
    () =>
      parseUniversityDirectory(
        [{ ...supported, crawl: { ...crawl, robotsUrl: "https://example.com/robots.txt" } }],
        "test universities",
      ),
    {
      message:
        "test universities[0].crawl.robotsUrl origin must be listed in test universities[0].crawl.allowedOrigins",
    },
  );
});

test("university directory rejects duplicate IDs", () => {
  const university = universityEntry();

  assert.throws(
    () => parseUniversityDirectory([university, { ...university, region: "world" }], "test universities"),
    /Duplicate university id: mit/,
  );
});

test("university directory rejects duplicate priorities within a region", () => {
  const university = universityEntry();

  assert.throws(
    () => parseUniversityDirectory([university, { ...university, id: "stanford" }], "test universities"),
    /Duplicate university priority: us 1/,
  );
});

test("university directory validates metadata fields", async (t) => {
  const university = universityEntry();

  await t.test("ID", () => {
    assert.throws(
      () => parseUniversityDirectory([{ ...university, id: "MIT!" }], "test universities"),
      /invalid id/,
    );
  });
  await t.test("HTTPS catalog URL", () => {
    assert.throws(
      () => parseUniversityDirectory([{ ...university, catalogUrl: "http://catalog.mit.edu/" }], "test universities"),
      /catalogUrl must be HTTPS/,
    );
  });
  await t.test("support status", () => {
    assert.throws(
      () => parseUniversityDirectory([{ ...university, support: "maybe" }], "test universities"),
      /support must be unverified, supported, or unsupported/,
    );
  });
  await t.test("regional priority range", () => {
    assert.throws(
      () => parseUniversityDirectory([{ ...university, priority: 21 }], "test universities"),
      /priority must be an integer from 1 through 20/,
    );
  });
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

test("catalog service HTTP handlers list sources and universities without changing refresh behavior", async () => {
  const sources = await loadRegistry();
  const universities = await loadUniversityDirectory();
  const catalog = readCatalog();
  const context = {
    sources,
    universities,
    rootDir: process.cwd(),
    refresh: async () => ({ catalog, changed: false }),
    statuses: () => ({}),
  };
  const health = await handleCatalogRequest("GET", new URL("http://127.0.0.1/health"), Buffer.alloc(0), context);
  assert.equal(health.status, 200);
  assert.match(health.body, /"ok":true/);

  const listed = await handleCatalogRequest("GET", new URL("http://127.0.0.1/catalogs"), Buffer.alloc(0), context);
  assert.equal(listed.status, 200);
  assert.match(listed.body, /neu-mscs-seattle/);

  const directory = await handleCatalogRequest("GET", new URL("http://127.0.0.1/universities"), Buffer.alloc(0), context);
  assert.equal(directory.status, 200);
  const payload = JSON.parse(directory.body) as { universities: Array<Record<string, unknown>> };
  assert.equal(payload.universities.length, 40);
  assert.deepEqual(
    Object.fromEntries(Object.entries(payload.universities[0]).filter(([key]) => key !== "status")),
    {
      id: "mit",
      university: "MIT",
      region: "us",
      priority: 1,
      catalogUrl: "https://catalog.mit.edu/",
      support: "unverified",
      enabled: false,
    },
  );
  assert.equal((payload.universities[0].status as { status: string }).status, "unverified");
  assert.equal(payload.universities[19].id, "northeastern");
  assert.equal(payload.universities[19].support, "supported");
  assert.equal(payload.universities[19].enabled, true);
  assert.equal(payload.universities[20].id, "oxford");
  assert.equal("crawl" in payload.universities[19], false);
  assert.equal("status" in payload.universities[19], true);

  const wrongUniversityMethod = await handleCatalogRequest(
    "POST",
    new URL("http://127.0.0.1/universities"),
    Buffer.alloc(0),
    context,
  );
  assert.equal(wrongUniversityMethod.status, 405);
  assert.equal((wrongUniversityMethod.headers as Record<string, string>).Allow, "GET");
  assert.equal(wrongUniversityMethod.headers["Content-Type"], "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(wrongUniversityMethod.body), { error: "Method not allowed." });

  const missing = await handleCatalogRequest(
    "POST",
    new URL("http://127.0.0.1/catalogs/missing-source/refresh"),
    Buffer.alloc(0),
    context,
  );
  assert.equal(missing.status, 404);

  const withBody = await handleCatalogRequest(
    "POST",
    new URL("http://127.0.0.1/catalogs/neu-mscs-seattle/refresh"),
    Buffer.from("{}"),
    context,
  );
  assert.equal(withBody.status, 400);
});
