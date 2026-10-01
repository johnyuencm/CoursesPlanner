import { loadPlan, STORAGE_KEY } from "./plan";
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
): StudentPlan {
  if (event.key !== STORAGE_KEY) return current;
  if (event.storageArea !== undefined && event.storageArea !== storage) return current;
  if (event.newValue === null) return current;
  const loaded = loadPlan(storage);
  if (loaded.error) return current;
  return JSON.stringify(current) === JSON.stringify(loaded.plan) ? current : loaded.plan;
}
