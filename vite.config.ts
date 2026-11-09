import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { staticAssetsAdapter } from "@vinext/cloudflare/cache/static-assets-adapter";
import { buildSnapshotAssets, programPageIndex } from "./lib/snapshot-manifest";

const DEV_SNAPSHOTS = "virtual:published-snapshots";
const PROGRAM_PAGES = "virtual:program-pages";

/** Validate the published snapshots and ship them as static assets (dist/client/_snapshots/). */
function publishedSnapshots(): Plugin {
  return {
    name: "published-snapshots",
    // `vite dev` also runs the Worker in workerd, with no project files, and its ASSETS
    // binding serves only HTML. So dev gets the same files from a virtual module.
    resolveId(id) {
      return id === DEV_SNAPSHOTS || id === PROGRAM_PAGES ? `\0${id}` : undefined;
    },
    async load(id) {
      // worker.ts: every page path, so the 404 check never reads or parses the full catalog (#110).
      if (id === `\0${PROGRAM_PAGES}`) return `export default ${JSON.stringify(await programPageIndex(process.cwd()))};`;
      if (id !== `\0${DEV_SNAPSHOTS}`) return undefined;
      if (this.environment.mode !== "dev") return "export default undefined;";
      const files = Object.fromEntries(await buildSnapshotAssets(process.cwd()));
      return `const files = ${JSON.stringify(files)};
export default { fetch: async (url) => {
  const file = files[new URL(url).pathname.slice(1)];
  return file === undefined ? new Response(null, { status: 404 }) : new Response(file);
} };`;
    },
    async generateBundle() {
      if (this.environment.name !== "client") return;
      for (const [fileName, source] of await buildSnapshotAssets(process.cwd())) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: staticAssetsAdapter() },
      prerender: { routes: "*" },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
    publishedSnapshots(),
  ],
});
