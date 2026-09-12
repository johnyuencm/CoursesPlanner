import path from "node:path";
import { fileURLToPath } from "node:url";
import { refreshCatalog, refreshEnabledSources } from "./refresh";

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const current = path.resolve(fileURLToPath(import.meta.url));
  const invoked = path.resolve(entry);
  return process.platform === "win32" ? current.toLowerCase() === invoked.toLowerCase() : current === invoked;
}

async function main() {
  const arguments_ = process.argv.slice(2);
  const force = arguments_.includes("--force");
  const all = arguments_.includes("--all");
  const idFlag = arguments_.find((argument) => argument.startsWith("--id="));
  const unexpected = arguments_.filter(
    (argument) => argument !== "--force" && argument !== "--all" && !argument.startsWith("--id="),
  );
  if (unexpected.length) throw new Error(`Unknown catalog option: ${unexpected.join(" ")}`);

  if (all) {
    const catalogs = await refreshEnabledSources({ force });
    for (const catalog of catalogs) {
      process.stdout.write(
        `${catalog.id ?? "catalog"}: ${catalog.courses.length} courses, ${catalog.requirements.catalogYear}, ${catalog.warnings.length} warnings.\n`,
      );
    }
    return;
  }

  const catalog = await refreshCatalog({ force, sourceId: idFlag ? idFlag.slice("--id=".length) : undefined });
  process.stdout.write(
    `Catalog refreshed: ${catalog.id ?? "catalog"} · ${catalog.courses.length} courses, ${catalog.requirements.catalogYear}, ${catalog.warnings.length} warnings.\n`,
  );
}

if (invokedDirectly()) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
