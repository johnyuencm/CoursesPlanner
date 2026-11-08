import { strict as assert } from "node:assert";
import test from "node:test";

import { DEFAULT_CATALOG_KEY, V1_STORAGE_KEYS } from "../lib/catalog-key";
import { planAfterStorageEvent } from "../lib/cross-tab-plan";
import { emptyPlan, planStorageKey } from "../lib/plan";
import type { StudentPlan } from "../lib/types";

const KEY = DEFAULT_CATALOG_KEY;
const STORAGE_KEY = planStorageKey(KEY);

function storageWith(value: string | null): Pick<Storage, "getItem"> {
  return { getItem: (key: string) => (key === STORAGE_KEY ? value : null) };
}

test("a storage event from another tab updates the plan (CR2)", () => {
  const current = emptyPlan();
  const next: StudentPlan = { ...emptyPlan(), completedCourses: ["CS 5010"] };
  const updated = planAfterStorageEvent(
    { key: STORAGE_KEY, newValue: JSON.stringify(next) },
    current,
    storageWith(JSON.stringify(next)),
    KEY,
  );
  assert.deepEqual(updated.completedCourses, ["CS 5010"]);
});

test("rewriting the same plan does not change state, so the listener cannot loop (CR2)", () => {
  const current: StudentPlan = { ...emptyPlan(), completedCourses: ["CS 5010"] };
  const same = JSON.stringify(current);
  const updated = planAfterStorageEvent(
    { key: STORAGE_KEY, newValue: same },
    current,
    storageWith(same),
    KEY,
  );
  assert.equal(updated, current);
});

test("unrelated, cleared, or unreadable storage events leave the plan untouched (CR2)", () => {
  const current = emptyPlan();
  assert.equal(planAfterStorageEvent({ key: "other-key", newValue: "{}" }, current, storageWith("{}"), KEY), current);
  assert.equal(planAfterStorageEvent({ key: STORAGE_KEY, newValue: null }, current, storageWith(null), KEY), current);
  assert.equal(
    planAfterStorageEvent({ key: STORAGE_KEY, newValue: "{not-json" }, current, storageWith("{not-json"), KEY),
    current,
  );
  const otherArea = {};
  assert.equal(
    planAfterStorageEvent(
      { key: STORAGE_KEY, newValue: JSON.stringify(current), storageArea: otherArea },
      current,
      storageWith(JSON.stringify(current)),
      KEY,
    ),
    current,
  );
});

test("only the plan of this tab's catalog key syncs; the v1 key and other programs do not (#69)", () => {
  const current = emptyPlan();
  const other: StudentPlan = { ...emptyPlan(), completedCourses: ["CS 5010"] };
  const text = JSON.stringify(other);
  const everywhere = { getItem: () => text };
  assert.equal(planAfterStorageEvent({ key: V1_STORAGE_KEYS.plan, newValue: text }, current, everywhere, KEY), current);
  assert.equal(planAfterStorageEvent({ key: V1_STORAGE_KEYS.plan, newValue: null }, current, everywhere, KEY), current);
  assert.equal(
    planAfterStorageEvent({ key: planStorageKey("other/program"), newValue: text }, current, everywhere, KEY),
    current,
  );
});
