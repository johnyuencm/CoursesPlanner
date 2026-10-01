import { readFile, stat } from "node:fs/promises";

/** Read a small JSON/HTML cache file, refusing anything over the size cap. */
export async function readBoundedFile(filePath: string): Promise<string> {
  const details = await stat(filePath);
  if (details.size > 5 * 1024 * 1024) throw new Error(`Cached response exceeds 5 MB: ${filePath}`);
  return readFile(filePath, "utf8");
}
