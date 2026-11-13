import { test } from "node:test";
import assert from "node:assert/strict";
import { classQueryParams } from "./class-query.ts";

const filters = {
  academicYear: "2569",
  semester: "2",
  campusId: "10",
  divisionCode: "",
  levelId: "61",
  facultyId: "1",
  departmentId: "12",
  classSet: "B",
  courseSearch: " 010013016 ",
};

test("classQueryParams keeps every browser filter without an override", () => {
  const params = classQueryParams(filters);
  assert.equal(params.get("faculty"), "1");
  assert.equal(params.get("department"), "12");
  assert.equal(params.get("classSet"), "B");
  assert.equal(params.get("courseCode"), "010013016");
});

test("classQueryParams with a course code drops faculty, department and classSet", () => {
  const params = classQueryParams(filters, "080303503");
  assert.equal(params.get("courseCode"), "080303503");
  assert.equal(params.get("faculty"), "");
  assert.equal(params.get("department"), "");
  assert.equal(params.has("classSet"), false);
  assert.equal(params.get("year"), "2569");
  assert.equal(params.get("semester"), "2");
  assert.equal(params.get("campus"), "10");
  assert.equal(params.get("level"), "61");
});
