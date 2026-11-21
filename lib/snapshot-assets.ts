import path from "node:path";

// Cloudflare Workers has no project filesystem. The build (lib/snapshot-manifest.ts)
// validates each published snapshot and copies it to dist/client/_snapshots/<repo path>.
// The Worker reads those files through the ASSETS binding. Node (dev, tests, CLI,
// prerender) has no binding, so a missing disk file stays missing there.
export const SNAPSHOT_ASSET_DIR = "_snapshots";

type Assets = { fetch(input: string): Promise<Response> };

let manifestFiles: Promise<Set<string>> | undefined;
const files = new Map<string, Promise<unknown>>();

async function assetsBinding(): Promise<Assets | undefined> {
  try {
    // @ts-ignore vite.config.ts provides this module: the snapshot files in `vite dev`, undefined in a build.
    const dev = (await import("virtual:published-snapshots")).default as Assets | undefined;
    if (dev) return dev;
  } catch {
    // Node (tests, CLI): no such module.
  }
  try {
    // @ts-ignore cloudflare:workers exists only in workerd; vinext generates its types at build time.
    const { env } = (await import("cloudflare:workers")) as { env: { ASSETS?: Assets } };
    return env.ASSETS;
  } catch {
    return undefined; // Node: no such module. Build-time prerender: bindings throw.
  }
}

function fetchJson(assets: Assets, file: string): Promise<unknown> {
  return assets.fetch(`https://assets.invalid/${SNAPSHOT_ASSET_DIR}/${file}`).then((response) => {
    if (!response.ok) throw new Error(`Snapshot asset ${file} answered ${response.status}`);
    return response.json();
  });
}

/** Keep one parse per isolate; forget a failed fetch so the next request tries again. */
function memo<T>(get: () => Promise<T>, forget: () => void): Promise<T> {
  const pending = get();
  pending.catch(forget);
  return pending;
}

/**
 * The published copy of a repo snapshot file, read through the Worker ASSETS binding.
 * Gives undefined when there is no binding or the build manifest does not list the file.
 * The build validated every listed file, so callers may trust it without a second check.
 */
export async function snapshotAsset(filePath: string): Promise<unknown> {
  const assets = await assetsBinding();
  if (!assets) return undefined;
  const file = path.relative(process.cwd(), filePath).split(path.sep).join("/");
  manifestFiles ??= memo(
    () => fetchJson(assets, "manifest.json").then((manifest) => new Set((manifest as { files: string[] }).files)),
    () => { manifestFiles = undefined; },
  );
  if (!(await manifestFiles).has(file)) return undefined;
  let pending = files.get(file);
  if (!pending) {
    pending = memo(() => fetchJson(assets, file), () => files.delete(file));
    files.set(file, pending);
  }
  return pending;
}
