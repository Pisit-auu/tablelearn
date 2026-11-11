import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultProgress, markMission, parseProgress, shouldAutoOpen } from "./progress.ts";

test("parseProgress falls back to default for missing or corrupt data", () => {
  assert.deepEqual(parseProgress(null), defaultProgress);
  assert.deepEqual(parseProgress("{bad"), defaultProgress);
  assert.deepEqual(parseProgress('{"version":2}'), defaultProgress);
});

test("parseProgress keeps known missions and drops unknown ids", () => {
  assert.deepEqual(parseProgress('{"version":1,"panelSeen":true,"done":["planner","nope"]}'), {
    version: 1,
    panelSeen: true,
    done: ["planner"],
  });
});

test("markMission adds once and is idempotent", () => {
  const once = markMission(defaultProgress, "lock");
  assert.deepEqual(once.done, ["lock"]);
  assert.equal(markMission(once, "lock"), once);
});

test("shouldAutoOpen only on an unseen first visit without a room link", () => {
  assert.equal(shouldAutoOpen(defaultProgress, false), true);
  assert.equal(shouldAutoOpen(defaultProgress, true), false);
  assert.equal(shouldAutoOpen({ ...defaultProgress, panelSeen: true }, false), false);
});
