/**
 * Catalog key (`<universityId>/<programId>`) and per-program browser storage (#69).
 * This file has no Node imports, so client code can use it.
 */

/** Northeastern MSCS Seattle, the catalog in `data/catalog.json`. */
export const DEFAULT_CATALOG_KEY = "northeastern/computer-science-mscs-sea-8b0d00dbda";

/**
 * Full catalogs (`Catalog`) that `/api/catalog` serves, by catalog key.
 * `id`: the old catalog id (`Catalog.id`, catalog-service source id). It stays a valid alias.
 * `adapter`: gives the course-code grammar before the catalog loads.
 *
 * ponytail: one hand-written entry, because only one full catalog is published.
 * Read the keys from the snapshot manifest when a second full catalog ships.
 */
export const CATALOGS: Readonly<Record<string, { id: string; adapter: string }>> = {
  [DEFAULT_CATALOG_KEY]: { id: "neu-mscs-seattle", adapter: "northeastern-acalog" },
};

/** The canonical key for a catalog key or an old catalog id, or null when no catalog has it. */
export function canonicalCatalogKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (Object.hasOwn(CATALOGS, value)) return value;
  return Object.keys(CATALOGS).find((key) => CATALOGS[key]!.id === value) ?? null;
}

/** LocalStorage key of the remembered catalog key. */
export const CATALOG_KEY_PREFERENCE = "coursesplanner:catalog-key";

/** The remembered catalog key, or the default when none is stored or it is unknown. */
export function rememberedCatalogKey(storage: Pick<Storage, "getItem">): string {
  try {
    return canonicalCatalogKey(storage.getItem(CATALOG_KEY_PREFERENCE)) ?? DEFAULT_CATALOG_KEY;
  } catch {
    return DEFAULT_CATALOG_KEY;
  }
}

/** v1 LocalStorage keys. They had no catalog key, so they belong to the default catalog. */
export const V1_STORAGE_KEYS = {
  plan: "neu-mscs-planner-plan-v1",
  pathways: "neu-mscs-planner-pathways-v1",
  "career-target": "neu-mscs-career-target-v1",
  "course-target": "neu-mscs-course-target-v1",
  "workspace-selection": "neu-mscs-workspace-selection-v1",
} as const;

export type CatalogValueName = keyof typeof V1_STORAGE_KEYS;

/** v2 LocalStorage key of one per-program value. */
export function catalogStorageKey(name: CatalogValueName, catalogKey: string): string {
  return `coursesplanner:v2:${catalogKey}:${name}`;
}

/**
 * Read a per-program value. For the default catalog with no v2 value, give the v1 value.
 * This never writes, so unreadable v1 data stays as it is.
 */
export function readCatalogValue(
  storage: Pick<Storage, "getItem">,
  name: CatalogValueName,
  catalogKey: string,
): string | null {
  const value = storage.getItem(catalogStorageKey(name, catalogKey));
  if (value !== null || catalogKey !== DEFAULT_CATALOG_KEY) return value;
  return storage.getItem(V1_STORAGE_KEYS[name]);
}

/**
 * Write (or remove, for null) a per-program value under its v2 key.
 * The v1 value is removed only after the v2 value is read back unchanged.
 * That completes the one-time v1 migration with no data loss.
 */
export function writeCatalogValue(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  name: CatalogValueName,
  catalogKey: string,
  value: string | null,
): void {
  const key = catalogStorageKey(name, catalogKey);
  if (value === null) storage.removeItem(key);
  else {
    storage.setItem(key, value);
    if (storage.getItem(key) !== value) throw new Error("Browser storage did not keep the saved value.");
  }
  if (catalogKey === DEFAULT_CATALOG_KEY) storage.removeItem(V1_STORAGE_KEYS[name]);
}
