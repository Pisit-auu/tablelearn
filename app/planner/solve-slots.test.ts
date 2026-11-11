import { test } from "node:test";
import assert from "node:assert/strict";
import { solveSlots, type Slot } from "./solve-slots.ts";

type Opt = { id: string; at: string };
const o = (id: string, at: string): Opt => ({ id, at });
// ชนกันเมื่อสองตัวเลือกอยู่ช่วงเวลาเดียวกัน; "busy" คือเวลาที่วิชาที่คงไว้ใช้อยู่แล้ว
const fits = (chosen: Opt[]) => {
  const seen = new Set<string>(["busy"]);
  for (const option of chosen) {
    if (seen.has(option.at)) return false;
    seen.add(option.at);
  }
  return true;
};
const opts = { perSlotCap: 12, maxResults: 20 };
const ids = (picks: (Opt | null)[]) => picks.map((pick) => pick?.id ?? null);

test("single slots only", () => {
  const slots: Slot<Opt>[] = [
    { id: "s1", kind: "single", options: [o("a", "mon")] },
    { id: "s2", kind: "single", options: [o("b", "mon"), o("c", "tue")] },
  ];
  const result = solveSlots(slots, fits, opts);
  assert.deepEqual(result.map((r) => ids(r.picks)), [["a", "c"]]);
  assert.deepEqual(result[0].skipped, []);
});

test("group picks exactly one", () => {
  const slots: Slot<Opt>[] = [{ id: "g", kind: "group", options: [o("x", "mon"), o("y", "tue"), o("z", "wed")] }];
  const result = solveSlots(slots, fits, opts);
  assert.equal(result.length, 3);
  assert.ok(result.every((r) => r.picks.length === 1 && r.picks[0] !== null));
});

test("skip only when nothing fits", () => {
  const slots: Slot<Opt>[] = [
    { id: "s", kind: "single", options: [o("a", "mon")] },
    { id: "g", kind: "group", options: [o("x", "mon"), o("y", "busy")] },
  ];
  const result = solveSlots(slots, fits, opts);
  assert.deepEqual(result.map((r) => ids(r.picks)), [["a", null]]);
  assert.deepEqual(result[0].skipped, ["g"]);
});

test("no skip when something fits", () => {
  const slots: Slot<Opt>[] = [
    { id: "s", kind: "single", options: [o("a", "mon")] },
    { id: "g", kind: "group", options: [o("x", "mon"), o("y", "tue")] },
  ];
  const result = solveSlots(slots, fits, opts);
  assert.deepEqual(result.map((r) => ids(r.picks)), [["a", "y"]]);
});

test("competing groups", () => {
  const slots: Slot<Opt>[] = [
    { id: "A", kind: "group", options: [o("a1", "mon")] },
    { id: "B", kind: "group", options: [o("b1", "mon")] },
  ];
  const result = solveSlots(slots, fits, opts);
  assert.deepEqual(result.map((r) => r.skipped).sort(), [["A"], ["B"]]);
});

test("option beyond cap", () => {
  const options = Array.from({ length: 30 }, (_, index) => o(`x${index}`, index === 29 ? "tue" : "busy"));
  const result = solveSlots([{ id: "g", kind: "group", options }], fits, opts);
  assert.deepEqual(result.map((r) => ids(r.picks)), [["x29"]]);
});

test("slot cap overrides default", () => {
  const options = Array.from({ length: 30 }, (_, index) => o(`x${index}`, `t${index}`));
  const result = solveSlots([{ id: "g", kind: "group", options, cap: 24 }], fits, { perSlotCap: 12, maxResults: 50 });
  assert.equal(result.length, 24);
});

test("maxResults respected", () => {
  const options = Array.from({ length: 10 }, (_, index) => o(`x${index}`, `t${index}`));
  const result = solveSlots([{ id: "g", kind: "group", options }], fits, { perSlotCap: 12, maxResults: 4 });
  assert.equal(result.length, 4);
});
