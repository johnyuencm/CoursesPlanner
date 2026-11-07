import path from "node:path";
import universities from "../catalog-service/universities.json";
import catalog from "../data/catalog.json";
import northeasternPrograms from "../data/catalogs/northeastern/programs.json";
import northeasternMscsSeattle from "../data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json";

// Cloudflare Workers has no project filesystem, so the committed snapshot is
// bundled here. Readers try disk first (dev, tests, CLI) and fall back to this.
// ponytail: fixed file list; add an entry when a new committed snapshot file must be served.
const FILES: Record<string, unknown> = {
  "catalog-service/universities.json": universities,
  "data/catalog.json": catalog,
  "data/catalogs/northeastern/programs.json": northeasternPrograms,
  "data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json": northeasternMscsSeattle,
};

/** The bundled JSON for a committed snapshot file, or undefined when it is not bundled. */
export function embeddedJson(filePath: string): unknown {
  const key = path.relative(process.cwd(), filePath).split(path.sep).join("/");
  return Object.hasOwn(FILES, key) ? FILES[key] : undefined;
}
