import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CatalogSourceDefinition } from "./source-types";

export interface SourceStatus {
  id: string;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastCheckedAt?: string;
  lastChangedAt?: string;
  lastError?: string | null;
}

interface SchedulerState {
  version: 1;
  sources: Record<string, SourceStatus>;
}

export interface SchedulerOptions {
  sources: CatalogSourceDefinition[];
  tickMs?: number;
  now?: () => Date;
  refresh: (definition: CatalogSourceDefinition) => Promise<{ changed: boolean }>;
  rootDir?: string;
  onStatus?: (status: SourceStatus) => void;
}

function statePath(rootDir: string) {
  return path.join(rootDir, "data", "catalogs", ".scheduler-status.json");
}

async function readState(filePath: string): Promise<SchedulerState> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && "sources" in parsed) {
      return parsed as SchedulerState;
    }
  } catch {
    /* First run has no status file. */
  }
  return { version: 1, sources: {} };
}

async function writeState(filePath: string, state: SchedulerState): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

export function isDue(definition: CatalogSourceDefinition, status: SourceStatus | undefined, now: Date): boolean {
  if (!definition.enabled) return false;
  const last = status?.lastCheckedAt ?? status?.lastFinishedAt;
  if (!last) return true;
  const elapsed = now.getTime() - Date.parse(last);
  return Number.isNaN(elapsed) || elapsed >= definition.pollIntervalMs;
}

export async function runDueSources(options: SchedulerOptions): Promise<SourceStatus[]> {
  const now = options.now ?? (() => new Date());
  const rootDir = options.rootDir ?? process.cwd();
  const filePath = statePath(rootDir);
  const state = await readState(filePath);
  const results: SourceStatus[] = [];
  for (const definition of options.sources) {
    const current = now();
    if (!isDue(definition, state.sources[definition.id], current)) continue;
    const status: SourceStatus = {
      ...(state.sources[definition.id] ?? { id: definition.id }),
      id: definition.id,
      lastStartedAt: current.toISOString(),
      lastError: null,
    };
    try {
      const result = await options.refresh(definition);
      status.lastFinishedAt = now().toISOString();
      status.lastCheckedAt = status.lastFinishedAt;
      if (result.changed) status.lastChangedAt = status.lastFinishedAt;
    } catch (error) {
      status.lastFinishedAt = now().toISOString();
      status.lastCheckedAt = status.lastFinishedAt;
      status.lastError = error instanceof Error ? error.message : String(error);
    }
    state.sources[definition.id] = status;
    results.push(status);
    options.onStatus?.(status);
  }
  if (results.length) await writeState(filePath, state);
  return results;
}

export function startScheduler(options: SchedulerOptions): { stop: () => void; tick: () => Promise<SourceStatus[]> } {
  const tickMs = options.tickMs ?? 60_000;
  const tick = () => runDueSources(options);
  const timer = setInterval(() => {
    void tick();
  }, tickMs);
  timer.unref?.();
  return {
    stop: () => clearInterval(timer),
    tick,
  };
}
