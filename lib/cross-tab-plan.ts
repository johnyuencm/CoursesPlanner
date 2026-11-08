import { DEFAULT_CATALOG_KEY, V1_STORAGE_KEYS } from "./catalog-key";
import { loadPlan, planStorageKey } from "./plan";
import type { StudentPlan } from "./types";

/** The subset of a StorageEvent this module needs, so it is testable without a DOM. */
export interface PlanStorageEvent {
  key: string | null;
  newValue: string | null;
  storageArea?: unknown;
}

/**
 * Decide the plan a tab should show after another tab wrote LocalStorage (CR2).
 * Returns the current plan unchanged when the event is unrelated, unreadable, or
 * carries the same plan, so a re-broadcast cannot cause a re-render loop.
 */
export function planAfterStorageEvent(
  event: PlanStorageEvent,
  current: StudentPlan,
  storage: Pick<Storage, "getItem">,
  catalogKey: string,
): StudentPlan {
  // Only the plan of this tab's catalog key. For the default catalog, that includes a v1 write
  // from a tab that still runs the v1 code. A v1 removal (the migration) has no new value.
  const v1Write = catalogKey === DEFAULT_CATALOG_KEY && event.key === V1_STORAGE_KEYS.plan;
  if (event.key !== planStorageKey(catalogKey) && !v1Write) return current;
  if (event.storageArea !== undefined && event.storageArea !== storage) return current;
  if (event.newValue === null) return current;
  const loaded = loadPlan(storage, catalogKey);
  if (loaded.error) return current;
  return JSON.stringify(current) === JSON.stringify(loaded.plan) ? current : loaded.plan;
}
