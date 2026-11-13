import { test } from "node:test";
import assert from "node:assert/strict";
import { filterGeCourses, geCampuses, geCourses, geCoursesFor, geGroups, type GeCourse } from "./ge-courses.ts";

const c = (code: string, nameTh: string, nameEn: string, group: GeCourse["group"]): GeCourse => ({ code, nameTh, nameEn, credits: "3(3-0-6)", group, campus: "main" });
const sample = [
  c("080303103", "จิตวิทยาเพื่อความสุขในการดำรงชีวิต", "Psychology for Happy Life", "quality"),
  c("080303802", "จิตวิทยาดิจิทัล", "Digital Psychology", "century21"),
  c("080303503", "แบดมินตัน", "Badminton", "sport"),
];

test("filterGeCourses with empty group and query returns all in order", () => {
  assert.deepEqual(filterGeCourses(sample, "", "").map((x) => x.code), ["080303103", "080303802", "080303503"]);
});
test("filterGeCourses filters by group", () => {
  assert.deepEqual(filterGeCourses(sample, "sport", "").map((x) => x.code), ["080303503"]);
});
test("filterGeCourses trims and ignores case", () => {
  assert.deepEqual(filterGeCourses(sample, "", "  badMINTON ").map((x) => x.code), ["080303503"]);
  assert.deepEqual(filterGeCourses(sample, "", " 0803038").map((x) => x.code), ["080303802"]);
});
test("filterGeCourses matches Thai name substring", () => {
  assert.deepEqual(filterGeCourses(sample, "", "จิตวิทยา").map((x) => x.code), ["080303103", "080303802"]);
});
test("filterGeCourses combines group and query", () => {
  assert.deepEqual(filterGeCourses(sample, "quality", "จิตวิทยา").map((x) => x.code), ["080303103"]);
});
test("ge data codes are unique 9-digit", () => {
  const codes = geCourses.map((x) => x.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^\d{9}$/);
});
test("ge data is complete and uses known groups", () => {
  assert.equal(geCourses.length, 188);
  const ids = new Set(geGroups.map((g) => g.id));
  for (const x of geCourses) {
    assert.ok(ids.has(x.group), x.code);
    assert.ok(x.nameTh && x.nameEn, x.code);
    assert.match(x.credits, /^\d\(\d-\d-\d\)$/, x.code);
  }
  assert.deepEqual(geCoursesFor("main").filter((x) => x.required).map((x) => x.code).sort(), ["080103001", "080103002", "080103063", "080203914", "080303701"]);
  assert.deepEqual(geCoursesFor("rayong").filter((x) => x.required).map((x) => x.code).sort(), ["140103001", "140103002", "140103063", "140303611", "140303612"]);
  assert.equal(geCourses.filter((x) => x.citOnly).length, 8);
});

test("geCoursesFor splits the catalog by campus", () => {
  assert.equal(geCoursesFor("main").length, 139);
  assert.equal(geCoursesFor("rayong").length, 49);
  assert.ok(geCoursesFor("rayong").every((x) => /^1[234]0/.test(x.code)));
  assert.ok(geCoursesFor("rayong").every((x) => !x.citOnly));
});

test("geCampuses map to registrar campus ids", () => {
  assert.deepEqual(geCampuses.map((x) => [x.id, x.registrarCampusId]), [["main", "10"], ["rayong", "21"]]);
});
