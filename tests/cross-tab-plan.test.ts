import { strict as assert } from "node:assert";
import test from "node:test";

import { planAfterStorageEvent } from "../lib/cross-tab-plan";
import { emptyPlan, STORAGE_KEY } from "../lib/plan";
import type { StudentPlan } from "../lib/types";

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
  );
  assert.equal(updated, current);
});

test("unrelated, cleared, or unreadable storage events leave the plan untouched (CR2)", () => {
  const current = emptyPlan();
  assert.equal(planAfterStorageEvent({ key: "other-key", newValue: "{}" }, current, storageWith("{}")), current);
  assert.equal(planAfterStorageEvent({ key: STORAGE_KEY, newValue: null }, current, storageWith(null)), current);
  assert.equal(
    planAfterStorageEvent({ key: STORAGE_KEY, newValue: "{not-json" }, current, storageWith("{not-json")),
    current,
  );
  const otherArea = {};
  assert.equal(
    planAfterStorageEvent(
      { key: STORAGE_KEY, newValue: JSON.stringify(current), storageArea: otherArea },
      current,
      storageWith(JSON.stringify(current)),
    ),
    current,
  );
});
