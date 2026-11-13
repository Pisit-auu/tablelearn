import { test } from "node:test";
import assert from "node:assert/strict";
import { helpCopy } from "./help-copy.ts";
import { resolveStep, type TourSnapshot } from "./tour-engine.ts";
import { allTourTargets, missions, tours } from "./tours.ts";

const base: TourSnapshot = {
  canEdit: true,
  browserOpen: false,
  searchResultCount: 0,
  plannerPoolCount: 0,
  generatedPlanCount: 0,
  courseCount: 0,
  planCount: 1,
  inRoom: false,
  plannerNotice: null,
  done: [],
};

const stepIndex = (id: string) => tours.planner.steps.findIndex((step) => step.id === id);

test("missions are listed in the agreed order", () => {
  assert.deepEqual(missions.map((m) => m.id), ["tour", "planner", "lock", "compare", "room"]);
});

test("planner tour starts at generate when the pool already has courses", () => {
  assert.equal(resolveStep(tours.planner, { ...base, plannerPoolCount: 3 }, new Set()), stepIndex("generate"));
});

test("planner tour rewinds to the first step when the dialog closes too early", () => {
  assert.equal(resolveStep(tours.planner, { ...base, plannerPoolCount: 1 }, new Set()), 0);
});

test("planner tour asks to add courses once results are showing", () => {
  assert.equal(
    resolveStep(tours.planner, { ...base, browserOpen: true, searchResultCount: 5, plannerPoolCount: 1 }, new Set()),
    stepIndex("add"),
  );
});

test("every tour target is a known data-tour name", () => {
  for (const tour of Object.values(tours)) {
    for (const step of tour.steps) {
      for (const target of step.targets) {
        assert.ok(allTourTargets.includes(target), `${tour.mission}/${step.id} → ${target}`);
      }
    }
  }
});

test("help copy covers all 9 sections", () => {
  assert.equal(Object.keys(helpCopy).length, 9);
});

test("generate step explains why no plan came out and suggests fewer courses", () => {
  const generate = tours.planner.steps[stepIndex("generate")];
  const notice = "วิชาที่ล็อกหรือวิชาที่คงไว้มีเวลาชนกัน จึงสร้างแผนไม่ได้";
  assert.equal(generate.hint?.({ ...base, plannerPoolCount: 3, plannerNotice: notice }), `${notice} ลองติ๊กวิชาให้น้อยลงแล้วกดสร้างแผนอีกครั้ง`);
  assert.equal(generate.hint?.({ ...base, plannerPoolCount: 3, plannerNotice: null }), null);
});
