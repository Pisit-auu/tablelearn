import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveStep, type Tour, type TourSnapshot } from "./tour-engine.ts";

const empty: TourSnapshot = {
  canEdit: true,
  browserOpen: false,
  searchResultCount: 0,
  plannerPoolCount: 0,
  generatedPlanCount: 0,
  courseCount: 0,
  planCount: 1,
  inRoom: false,
  done: [],
};

const fixture: Tour = {
  mission: "planner",
  requiresEdit: true,
  steps: [
    { id: "A", title: "a", body: "", targets: [], kind: "action", isDone: (s) => s.plannerPoolCount >= 2 },
    { id: "B", title: "b", body: "", targets: [], kind: "info", nextLabel: "ต่อ" },
    { id: "C", title: "c", body: "", targets: [], kind: "action", isDone: (s) => s.done.includes("planner") },
  ],
};

test("starts at the first unfinished step", () => {
  assert.equal(resolveStep(fixture, empty, new Set()), 0);
});

test("info step waits for acknowledgement", () => {
  assert.equal(resolveStep(fixture, { ...empty, plannerPoolCount: 2 }, new Set()), 1);
  assert.equal(resolveStep(fixture, { ...empty, plannerPoolCount: 2 }, new Set(["B"])), 2);
});

test("returns -1 when every step is finished", () => {
  assert.equal(resolveStep(fixture, { ...empty, plannerPoolCount: 2, done: ["planner"] }, new Set(["B"])), -1);
});

test("rewinds when an earlier action step is undone", () => {
  assert.equal(resolveStep(fixture, { ...empty, plannerPoolCount: 1 }, new Set(["B"])), 0);
});
