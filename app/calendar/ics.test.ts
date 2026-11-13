import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, defaultIcsRange, type IcsCourse } from "./ics.ts";

const base: IcsCourse = {
  id: "c1",
  code: "080303503",
  name: "BADMINTON S.1",
  day: "wed",
  start: "13:00",
  end: "15:00",
  room: "52-302",
  teacher: "อ.ดร.ทดสอบ",
  midterm: "2027-01-12T13:00",
  final: "",
};
const range = { firstDay: "2026-11-16", lastDay: "2027-03-05" };
const now = new Date(Date.UTC(2026, 10, 13, 8, 0, 0));
const unfold = (ics: string) => ics.replace(/\r\n /g, "");

test("buildIcs starts weekly class on first matching weekday", () => {
  const ics = unfold(buildIcs([base], range, now));
  assert.ok(ics.includes("DTSTART;TZID=Asia/Bangkok:20261118T130000"));
  assert.ok(ics.includes("DTEND;TZID=Asia/Bangkok:20261118T150000"));
  assert.ok(ics.includes("RRULE:FREQ=WEEKLY;UNTIL=20270305T165959Z"));
  assert.ok(ics.includes("SUMMARY:080303503 BADMINTON S.1"));
  assert.ok(ics.includes("UID:c1@tablelearn"));
});

test("buildIcs uses firstDay when it matches the weekday", () => {
  const ics = unfold(buildIcs([{ ...base, day: "mon", midterm: "" }], range, now));
  assert.ok(ics.includes("DTSTART;TZID=Asia/Bangkok:20261116T130000"));
});

test("buildIcs adds one exam event per unique exam", () => {
  const ics = unfold(buildIcs([base, { ...base, id: "c2", day: "fri" }], range, now));
  assert.equal(ics.split("SUMMARY:สอบกลางภาค 080303503 BADMINTON").length - 1, 1);
  assert.ok(ics.includes("DTSTART;TZID=Asia/Bangkok:20270112T130000"));
  assert.ok(ics.includes("DURATION:PT3H"));
  assert.equal(ics.split("BEGIN:VEVENT").length - 1, 3);
});

test("buildIcs escapes text and uses CRLF", () => {
  const ics = buildIcs([{ ...base, room: "a,b;c" }], range, now);
  assert.ok(unfold(ics).includes("LOCATION:a\\,b\\;c"));
  assert.ok(!/[^\r]\n/.test(ics));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("buildIcs folds long lines by UTF-8 bytes", () => {
  const longName = "ก".repeat(60);
  const ics = buildIcs([{ ...base, name: longName }], range, now);
  for (const line of ics.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, line);
  }
  assert.ok(unfold(ics).includes(`SUMMARY:080303503 ${longName}`));
});

test("buildIcs rejects lastDay before firstDay", () => {
  assert.throws(() => buildIcs([base], { firstDay: "2027-03-05", lastDay: "2026-11-16" }, now), /วันสุดท้ายต้องไม่ก่อนวันแรก/);
});

test("defaultIcsRange picks next Monday and 16 weeks", () => {
  assert.deepEqual(defaultIcsRange(new Date(2026, 10, 13)), { firstDay: "2026-11-16", lastDay: "2027-03-05" });
  assert.equal(defaultIcsRange(new Date(2026, 10, 16)).firstDay, "2026-11-16");
});

test("buildIcs omits placeholder room", () => {
  const ics = buildIcs([{ ...base, room: "-" }], range, now);
  assert.ok(!ics.includes("LOCATION:"));
});

test("buildIcs makes a date-only exam an all-day event", () => {
  const ics = unfold(buildIcs([{ ...base, midterm: "2027-01-12T00:00" }], range, now));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20270112"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20270113"));
  assert.ok(!ics.includes("20270112T000000"));
});

test("buildIcs skips a course with an unknown day instead of throwing", () => {
  const broken = { ...base, id: "bad", day: "xyz" as IcsCourse["day"], midterm: "" };
  const ics = unfold(buildIcs([broken, { ...base, midterm: "" }], range, now));
  assert.equal(ics.split("BEGIN:VEVENT").length - 1, 1);
  assert.ok(!ics.includes("UID:bad@tablelearn"));
});

test("buildIcs names the course in exam summaries without the section", () => {
  const ics = unfold(buildIcs([{ ...base, name: "BADMINTON S.12 (2)" }], range, now));
  assert.ok(ics.includes("SUMMARY:สอบกลางภาค 080303503 BADMINTON"));
  assert.ok(!ics.includes("SUMMARY:สอบกลางภาค 080303503 BADMINTON S.12"));
});
