import { test } from "node:test";
import assert from "node:assert/strict";
import { mergePlannerFile, parsePlannerFile, serializePlannerFile, type PlannerSnapshot } from "./planner-file.ts";

const course = (code: string, ids: number[] = [1]) => ({ code, name: `วิชา ${code}`, classes: ids.map((classid) => ({ classid, coursecode: code })) });
const empty: PlannerSnapshot = { pool: [], selectedCodes: [], sectionPicks: {}, groups: [] };
let n = 0;
const newId = () => `new-${++n}`;

test("serialize then parse round-trips the planner", () => {
  const state: PlannerSnapshot = {
    pool: [course("A", [1, 2]), course("B")],
    selectedCodes: ["A"],
    sectionPicks: { A: [2] },
    groups: [{ id: "g1", name: "วิชาเลือก", codes: ["B"] }],
  };
  const parsed = parsePlannerFile(serializePlannerFile(state, new Date("2026-11-11T00:00:00Z")));
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.ok && parsed.data, state);
});

test("parse rejects files that are not ours", () => {
  assert.equal(parsePlannerFile("not json").ok, false);
  assert.equal(parsePlannerFile('{"hello":1}').ok, false);
  assert.equal(parsePlannerFile('{"app":"tablelearn-planner","version":2,"pool":[]}').ok, false);
});

test("parse drops malformed courses and dangling references", () => {
  const raw = JSON.stringify({
    app: "tablelearn-planner",
    version: 1,
    pool: [course("A"), { code: 5 }, { code: "C", name: "x", classes: [{ classid: "bad" }] }],
    selectedCodes: ["A", "Z"],
    sectionPicks: { A: [1], Z: [3] },
    groups: [{ id: "g", name: "กลุ่ม", codes: ["A", "Z"] }],
  });
  const parsed = parsePlannerFile(raw);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.data.pool.map((c) => c.code), ["A", "C"]);
  assert.deepEqual(parsed.data.pool[1].classes, []);
  assert.deepEqual(parsed.data.selectedCodes, ["A"]);
  assert.deepEqual(parsed.data.sectionPicks, { A: [1] });
  assert.deepEqual(parsed.data.groups[0].codes, ["A"]);
});

test("merge adds new courses, keeps existing ones, and carries their ticks and picks", () => {
  const current: PlannerSnapshot = { ...empty, pool: [course("A")], selectedCodes: [] };
  const incoming: PlannerSnapshot = { pool: [course("A", [9]), course("B", [1, 2])], selectedCodes: ["A", "B"], sectionPicks: { A: [9], B: [2] }, groups: [] };
  const { next, added, duplicates, skipped } = mergePlannerFile(current, incoming, { maxPool: 100, newId });
  assert.deepEqual(next.pool.map((c) => c.code), ["A", "B"]);
  assert.deepEqual(next.pool[0].classes.map((c) => c.classid), [1]);
  assert.deepEqual(next.selectedCodes, ["B"]);
  assert.deepEqual(next.sectionPicks, { B: [2] });
  assert.deepEqual({ added, duplicates, skipped }, { added: 1, duplicates: 1, skipped: 0 });
});

test("merge respects the pool limit", () => {
  const current: PlannerSnapshot = { ...empty, pool: [course("A")] };
  const incoming: PlannerSnapshot = { ...empty, pool: [course("B"), course("C"), course("D")] };
  const { next, added, skipped } = mergePlannerFile(current, incoming, { maxPool: 3, newId });
  assert.deepEqual(next.pool.map((c) => c.code), ["A", "B", "C"]);
  assert.deepEqual({ added, skipped }, { added: 2, skipped: 1 });
});

test("merge adds groups, keeps local membership, renames clashes, drops empty groups", () => {
  const current: PlannerSnapshot = {
    pool: [course("A"), course("B")],
    selectedCodes: [],
    sectionPicks: {},
    groups: [{ id: "mine", name: "วิชาเลือก", codes: ["A"] }],
  };
  const incoming: PlannerSnapshot = {
    pool: [course("A"), course("B"), course("C")],
    selectedCodes: [],
    sectionPicks: {},
    groups: [
      { id: "x", name: "วิชาเลือก", codes: ["A", "B", "C"] },
      { id: "y", name: "ว่าง", codes: ["A"] },
    ],
  };
  const { next } = mergePlannerFile(current, incoming, { maxPool: 100, newId });
  assert.equal(next.groups.length, 2);
  assert.deepEqual(next.groups[0], { id: "mine", name: "วิชาเลือก", codes: ["A"] });
  assert.equal(next.groups[1].name, "วิชาเลือก (นำเข้า)");
  assert.deepEqual(next.groups[1].codes, ["B", "C"]);
  assert.ok(next.groups[1].id.startsWith("new-"));
});

test("merge only renames groups that clash with the user's existing groups", () => {
  const incoming: PlannerSnapshot = {
    pool: [course("A"), course("B")],
    selectedCodes: [],
    sectionPicks: {},
    groups: [
      { id: "x", name: "ซ้ำ", codes: ["A"] },
      { id: "y", name: "ซ้ำ", codes: ["B"] },
    ],
  };
  const { next } = mergePlannerFile(empty, incoming, { maxPool: 100, newId });
  assert.deepEqual(next.groups.map((group) => group.name), ["ซ้ำ", "ซ้ำ"]);
});
