import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countPlannerSlots,
  interleave,
  moveCodeToGroup,
  nextGroupName,
  nextMenuIndex,
  parseCourseGroups,
  renameGroup,
  replaceableCodes,
  type CourseGroup,
} from "./course-groups.ts";

const g = (id: string, codes: string[], name = id): CourseGroup => ({ id, name, codes });

test("nextGroupName picks the smallest free number", () => {
  assert.equal(nextGroupName([]), "กลุ่ม 1");
  assert.equal(nextGroupName([g("a", [], "กลุ่ม 1"), g("b", [], "กลุ่ม 3")]), "กลุ่ม 2");
});

test("moveCodeToGroup keeps a course in one group only", () => {
  const groups = [g("g1", ["A", "B"]), g("g2", ["C"])];
  const moved = moveCodeToGroup(groups, "A", "g2");
  assert.deepEqual(moved.map((x) => x.codes), [["B"], ["C", "A"]]);
  assert.deepEqual(moveCodeToGroup(moved, "A", null).map((x) => x.codes), [["B"], ["C"]]);
  assert.equal(moveCodeToGroup(groups, "A", "nope"), groups);
});

test("renameGroup trims, caps length, and ignores empty names", () => {
  const groups = [g("g1", [], "เดิม")];
  assert.equal(renameGroup(groups, "g1", "  วิชาเลือก  ")[0].name, "วิชาเลือก");
  assert.equal(renameGroup(groups, "g1", "   ")[0].name, "เดิม");
  assert.equal(renameGroup(groups, "g1", "ก".repeat(60))[0].name.length, 40);
});

test("parseCourseGroups drops bad data instead of breaking the page", () => {
  const pool = new Set(["A", "B", "C"]);
  assert.deepEqual(parseCourseGroups(null, pool), []);
  assert.deepEqual(parseCourseGroups("x", pool), []);
  assert.deepEqual(parseCourseGroups({}, pool), []);
  const parsed = parseCourseGroups(
    [
      { id: "g1", name: "หนึ่ง", codes: ["A", "Z", "B"] },
      { id: 2, name: "ไม่มี id" },
      { id: "g2", name: "สอง", codes: ["B", "C"] },
      { id: "g3", name: "ว่าง", codes: ["Z"] },
    ],
    pool,
  );
  assert.deepEqual(parsed, [g("g1", ["A", "B"], "หนึ่ง"), g("g2", ["C"], "สอง"), g("g3", [], "ว่าง")]);
});

test("countPlannerSlots counts a group with any ticked member as one", () => {
  assert.equal(countPlannerSlots(["A", "B", "C"], [g("g1", ["B", "C"])]), 2);
  assert.equal(countPlannerSlots(["A", "B", "C"], []), 3);
});

test("interleave takes options round-robin so every course in a group gets tried", () => {
  assert.deepEqual(interleave([["a1", "a2", "a3"], ["b1"], ["c1", "c2"]]), ["a1", "b1", "c1", "a2", "c2", "a3"]);
  assert.deepEqual(interleave([]), []);
});

test("replaceableCodes treats every member of a ticked group as replaceable", () => {
  const groups = [g("g1", ["A", "B"]), g("g2", ["C", "D"])];
  assert.deepEqual([...replaceableCodes(["B", "E"], groups)].sort(), ["A", "B", "E"]);
});

test("nextMenuIndex moves with arrow keys and wraps, Home/End jump", () => {
  assert.equal(nextMenuIndex(0, "ArrowDown", 3), 1);
  assert.equal(nextMenuIndex(2, "ArrowDown", 3), 0);
  assert.equal(nextMenuIndex(0, "ArrowUp", 3), 2);
  assert.equal(nextMenuIndex(1, "Home", 3), 0);
  assert.equal(nextMenuIndex(0, "End", 3), 2);
  assert.equal(nextMenuIndex(1, "a", 3), null);
});
