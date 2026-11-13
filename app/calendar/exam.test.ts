import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExamSlot } from "./exam.ts";

const raw = "MIDTERM<br>12/01/70 13:00-15:00<br>FINAL<br>15/03/70 09:00-12:00";

test("parseExamSlot reads start in Gregorian ISO and end time", () => {
  assert.deepEqual(parseExamSlot(raw, "MIDTERM"), { start: "2027-01-12T13:00", end: "15:00" });
  assert.deepEqual(parseExamSlot(raw, "FINAL"), { start: "2027-03-15T09:00", end: "12:00" });
});

test("parseExamSlot returns empty strings when the exam is missing", () => {
  assert.deepEqual(parseExamSlot("MIDTERM <br>-<br>FINAL <br>-", "MIDTERM"), { start: "", end: "" });
});

test("parseExamSlot keeps start when the end time is absent", () => {
  assert.deepEqual(parseExamSlot("FINAL<br>17/03/70 09:00", "FINAL"), { start: "2027-03-17T09:00", end: "" });
});
