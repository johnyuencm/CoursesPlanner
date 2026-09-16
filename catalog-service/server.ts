import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateCatalog } from "../lib/catalog";
import type { Catalog } from "../lib/types";
import { defaultCatalogId, enabledSources, findSource, loadRegistry, loadUniversityDirectory } from "./registry";
import { refreshSource, storagePaths } from "./refresh";
import { startScheduler, type SourceStatus } from "./scheduler";
import type { CatalogSourceDefinition, UniversityDirectoryEntry } from "./source-types";

const HOST = process.env.CATALOG_SERVICE_HOST ?? "127.0.0.1";
const PORT = Number(process.env.CATALOG_SERVICE_PORT ?? 8787);

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
    body: `${JSON.stringify(data)}\n`,
  };
}

function errorBody(error: unknown, status: number) {
  return json({ error: error instanceof Error ? error.message : String(error) }, status);
}

async function readBody(request: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const current = path.resolve(fileURLToPath(import.meta.url));
  const invoked = path.resolve(entry);
  return process.platform === "win32" ? current.toLowerCase() === invoked.toLowerCase() : current === invoked;
}

function assertLoopbackHost(host: string): void {
  if (host === "127.0.0.1" || host === "localhost" || host === "::1") return;
  if (process.env.CATALOG_SERVICE_ALLOW_REMOTE === "1") return;
  throw new Error("Catalog service binds loopback only. Set CATALOG_SERVICE_ALLOW_REMOTE=1 to override.");
}

export async function handleCatalogRequest(
  method: string,
  url: URL,
  body: Buffer,
  context: {
    sources: CatalogSourceDefinition[];
    universities: UniversityDirectoryEntry[];
    rootDir: string;
    refresh: (
      definition: CatalogSourceDefinition,
      force: boolean,
    ) => Promise<{ catalog: Catalog; changed: boolean }>;
    statuses: () => Record<string, SourceStatus>;
  },
) {
  if (method === "GET" && url.pathname === "/health") {
    return json({
      ok: true,
      service: "catalog-service",
      defaultCatalog: defaultCatalogId(),
      adapters: [...new Set(context.sources.map((source) => source.adapter))],
    });
  }
  if (method === "GET" && url.pathname === "/universities") {
    return json({
      universities: context.universities.map((entry) => ({
        id: entry.id,
        university: entry.university,
        region: entry.region,
        priority: entry.priority,
        catalogUrl: entry.catalogUrl,
        support: entry.support,
        enabled: entry.enabled,
      })),
    });
  }
  if (url.pathname === "/universities") {
    return json({ error: "Method not allowed." }, 405, { Allow: "GET" });
  }
  if (method === "GET" && url.pathname === "/catalogs") {
    return json({
      catalogs: context.sources.map((source) => ({
        id: source.id,
        university: source.university,
        program: source.program,
        adapter: source.adapter,
        enabled: source.enabled,
        pollIntervalMs: source.pollIntervalMs,
        status: context.statuses()[source.id] ?? null,
      })),
    });
  }
  const catalogMatch = url.pathname.match(/^\/catalogs\/([a-z0-9][a-z0-9-]{0,80})$/);
  const refreshMatch = url.pathname.match(/^\/catalogs\/([a-z0-9][a-z0-9-]{0,80})\/refresh$/);
  if (method === "GET" && catalogMatch) {
    try {
      const source = findSource(context.sources, catalogMatch[1]);
      const filePath = storagePaths(source, context.rootDir).catalogFile;
      const catalog = JSON.parse(await readFile(filePath, "utf8"));
      validateCatalog(catalog);
      return json(catalog);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("Unknown catalog source:")) return errorBody(error, 404);
      return errorBody(error, 503);
    }
  }
  if (method === "POST" && refreshMatch) {
    if (body.byteLength > 0) return errorBody(new Error("Catalog refresh does not accept a request body."), 400);
    try {
      const source = findSource(context.sources, refreshMatch[1]);
      if (!source.enabled) return errorBody(new Error(`Catalog source ${source.id} is disabled.`), 409);
      const result = await context.refresh(source, true);
      return json(result.catalog, 200, { "X-Catalog-Refresh": result.changed ? "updated" : "unchanged" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("Unknown catalog source:")) return errorBody(error, 404);
      return errorBody(error, 502);
    }
  }
  return errorBody(new Error("Not found."), 404);
}

async function main() {
  assertLoopbackHost(HOST);
  const rootDir = process.cwd();
  const [sources, universities] = await Promise.all([loadRegistry(), loadUniversityDirectory()]);
  const latestStatus: Record<string, SourceStatus> = {};
  const refresh = (definition: CatalogSourceDefinition, force = false) =>
    refreshSource(definition, { rootDir, force, checkOnly: !force });
  const scheduler = startScheduler({
    sources: enabledSources(sources),
    rootDir,
    refresh: (definition) => refresh(definition, false),
    onStatus: (status) => {
      latestStatus[status.id] = status;
      const updated = Boolean(status.lastChangedAt && status.lastChangedAt === status.lastFinishedAt);
      const line = status.lastError
        ? `catalog-service ${status.id} check failed: ${status.lastError}`
        : `catalog-service ${status.id} checked${updated ? " (updated)" : ""}`;
      process.stdout.write(`${line}\n`);
    },
  });

  const server = http.createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
        const body = await readBody(request);
        const result = await handleCatalogRequest(request.method ?? "GET", url, body, {
          sources,
          universities,
          rootDir,
          refresh,
          statuses: () => latestStatus,
        });
        response.writeHead(result.status, result.headers);
        response.end(result.body);
      } catch (error) {
        const result = errorBody(error, 500);
        response.writeHead(result.status, result.headers);
        response.end(result.body);
      }
    })();
  });

  server.listen(PORT, HOST, () => {
    process.stdout.write(
      `Catalog service listening on http://${HOST}:${PORT} (${enabledSources(sources).length} enabled source(s); default ${defaultCatalogId()}).\n`,
    );
    void scheduler.tick();
  });
}

if (invokedDirectly()) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
