"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendFeedbackAction } from "./actions/feedback";
import { loadSharedPlanAction, saveSharedPlanAction } from "./actions/shared-plans";
import { HelpButton } from "./onboarding/HelpButton";
import { MissionPanel } from "./onboarding/MissionPanel";
import { TourOverlay } from "./onboarding/TourOverlay";
import { useOnboarding } from "./onboarding/useOnboarding";
import { countPlannerSlots, groupOfCode, interleave, moveCodeToGroup, nextGroupName, parseCourseGroups, removeGroup, renameGroup, replaceableCodes, type CourseGroup } from "./planner/course-groups";
import { GroupMoveMenu, GroupNameInput } from "./planner/GroupControls";
import { mergePlannerFile, parsePlannerFile, plannerFileName, serializePlannerFile, type PlannerSnapshot } from "./planner/planner-file";
import { selectTopPlans, solveSlots, type Slot } from "./planner/solve-slots";
import { buildIcs, defaultIcsRange } from "./calendar/ics";
import { classQueryParams, type CatalogQuery } from "./ge/class-query";
import { filterGeCourses, GE_SOURCE_URL, geCampuses, geCoursesFor, geGroups, type GeCampus, type GeGroupId } from "./ge/ge-courses";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type Course = {
  id: string;
  name: string;
  code: string;
  credits: number;
  day: DayKey;
  start: string;
  end: string;
  room: string;
  teacher: string;
  midterm: string;
  final: string;
  color: string;
  locked?: boolean;
  // ซ่อนจากตารางชั่วคราว: ไม่แสดง ไม่นับหน่วยกิตและเวลาชน แต่ยังเก็บไว้ในรายวิชาที่บันทึก
  hidden?: boolean;
};

type TimetablePlan = {
  id: string;
  name: string;
  courses: Course[];
  source?: "local" | "shared";
  sharedId?: string;
  canEdit?: boolean;
};

type ShareSession = {
  shareId: string;
  editToken: string;
  localPlanId: string;
  localPlanIds: string[];
  mode: "view" | "edit";
  status: "idle" | "saving" | "syncing" | "conflict" | "readonly";
  lastServerUpdatedAt: string;
  dirty: boolean;
};

type SharedRoomPlan = {
  id: string;
  name: string;
  courses: Course[];
};

type RemoteClass = {
  classid: number;
  coursecode: string;
  coursename: string;
  sectioncode: string;
  classtime: string;
  classexam: string;
  courseunit: string;
  instructor?: {
    prefixname?: string;
    officername?: string;
    officersurname?: string;
  }[];
};

type RemoteCourseGroup = {
  code: string;
  name: string;
  classes: RemoteClass[];
};

type ComboOption = {
  comboid: number | string;
  comboshow: string;
};

type FilterOptions = {
  campuses: ComboOption[];
  divisions: ComboOption[];
  levels: ComboOption[];
  faculties: ComboOption[];
  classSets: ComboOption[];
};

type GeneratedSchedulePlan = {
  id: string;
  name: string;
  courses: Course[];
  score: number;
  reasons: string[];
  // ป้ายบอกว่าแต่ละกลุ่ม "เลือก 1 วิชา" ได้วิชาไหน หรือถูกข้าม
  groupNotes: { groupId: string; group: string; text: string; skipped: boolean }[];
};

const days: { key: DayKey; label: string; short: string }[] = [
  { key: "mon", label: "จันทร์", short: "จ" },
  { key: "tue", label: "อังคาร", short: "อ" },
  { key: "wed", label: "พุธ", short: "พ" },
  { key: "thu", label: "พฤหัส", short: "พฤ" },
  { key: "fri", label: "ศุกร์", short: "ศ" },
  { key: "sat", label: "เสาร์", short: "ส" },
  { key: "sun", label: "อาทิตย์", short: "อา" },
];

// course pigments: registrar-family hues darkened to clear 4.5:1 on white,
// deliberately excluding the danger red that only a time clash may wear.
const palette = ["#0a7d75", "#5847c7", "#0f6f96", "#1c7d47", "#a35c12", "#4f5b6b", "#7b3fa0"];
const hours = Array.from({ length: 14 }, (_, index) => 7 + index);
const fallbackFilters: FilterOptions = {
  campuses: [{ comboid: 10, comboshow: "10 : มจพ. กรุงเทพฯ" }],
  divisions: [],
  levels: [{ comboid: 61, comboshow: "61 : ปริญญาตรี 4 ปี / 5 ปี" }],
  faculties: [{ comboid: 4, comboshow: "04 : คณะวิทยาศาสตร์ประยุกต์" }],
  classSets: [],
};
const emptyCourse = {
  name: "",
  code: "",
  credits: 3,
  day: "mon" as DayKey,
  start: "09:00",
  end: "10:30",
  room: "",
  teacher: "",
  midterm: "",
  final: "",
};
const defaultPlanName = "ตาราง1";
const noCourses: Course[] = [];
const maxExcelFileSize = 1024 * 1024;
const maxExcelRows = 80;

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function overlaps(a: Course, b: Course) {
  return a.day === b.day && toMinutes(a.start) < toMinutes(b.end) && toMinutes(a.end) > toMinutes(b.start);
}

function coursesHaveConflict(courseList: Course[]) {
  return courseList.some((course, index) => courseList.slice(index + 1).some((next) => overlaps(course, next)));
}

function stripHtml(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}

function parseCredits(value: string) {
  return Number(value.match(/^\d+/)?.[0] ?? 3);
}

function parseClassTime(value: string) {
  return parseClassMeetings(value)[0] ?? {
    day: "mon" as DayKey,
    start: "09:00",
    end: "10:00",
    room: "",
  };
}

function parseClassMeetings(value: string) {
  const clean = stripHtml(value);
  const dayMap: Record<string, DayKey> = {
    จ: "mon",
    อ: "tue",
    พ: "wed",
    พฤ: "thu",
    ศ: "fri",
    ส: "sat",
    อา: "sun",
  };
  const lines = clean.split("\n").map((line) => line.trim()).filter(Boolean);
  const meetings: { day: DayKey; start: string; end: string; room: string }[] = [];

  lines.forEach((line, index) => {
    const match = line.match(/(จ|อา|อ|พฤ|พ|ศ|ส)\.?\s+(\d{2}:\d{2})-(\d{2}:\d{2})/);

    if (!match) {
      return;
    }

    meetings.push({
      day: dayMap[match[1]],
      start: match[2],
      end: match[3],
      room: lines[index + 1]?.match(/ห้อง\s+(.+)/)?.[1]?.trim() ?? "",
    });
  });

  return meetings;
}

function parseExam(value: string, type: "MIDTERM" | "FINAL") {
  const clean = stripHtml(value);
  const match = clean.match(new RegExp(`${type}\\s+(\\d{2})/(\\d{2})/(\\d{2})\\s+(\\d{2}:\\d{2})`, "i"));

  if (!match) {
    return "";
  }

  const buddhistYear = 2500 + Number(match[3]);
  const gregorianYear = buddhistYear - 543;
  return `${gregorianYear}-${match[2]}-${match[1]}T${match[4]}`;
}

function teacherName(remoteClass: RemoteClass) {
  return remoteClass.instructor?.map((teacher) => `${teacher.prefixname ?? ""}${teacher.officername ?? ""} ${teacher.officersurname ?? ""}`.trim()).join(", ") ?? "";
}

function remoteClassToCourses(remoteClass: RemoteClass, color: string): Course[] {
  const meetings = parseClassMeetings(remoteClass.classtime);

  return (meetings.length > 0 ? meetings : [parseClassTime(remoteClass.classtime)]).map((meeting, index, allMeetings) => ({
    id: crypto.randomUUID(),
    name: `${remoteClass.coursename} S.${remoteClass.sectioncode}${allMeetings.length > 1 ? ` (${index + 1})` : ""}`,
    code: remoteClass.coursecode,
    credits: parseCredits(remoteClass.courseunit),
    day: meeting.day,
    start: meeting.start,
    end: meeting.end,
    room: meeting.room,
    teacher: teacherName(remoteClass),
    midterm: parseExam(remoteClass.classexam, "MIDTERM"),
    final: parseExam(remoteClass.classexam, "FINAL"),
    color,
  }));
}

function comboValue(option: ComboOption) {
  return String(option.comboid).replace(/\.0$/, "");
}

const examDateFormat = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function examText(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : examDateFormat.format(date);
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function rowValue(row: Record<string, unknown>, keys: string[]) {
  const normalizedKeys = new Map(Object.keys(row).map((key) => [key.trim().toLowerCase(), key]));
  const match = keys.map((key) => normalizedKeys.get(key.trim().toLowerCase())).find(Boolean);

  return match ? normalizeText(row[match]) : "";
}

function parseImportedDay(value: string): DayKey {
  const normalized = value.trim().toLowerCase();
  const matchedDay = days.find((day) => [day.key, day.label, day.short].some((item) => item.toLowerCase() === normalized));

  if (matchedDay) {
    return matchedDay.key;
  }

  if (normalized.startsWith("mon")) return "mon";
  if (normalized.startsWith("tue")) return "tue";
  if (normalized.startsWith("wed")) return "wed";
  if (normalized.startsWith("thu")) return "thu";
  if (normalized.startsWith("fri")) return "fri";
  if (normalized.startsWith("sat")) return "sat";
  if (normalized.startsWith("sun")) return "sun";

  return "mon";
}

function parseImportedTime(value: string, fallback: string) {
  const match = value.match(/(\d{1,2}):(\d{2})/);

  if (!match) {
    return fallback;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function parseImportedDateTime(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${isoMatch[4] ?? "00"}:${isoMatch[5] ?? "00"}`;
  }

  const dateMatch = normalized.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+(\d{1,2}):(\d{2}))?/);
  if (!dateMatch) {
    return "";
  }

  const year = Number(dateMatch[3]) > 2400 ? Number(dateMatch[3]) - 543 : Number(dateMatch[3]);
  return `${year}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}T${(dateMatch[4] ?? "00").padStart(2, "0")}:${dateMatch[5] ?? "00"}`;
}

function excelCellText(value: unknown) {
  if (value instanceof Date) {
    return value.toLocaleString("th-TH");
  }

  if (typeof value === "object" && value !== null) {
    const maybeCell = value as { text?: unknown; result?: unknown; richText?: { text?: unknown }[] };

    if (maybeCell.text) {
      return normalizeText(maybeCell.text);
    }

    if (maybeCell.result) {
      return normalizeText(maybeCell.result);
    }

    if (Array.isArray(maybeCell.richText)) {
      return maybeCell.richText.map((part) => normalizeText(part.text)).join("");
    }
  }

  return normalizeText(value);
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement("a");
  link.download = filename.replace(/[\\/:*?"<>|]/g, "_");
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;

    if (context.measureText(nextLine).width <= maxWidth) {
      line = nextLine;
      return;
    }

    if (line) {
      lines.push(line);
    }
    line = word;
  });

  if (line) {
    lines.push(line);
  }

  lines.slice(0, maxLines).forEach((currentLine, index) => {
    const displayLine = index === maxLines - 1 && lines.length > maxLines ? `${currentLine.slice(0, Math.max(0, currentLine.length - 1))}...` : currentLine;
    context.fillText(displayLine, x, y + index * lineHeight);
  });
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const saved = window.localStorage.getItem(key);

  if (!saved) {
    return fallback;
  }

  try {
    return JSON.parse(saved) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

const plannerStorageKey = "student-timetable-planner";
const excludedStorageKey = "student-timetable-excluded";

// วิชาที่ผู้ใช้บอกว่าไม่เอาแน่นอน ซ่อนจากผลค้นหาและจำไว้ข้ามการเปิดหน้า
type ExcludedCourse = { code: string; name: string };

function readExcludedCourses(): ExcludedCourse[] {
  const saved = readJson<unknown>(excludedStorageKey, []);

  if (!Array.isArray(saved)) {
    return [];
  }

  return saved.filter(
    (item): item is ExcludedCourse => !!item && typeof item === "object" && typeof item.code === "string" && typeof item.name === "string",
  );
}
// จำกัดวิชาในตัวช่วยจัดแผน กันไม่ให้ localStorage โตจนเต็ม
const maxPlannerPool = 100;

type SavedPlanner = {
  pool: RemoteCourseGroup[];
  selectedCodes: string[];
  sectionPicks: Record<string, number[]>;
  groups: CourseGroup[];
  avoidDays: DayKey[];
  start: string;
  end: string;
  lunchBreak: boolean;
};

// อ่านตัวช่วยจัดแผนที่บันทึกไว้ ตัดข้อมูลที่รูปร่างไม่ถูกทิ้งไปแทนที่จะพังทั้งหน้า
function readSavedPlanner(): Partial<SavedPlanner> {
  const saved = readJson<Partial<SavedPlanner> | null>(plannerStorageKey, null);

  if (!saved || typeof saved !== "object") {
    return {};
  }

  const pool = Array.isArray(saved.pool)
    ? saved.pool.filter((group) => group && typeof group.code === "string" && Array.isArray(group.classes)).slice(0, maxPlannerPool)
    : [];
  const poolCodes = new Set(pool.map((group) => group.code));
  const sectionPicks: Record<string, number[]> = {};

  if (saved.sectionPicks && typeof saved.sectionPicks === "object") {
    Object.entries(saved.sectionPicks).forEach(([code, ids]) => {
      if (poolCodes.has(code) && Array.isArray(ids) && ids.length > 0) {
        sectionPicks[code] = ids.filter((id) => typeof id === "number");
      }
    });
  }

  const validDayKeys = new Set(days.map((day) => day.key));

  return {
    pool,
    selectedCodes: Array.isArray(saved.selectedCodes) ? saved.selectedCodes.filter((code) => poolCodes.has(code)) : [],
    sectionPicks,
    groups: parseCourseGroups(saved.groups, poolCodes),
    avoidDays: Array.isArray(saved.avoidDays) ? saved.avoidDays.filter((day) => validDayKeys.has(day)) : undefined,
    start: typeof saved.start === "string" && /^\d{2}:\d{2}$/.test(saved.start) ? saved.start : undefined,
    end: typeof saved.end === "string" && /^\d{2}:\d{2}$/.test(saved.end) ? saved.end : undefined,
    lunchBreak: typeof saved.lunchBreak === "boolean" ? saved.lunchBreak : undefined,
  };
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeRoomCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function localRoomPlanId(roomId: string, planId: string) {
  return `shared-${roomId}-${planId}`;
}

function roomPlanIdFromLocal(roomId: string, localId: string) {
  return localId.startsWith(`shared-${roomId}-`) ? localId.slice(`shared-${roomId}-`.length) : localId;
}

function freeSlotsForCourses(courseList: Course[]) {
  return days.flatMap((day) => {
    const dayCourses = courseList
      .filter((course) => course.day === day.key)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    const slots: { day: DayKey; label: string; start: string; end: string; minutes: number }[] = [];
    let cursor = hours[0] * 60;
    const endOfDay = (hours[hours.length - 1] + 1) * 60;

    dayCourses.forEach((course) => {
      const start = Math.max(hours[0] * 60, toMinutes(course.start));

      if (start - cursor >= 45) {
        slots.push({
          day: day.key,
          label: day.label,
          start: minutesToTime(cursor),
          end: minutesToTime(start),
          minutes: start - cursor,
        });
      }

      cursor = Math.max(cursor, toMinutes(course.end));
    });

    if (endOfDay - cursor >= 45) {
      slots.push({
        day: day.key,
        label: day.label,
        start: minutesToTime(cursor),
        end: minutesToTime(endOfDay),
        minutes: endOfDay - cursor,
      });
    }

    return slots;
  });
}

function minutesToTime(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function hasLunchBreak(courseList: Course[]) {
  return days.every((day) => {
    const dayCourses = courseList.filter((course) => course.day === day.key);

    if (dayCourses.length === 0) {
      return true;
    }

    return !dayCourses.some((course) => toMinutes(course.start) < 13 * 60 && toMinutes(course.end) > 12 * 60);
  });
}

function examItems(courseList: Course[]) {
  return courseList.flatMap((course) => [
    course.midterm ? { course, type: "กลางภาค", value: course.midterm } : null,
    course.final ? { course, type: "ปลายภาค", value: course.final } : null,
  ]).filter(Boolean) as { course: Course; type: string; value: string }[];
}

function examCourseIdentity(course: Course) {
  return `${course.code}|${course.name.replace(/\s+\(\d+\)$/, "")}`;
}

function examWarningsForCourses(courseList: Course[]) {
  const items = examItems(courseList);

  return items.flatMap((item, index) =>
    items.slice(index + 1).flatMap((next) => {
      if (examCourseIdentity(item.course) === examCourseIdentity(next.course)) {
        return [];
      }

      const start = new Date(item.value).getTime();
      const end = new Date(next.value).getTime();

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return [];
      }

      const diff = Math.abs(start - end);
      const hoursApart = diff / 36e5;
      const sameDay = new Date(item.value).toDateString() === new Date(next.value).toDateString();

      if (hoursApart < 2.5) {
        return [`${item.course.code} ${item.type} ชนหรือใกล้กับ ${next.course.code} ${next.type}`];
      }

      if (sameDay && hoursApart < 6) {
        return [`${item.course.code} ${item.type} กับ ${next.course.code} ${next.type} อยู่วันเดียวกันและห่างกันน้อย`];
      }

      return [];
    }),
  );
}

function courseKey(course: Course) {
  return `${course.code}|${course.name}|${course.day}|${course.start}|${course.end}|${course.room}`;
}

function nextTableName(planList: TimetablePlan[]) {
  const usedNumbers = new Set(
    planList
      .map((plan) => plan.name.match(/^ตาราง(\d+)$/)?.[1])
      .filter(Boolean)
      .map(Number),
  );
  let nextNumber = 1;

  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  return `ตาราง${nextNumber}`;
}

function localPlansOnly(planList: TimetablePlan[]) {
  return planList.filter((plan) => !plan.sharedId);
}

function ensureLocalPlans(planList: TimetablePlan[]) {
  const localPlans = localPlansOnly(planList);

  return localPlans.length > 0 ? localPlans : [{ id: "default", name: defaultPlanName, courses: [] }];
}

// section ที่เรียนหลายคาบถูกแยกเป็นหลายรายการ ("ชื่อ S.2 (1)", "ชื่อ S.2 (2)")
// คาบของ section เดียวกันจึงจับคู่กันด้วยรหัสวิชา + ชื่อที่ตัดเลขคาบออก
function courseGroupKey(course: Course) {
  return `${course.code}|${course.name.replace(/\s\(\d+\)$/, "")}`;
}

function uniqueCourseGroups(courseList: Course[]) {
  const groups = new Map<string, Course>();
  courseList.forEach((course) => {
    if (!groups.has(courseGroupKey(course))) {
      groups.set(courseGroupKey(course), course);
    }
  });
  return Array.from(groups.values());
}

// นับหน่วยกิตครั้งเดียวต่อ section ไม่ใช่ต่อคาบ
function sumCredits(courseList: Course[]) {
  return uniqueCourseGroups(courseList).reduce((sum, course) => sum + course.credits, 0);
}

// จัดแถว (lane) ของคาบในวันเดียว: คาบที่ซ้อนเวลากันแยกแถว ไม่ทับกัน
// คาบของ section เดียวกันที่ต่อกันพอดี (เช่น 17:00-19:00 กับ 19:00-21:00) นับเป็นก้อนเดียว จึงอยู่แถวเดียวกันเสมอ
function packDayLanes(courseList: Course[], dayKey: DayKey, dayStart: number, dayEnd: number) {
  const items = courseList
    .filter((course) => course.day === dayKey && toMinutes(course.start) < dayEnd && toMinutes(course.end) > dayStart)
    .map((course) => ({
      course,
      start: Math.max(dayStart, toMinutes(course.start)),
      finish: Math.min(dayEnd, toMinutes(course.end)),
    }))
    .sort((a, b) => a.start - b.start || a.finish - b.finish);

  const units: { start: number; finish: number; members: typeof items }[] = [];
  const openUnitByGroup = new Map<string, (typeof units)[number]>();

  items.forEach((item) => {
    const key = courseGroupKey(item.course);
    const unit = openUnitByGroup.get(key);

    if (unit && unit.finish === item.start) {
      unit.members.push(item);
      unit.finish = item.finish;
      return;
    }

    const nextUnit = { start: item.start, finish: item.finish, members: [item] };
    units.push(nextUnit);
    openUnitByGroup.set(key, nextUnit);
  });

  const laneEnds: number[] = [];
  const placed = units
    .sort((a, b) => a.start - b.start || a.finish - b.finish)
    .flatMap((unit) => {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= unit.start);

      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(unit.finish);
      } else {
        laneEnds[lane] = unit.finish;
      }

      return unit.members.map((member) => ({ ...member, lane }));
    });

  return { placed, laneCount: Math.max(1, laneEnds.length) };
}

function planStats(courseList: Course[]) {
  const usedDays = new Set(courseList.map((course) => course.day));
  const freeMinutes = freeSlotsForCourses(courseList)
    .filter((slot) => usedDays.has(slot.day))
    .reduce((sum, slot) => sum + slot.minutes, 0);

  return {
    credits: sumCredits(courseList),
    usedDays: usedDays.size,
    freeHours: Math.round((freeMinutes / 60) * 10) / 10,
    conflicts: courseList.flatMap((course, index) => courseList.slice(index + 1).filter((next) => overlaps(course, next))).length,
  };
}

function scorePlan(courseList: Course[], avoidDays: DayKey[], preferredStart: string, preferredEnd: string, requireLunchBreak: boolean) {
  let score = 100;
  const reasons: string[] = [];
  const startLimit = toMinutes(preferredStart);
  const endLimit = toMinutes(preferredEnd);
  const usedDays = new Set(courseList.map((course) => course.day));
  const freeSlots = freeSlotsForCourses(courseList);

  courseList.forEach((course) => {
    if (avoidDays.includes(course.day)) {
      score -= 12;
    }

    if (toMinutes(course.start) < startLimit) {
      score -= 8;
    }

    if (toMinutes(course.end) > endLimit) {
      score -= 8;
    }
  });

  const longGaps = freeSlots.filter((slot) => slot.minutes >= 120 && usedDays.has(slot.day)).length;
  score -= Math.min(longGaps * 3, 15);

  if (requireLunchBreak && !hasLunchBreak(courseList)) {
    score -= 12;
  }

  if (avoidDays.length > 0 && courseList.some((course) => avoidDays.includes(course.day))) {
    reasons.push("มีเรียนในวันที่ไม่อยากเรียน");
  }

  if (courseList.some((course) => toMinutes(course.start) < startLimit || toMinutes(course.end) > endLimit)) {
    reasons.push("มีวิชานอกช่วงเวลาที่ตั้งไว้");
  }

  if (longGaps > 0) {
    reasons.push(`มีช่องว่างยาว ${longGaps} ช่วง`);
  }

  if (requireLunchBreak && !hasLunchBreak(courseList)) {
    reasons.push("พักเที่ยงไม่ครบทุกวันที่มีเรียน");
  }

  if (reasons.length === 0) {
    reasons.push("ไม่ชนและตรงเงื่อนไขหลัก");
  }

  return { score: Math.max(0, Math.round(score)), reasons };
}

type IconProps = { className?: string };

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      className={className ? `ico ${className}` : "ico"}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function IconMark({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m8.5 15.5 2.5 2.5 4.5-4.5" />
    </Svg>
  );
}

function IconBlock({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z" />
    </Svg>
  );
}

function IconFace({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}

function IconCrane({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 21v-7M4 10V3M12 21v-11M12 6V3M20 21v-3M20 14V3" />
      <path d="M1 14h6M9 6h6M17 18h6" />
    </Svg>
  );
}

function IconCompare({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </Svg>
  );
}

function IconVoid({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

function IconExam({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </Svg>
  );
}

function IconStorm({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16v.01" />
    </Svg>
  );
}

function IconRail({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
    </Svg>
  );
}

function IconNote({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17v.01" />
    </Svg>
  );
}

function IconArrow({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Svg>
  );
}

function IconClose({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

function IconAnchor({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

function IconPlus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function IconCopy({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

function IconChevron({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

function IconEye({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

function IconEyeOff({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="m1 1 22 22" />
    </Svg>
  );
}

function IconMessage({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

const maxFeedbackLength = 100;

// Counts what the user sees as characters, matching the server's char_length.
function countChars(text: string) {
  return Array.from(text).length;
}

const zones: { id: string; label: string; short: string; Icon: (props: IconProps) => React.JSX.Element }[] = [
  { id: "face", label: "ตารางเรียน", short: "ตาราง", Icon: IconFace },
  { id: "blocks", label: "รายวิชา", short: "วิชา", Icon: IconBlock },
  { id: "ge", label: "วิชาศึกษาทั่วไป", short: "GE", Icon: IconBlock },
  { id: "planner", label: "ตัวช่วยจัดแผน", short: "จัดแผน", Icon: IconCrane },
  { id: "compare", label: "เปรียบเทียบ", short: "เทียบ", Icon: IconCompare },
  { id: "voids", label: "เวลาว่าง", short: "ว่าง", Icon: IconVoid },
  { id: "exams", label: "ตารางสอบ", short: "สอบ", Icon: IconExam },
  { id: "room", label: "ห้องร่วมกัน", short: "ห้อง", Icon: IconRail },
  { id: "feedback", label: "ข้อเสนอแนะ", short: "แนะนำ", Icon: IconMessage },
];

export default function Home() {
  const [plans, setPlans] = useState<TimetablePlan[]>([{ id: "default", name: defaultPlanName, courses: [] }]);
  const [activePlanId, setActivePlanId] = useState("default");
  const [hasLoadedLocalData, setHasLoadedLocalData] = useState(false);
  const [form, setForm] = useState(emptyCourse);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [remoteClasses, setRemoteClasses] = useState<RemoteClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [hasLoadedClasses, setHasLoadedClasses] = useState(false);
  const [classError, setClassError] = useState("");
  const remoteResultsRef = useRef<HTMLDivElement | null>(null);
  // ปิด popup เมื่อกดและปล่อยบนฉากหลังเท่านั้น ลากเลือกข้อความจากในกล่องแล้วปล่อยนอกกล่องต้องไม่ปิด
  const scrimPressRef = useRef<EventTarget | null>(null);
  const scrimCloseProps = (close: () => void) => ({
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      scrimPressRef.current = event.target === event.currentTarget ? event.currentTarget : null;
    },
    onClick: (event: React.MouseEvent<HTMLDivElement>) => {
      const pressedOnScrim = scrimPressRef.current === event.currentTarget && event.target === event.currentTarget;
      scrimPressRef.current = null;

      if (pressedOnScrim) {
        close();
      }
    },
  });
  const [courseSearch, setCourseSearch] = useState("");
  const [geGroup, setGeGroup] = useState<GeGroupId | "">("");
  const [icsDialog, setIcsDialog] = useState<{ firstDay: string; lastDay: string; error: string } | null>(null);
  const [geQuery, setGeQuery] = useState("");
  const [geCampus, setGeCampus] = useState<GeCampus>("main");
  const campusGeCourses = useMemo(() => geCoursesFor(geCampus), [geCampus]);
  const visibleGeCourses = useMemo(() => filterGeCourses(campusGeCourses, geGroup, geQuery), [campusGeCourses, geGroup, geQuery]);
  const geCampusInfo = geCampuses.find((campus) => campus.id === geCampus) ?? geCampuses[0];
  const geFiltering = geGroup !== "" || geQuery.trim() !== "";
  const [academicYear, setAcademicYear] = useState("2569");
  const [semester, setSemester] = useState("1");
  const [campusId, setCampusId] = useState("10");
  const [divisionCode, setDivisionCode] = useState("");
  const [levelId, setLevelId] = useState("61");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [classSet, setClassSet] = useState("");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(fallbackFilters);
  const [departmentOptions, setDepartmentOptions] = useState<ComboOption[]>([]);
  const [filterError, setFilterError] = useState("");
  const [isCourseBrowserOpen, setIsCourseBrowserOpen] = useState(false);
  const [isManualCourseOpen, setIsManualCourseOpen] = useState(false);
  const [shareSession, setShareSession] = useState<ShareSession | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [excelStatus, setExcelStatus] = useState("");
  const [plannerSelectedCodes, setPlannerSelectedCodes] = useState<string[]>([]);
  // วิชาที่ดึงมาเก็บไว้ในตัวช่วยจัดแผน แยกจากผลค้นหา จึงไม่หายเมื่อค้นหาชุดใหม่
  // plannerSelectedCodes คือวิชาในคลังที่ติ๊กไว้ใช้สร้างแผน
  const [plannerPool, setPlannerPool] = useState<RemoteCourseGroup[]>([]);
  const [plannerPoolNotice, setPlannerPoolNotice] = useState("");
  const [excludedCourses, setExcludedCourses] = useState<ExcludedCourse[]>([]);
  // section ที่เลือกเฉพาะเจาะจงต่อรหัสวิชา (classid) ถ้าไม่มี key = ใช้ทุก section
  const [plannerSectionPicks, setPlannerSectionPicks] = useState<Record<string, number[]>>({});
  const [plannerGroups, setPlannerGroups] = useState<CourseGroup[]>([]);
  const [expandedPlannerCode, setExpandedPlannerCode] = useState<string | null>(null);
  const [plannerAvoidDays, setPlannerAvoidDays] = useState<DayKey[]>([]);
  const [plannerStart, setPlannerStart] = useState("08:00");
  const [plannerEnd, setPlannerEnd] = useState("17:00");
  const [plannerLunchBreak, setPlannerLunchBreak] = useState(true);
  const [generatedPlans, setGeneratedPlans] = useState<GeneratedSchedulePlan[]>([]);
  // เหตุผลที่กดสร้างแผนแล้วไม่ได้แผน ให้บทพาทำอธิบายผู้ใช้ (null = ครั้งล่าสุดสำเร็จหรือยังไม่เคยกด)
  const [plannerGenerateError, setPlannerGenerateError] = useState<string | null>(null);
  const [plannerStatus, setPlannerStatus] = useState("");
  const [comparePlanAId, setComparePlanAId] = useState("");
  const [comparePlanBId, setComparePlanBId] = useState("");
  const [timetableView, setTimetableView] = useState<"grid" | "list">("grid");
  const [activeZone, setActiveZone] = useState<string>("face");
  // Mobile only: every zone but the week starts folded, so the phone opens on the
  // timetable instead of a nine-thousand-pixel scroll. Desktop ignores this entirely.
  const [foldedZones, setFoldedZones] = useState<string[]>(() => zones.filter((zone) => zone.id !== "face").map((zone) => zone.id));
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const plannerFileInputRef = useRef<HTMLInputElement | null>(null);
  const [plannerFileStatus, setPlannerFileStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const hasLocalPlanMutationRef = useRef(false);
  const plansRef = useRef<TimetablePlan[]>([]);
  const sharedRoomLoadRequestRef = useRef(0);
  const navClickZoneRef = useRef<{ id: string; until: number } | null>(null);

  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? plans[0];
  const currentPlanId = activePlan?.id ?? activePlanId;
  const courses = activePlan?.courses ?? noCourses;
  const shareSessionPlans = shareSession ? plans.filter((plan) => plan.sharedId === shareSession.shareId) : [];
  const isActiveSharedPlan = Boolean(shareSession && activePlan?.sharedId === shareSession.shareId);
  const canEditActivePlan = !isActiveSharedPlan || shareSession?.mode === "edit";
  const isActiveReadOnlySharedPlan = isActiveSharedPlan && !canEditActivePlan;
  const canRemoveCurrentPlan = isActiveSharedPlan ? shareSessionPlans.length > 1 : plans.length > 1;
  const visiblePlans = shareSession ? shareSessionPlans : localPlansOnly(plans);

  const setSharedRoom = useCallback((roomId: string, roomName: string, roomPlans: SharedRoomPlan[], updatedAt = "", editToken = "", activate = true, preferredLocalId = "") => {
    const canEdit = Boolean(editToken);
    const safeRoomPlans = roomPlans.length > 0 ? roomPlans : [{ id: "main", name: roomName || defaultPlanName, courses: [] }];
    const localPlanIds = safeRoomPlans.map((plan) => localRoomPlanId(roomId, plan.id));
    const activeLocalId = preferredLocalId && localPlanIds.includes(preferredLocalId) ? preferredLocalId : localPlanIds[0];

    setPlans((currentPlans) => {
      const localPlanIdSet = new Set(localPlanIds);
      const nonRoomPlans = currentPlans.filter((plan) => !plan.sharedId && !localPlanIdSet.has(plan.id));
      const nextRoomPlans = safeRoomPlans.map((plan) => ({
        id: localRoomPlanId(roomId, plan.id),
        name: plan.name,
        courses: plan.courses,
        source: "shared" as const,
        sharedId: roomId,
        canEdit,
      }));

      return [...nonRoomPlans, ...nextRoomPlans];
    });
    if (activate) {
      setActivePlanId(activeLocalId);
    }
    setShareSession({
      shareId: roomId,
      editToken,
      localPlanId: activeLocalId,
      localPlanIds,
      mode: canEdit ? "edit" : "view",
      status: canEdit ? "idle" : "readonly",
      lastServerUpdatedAt: updatedAt,
      dirty: false,
    });
  }, []);

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  const roomPlansForSession = useCallback((session: ShareSession, planList = plansRef.current): SharedRoomPlan[] =>
    planList
      .filter((plan) => plan.sharedId === session.shareId)
      .map((plan) => ({
        id: roomPlanIdFromLocal(session.shareId, plan.id),
        name: plan.name,
        courses: plan.courses,
      })),
  []);

  const loadSharedPlan = useCallback(async (planId: string, showStatus = true, editToken = "", updateUrl = false): Promise<boolean> => {
    const requestId = sharedRoomLoadRequestRef.current + 1;
    sharedRoomLoadRequestRef.current = requestId;

    if (showStatus) {
      setShareStatus("กำลังเข้าห้อง...");
    }

    try {
      const result = await loadSharedPlanAction(planId);

      if (requestId !== sharedRoomLoadRequestRef.current) {
        return false;
      }

      if (!result.ok) {
        setShareStatus(result.error);
        return false;
      }

      const data = result.data;
      setSharedRoom(planId, data.name, data.plans ?? [{ id: "main", name: data.name, courses: data.courses }], data.updatedAt, editToken);
      setRoomCodeInput(planId);
      if (updateUrl) {
        window.history.replaceState(null, "", `?room=${planId}`);
      }
      if (showStatus) {
        setShareStatus(editToken ? `เข้าห้อง ${planId} แล้ว` : `เข้าห้อง ${planId} แล้ว โหมดดูอย่างเดียว`);
      }
      return true;
    } catch (error) {
      if (requestId !== sharedRoomLoadRequestRef.current) {
        return false;
      }

      setShareStatus(error instanceof Error ? error.message : "เข้าห้องไม่สำเร็จ");
      return false;
    }
  }, [setSharedRoom]);

  const saveSharedPlan = useCallback(async (planId: string, editToken: string, name: string, roomPlans: SharedRoomPlan[], updatedAt = "", showStatus = true) => {
    if (!editToken) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว ไม่สามารถบันทึกได้");
      return false;
    }

    if (showStatus) {
      setShareStatus("กำลังบันทึกห้อง...");
    }

    try {
      const result = await saveSharedPlanAction(planId, {
        name,
        courses: roomPlans[0]?.courses ?? [],
        plans: roomPlans,
        editToken,
        updatedAt,
      });

      if (!result.ok) {
        setShareStatus(result.error);
        return null;
      }

      if (showStatus) {
        setShareStatus("บันทึกห้องแล้ว");
      }
      return result.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "บันทึกห้องไม่สำเร็จ";
      setShareStatus(message);
      return null;
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (hasLocalPlanMutationRef.current) {
        setHasLoadedLocalData(true);
        return;
      }

      const savedPlans = readJson<TimetablePlan[] | null>("student-timetable-plans", null);

      if (savedPlans) {
        const nextPlans = ensureLocalPlans(savedPlans);
        const savedActivePlanId = window.localStorage.getItem("student-timetable-active-plan") ?? "default";

        setPlans(nextPlans);
        setActivePlanId(nextPlans.some((plan) => plan.id === savedActivePlanId) ? savedActivePlanId : nextPlans[0].id);
      } else {
        const saved = readJson<Course[]>("student-timetable", []);
        setPlans([{ id: "default", name: defaultPlanName, courses: saved }]);
        setActivePlanId("default");
      }

      const savedPlanner = readSavedPlanner();
      setPlannerPool(savedPlanner.pool ?? []);
      setPlannerSelectedCodes(savedPlanner.selectedCodes ?? []);
      setPlannerSectionPicks(savedPlanner.sectionPicks ?? {});
      setPlannerGroups(savedPlanner.groups ?? []);
      if (savedPlanner.avoidDays) setPlannerAvoidDays(savedPlanner.avoidDays);
      if (savedPlanner.start) setPlannerStart(savedPlanner.start);
      if (savedPlanner.end) setPlannerEnd(savedPlanner.end);
      if (savedPlanner.lunchBreak !== undefined) setPlannerLunchBreak(savedPlanner.lunchBreak);
      setExcludedCourses(readExcludedCourses());

      setHasLoadedLocalData(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hasLoadedLocalData) {
      return;
    }

    window.localStorage.setItem("student-timetable-plans", JSON.stringify(ensureLocalPlans(plans)));
  }, [hasLoadedLocalData, plans]);

  useEffect(() => {
    if (!hasLoadedLocalData) {
      return;
    }

    const saved: SavedPlanner = {
      pool: plannerPool,
      selectedCodes: plannerSelectedCodes,
      sectionPicks: plannerSectionPicks,
      groups: plannerGroups,
      avoidDays: plannerAvoidDays,
      start: plannerStart,
      end: plannerEnd,
      lunchBreak: plannerLunchBreak,
    };

    try {
      window.localStorage.setItem(plannerStorageKey, JSON.stringify(saved));
    } catch (error) {
      // พื้นที่ localStorage เต็ม (เช่นเก็บวิชาไว้เยอะมาก) ไม่ควรทำให้หน้าใช้งานไม่ได้
      console.warn("บันทึกตัวช่วยจัดแผนไม่สำเร็จ", error);
    }
  }, [hasLoadedLocalData, plannerPool, plannerSelectedCodes, plannerSectionPicks, plannerGroups, plannerAvoidDays, plannerStart, plannerEnd, plannerLunchBreak]);

  useEffect(() => {
    if (!hasLoadedLocalData) {
      return;
    }

    try {
      window.localStorage.setItem(excludedStorageKey, JSON.stringify(excludedCourses));
    } catch (error) {
      console.warn("บันทึกวิชาที่ไม่เอาไม่สำเร็จ", error);
    }
  }, [excludedCourses, hasLoadedLocalData]);

  useEffect(() => {
    if (!hasLoadedLocalData) {
      return;
    }

    if (!activePlan?.sharedId) {
      window.localStorage.setItem("student-timetable-active-plan", currentPlanId);
    }
  }, [activePlan?.sharedId, currentPlanId, hasLoadedLocalData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");
    const sharedId = params.get("share");
    const editToken = params.get("edit") ?? "";

    if (roomId) {
      const normalizedRoomId = normalizeRoomCode(roomId);
      const timeout = window.setTimeout(() => {
        setRoomCodeInput(normalizedRoomId);
        loadSharedPlan(normalizedRoomId, true, normalizedRoomId);
      }, 0);

      return () => window.clearTimeout(timeout);
    }

    if (sharedId) {
      const timeout = window.setTimeout(() => {
        loadSharedPlan(sharedId, true, editToken);
      }, 0);

      return () => window.clearTimeout(timeout);
    }
  }, [loadSharedPlan]);

  useEffect(() => {
    if (!shareSession || shareSessionPlans.length === 0) {
      return;
    }

    if (shareSession.mode !== "edit" || !shareSession.dirty || shareSession.status === "conflict") {
      return;
    }

    const timeout = window.setTimeout(async () => {
      setShareSession((current) => current ? { ...current, status: "saving" } : current);
      const data = await saveSharedPlan(
        shareSession.shareId,
        shareSession.editToken,
        `ห้อง ${shareSession.shareId}`,
        roomPlansForSession(shareSession),
        shareSession.lastServerUpdatedAt,
        false,
      );

      if (data) {
        setShareSession((current) =>
          current && current.shareId === shareSession.shareId
            ? { ...current, status: "idle", lastServerUpdatedAt: data.updatedAt, dirty: false }
            : current,
        );
      } else {
        setShareSession((current) =>
          current && current.shareId === shareSession.shareId
            ? { ...current, status: "conflict" }
            : current,
        );
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [roomPlansForSession, saveSharedPlan, shareSession, shareSessionPlans.length]);

  useEffect(() => {
    if (!shareSession) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        if (shareSession.dirty || shareSession.status === "saving" || shareSession.status === "conflict" || (isManualCourseOpen && shareSession.localPlanIds.includes(activePlanId))) {
          return;
        }

        setShareSession((current) => current ? { ...current, status: current.mode === "view" ? "readonly" : "syncing" } : current);
        const result = await loadSharedPlanAction(shareSession.shareId);

        if (!result.ok) {
          throw new Error(result.error);
        }

        const data = result.data;

        if (data.updatedAt && data.updatedAt !== shareSession.lastServerUpdatedAt) {
          setSharedRoom(
            shareSession.shareId,
            data.name,
            data.plans ?? [{ id: "main", name: data.name, courses: data.courses }],
            data.updatedAt,
            shareSession.editToken,
            false,
            activePlan?.sharedId === shareSession.shareId ? activePlanId : shareSession.localPlanId,
          );
          setShareStatus("อัปเดตตารางล่าสุดแล้ว");
        } else {
          setShareSession((current) =>
            current && current.shareId === shareSession.shareId
              ? { ...current, status: current.mode === "view" ? "readonly" : "idle" }
              : current,
          );
        }
      } catch (error) {
        setShareStatus(error instanceof Error ? error.message : "ซิงก์ห้องไม่สำเร็จ");
        setShareSession((current) =>
          current && current.shareId === shareSession.shareId
            ? { ...current, status: current.mode === "view" ? "readonly" : "idle" }
            : current,
        );
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [activePlan?.sharedId, activePlanId, isManualCourseOpen, setSharedRoom, shareSession]);

  useEffect(() => {
    async function loadFilters() {
      try {
        const response = await fetch("/api/kmutnb/filters");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "โหลดตัวกรองไม่สำเร็จ");
        }

        setFilterOptions(data);
      } catch (error) {
        setFilterError(error instanceof Error ? error.message : "โหลดตัวกรองไม่สำเร็จ");
      }
    }

    loadFilters();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDepartments() {
      if (!facultyId) {
        setDepartmentOptions([]);
        setDepartmentId("");
        return;
      }

      try {
        const response = await fetch(`/api/kmutnb/departments?faculty=${facultyId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "โหลดภาควิชาไม่สำเร็จ");
        }

        if (cancelled) {
          return;
        }

        const departments: ComboOption[] = Array.isArray(data.departments) ? data.departments : [];
        setDepartmentOptions(departments);
        setDepartmentId((current) => (departments.some((option) => comboValue(option) === current) ? current : ""));
      } catch (error) {
        if (!cancelled) {
          setFilterError(error instanceof Error ? error.message : "โหลดภาควิชาไม่สำเร็จ");
        }
      }
    }

    loadDepartments();

    return () => {
      cancelled = true;
    };
  }, [facultyId]);

  const shownCourses = useMemo(() => courses.filter((course) => !course.hidden), [courses]);
  const hiddenCourseCount = uniqueCourseGroups(courses).length - uniqueCourseGroups(shownCourses).length;
  const totalCredits = useMemo(() => sumCredits(shownCourses), [shownCourses]);
  const shownCourseCount = useMemo(() => uniqueCourseGroups(shownCourses).length, [shownCourses]);
  const examCount = useMemo(() => uniqueCourseGroups(shownCourses).filter((course) => course.midterm || course.final).length, [shownCourses]);
  const conflicts = useMemo(
    () =>
      shownCourses.flatMap((course, index) =>
        shownCourses.slice(index + 1).filter((next) => overlaps(course, next)).map((next) => [course, next]),
      ),
    [shownCourses],
  );
  const excludedCodes = useMemo(() => new Set(excludedCourses.map((course) => course.code)), [excludedCourses]);
  const searchedRemoteClasses = useMemo(() => {
    const keyword = courseSearch.trim().toLowerCase();

    if (!keyword) {
      return remoteClasses;
    }

    return remoteClasses.filter((remoteClass) => remoteClass.coursecode.toLowerCase().includes(keyword));
  }, [courseSearch, remoteClasses]);
  const filteredRemoteClasses = useMemo(
    () => searchedRemoteClasses.filter((remoteClass) => !excludedCodes.has(remoteClass.coursecode)),
    [excludedCodes, searchedRemoteClasses],
  );
  const hiddenExcludedCount = searchedRemoteClasses.length - filteredRemoteClasses.length;
  const freeSlots = useMemo(() => freeSlotsForCourses(shownCourses).filter((slot) => shownCourses.some((course) => course.day === slot.day)).slice(0, 14), [shownCourses]);
  const examWarnings = useMemo(() => examWarningsForCourses(shownCourses), [shownCourses]);
  const comparison = useMemo(() => {
    const comparePlanA = visiblePlans.find((plan) => plan.id === comparePlanAId) ?? visiblePlans[0];
    const comparePlanB = visiblePlans.find((plan) => plan.id === comparePlanBId) ?? visiblePlans[1] ?? visiblePlans[0];

    if (!comparePlanA || !comparePlanB) {
      return null;
    }

    const aKeys = new Set(comparePlanA.courses.map(courseKey));
    const bKeys = new Set(comparePlanB.courses.map(courseKey));
    const onlyA = comparePlanA.courses.filter((course) => !bKeys.has(courseKey(course)));
    const onlyB = comparePlanB.courses.filter((course) => !aKeys.has(courseKey(course)));

    return {
      aStats: planStats(comparePlanA.courses.filter((course) => !course.hidden)),
      bStats: planStats(comparePlanB.courses.filter((course) => !course.hidden)),
      onlyA,
      onlyB,
    };
  }, [comparePlanAId, comparePlanBId, visiblePlans]);
  const comparePlanA = visiblePlans.find((plan) => plan.id === comparePlanAId) ?? visiblePlans[0];
  const comparePlanB = visiblePlans.find((plan) => plan.id === comparePlanBId) ?? visiblePlans[1] ?? visiblePlans[0];
  const dailyCourses = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        courses: courses.filter((course) => course.day === day.key).sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
      })),
    [courses],
  );
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();

    shownCourses.forEach((course, index) => {
      shownCourses.slice(index + 1).forEach((next) => {
        if (overlaps(course, next)) {
          ids.add(course.id);
          ids.add(next.id);
        }
      });
    });

    return ids;
  }, [shownCourses]);

  useEffect(() => {
    if (!isManualCourseOpen && !isCourseBrowserOpen && !icsDialog) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (isCourseBrowserOpen) {
        setIsCourseBrowserOpen(false);
        return;
      }

      if (icsDialog) {
        setIcsDialog(null);
        return;
      }

      setIsManualCourseOpen(false);
      setEditingId(null);
      setForm(emptyCourse);
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isCourseBrowserOpen, isManualCourseOpen, icsDialog]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        setTimetableView("list");
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const sections = zones
      .map((zone) => document.getElementById(zone.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (navClickZoneRef.current && Date.now() < navClickZoneRef.current.until) {
          return;
        }

        if (isAtPageBottom()) {
          setActiveZone(sections[sections.length - 1].id);
          return;
        }

        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visible) {
          setActiveZone(visible.target.id);
        }
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));

    // ส่วนสุดท้ายสั้นเกินกว่าจะเลื่อนถึงแถบที่ observer จับ เมื่อเลื่อนสุดหน้าจึงถือว่าอยู่ส่วนสุดท้าย
    function isAtPageBottom() {
      return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    }

    function markLastZoneAtBottom() {
      if (navClickZoneRef.current && Date.now() < navClickZoneRef.current.until) {
        return;
      }

      if (isAtPageBottom()) {
        setActiveZone(sections[sections.length - 1].id);
      }
    }

    window.addEventListener("scroll", markLastZoneAtBottom, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", markLastZoneAtBottom);
    };
  }, [timetableView]);

  useEffect(() => {
    const nav = document.querySelector(".rail-nav");
    const tab = nav?.querySelector<HTMLElement>(".rail-tab.is-active");

    if (!nav || !tab || nav.scrollWidth <= nav.clientWidth) {
      return;
    }

    nav.scrollTo({ left: tab.offsetLeft - nav.clientWidth / 2 + tab.offsetWidth / 2, behavior: "smooth" });
  }, [activeZone]);

  function toggleZoneFold(id: string) {
    setFoldedZones((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  // คืน array เดิมถ้าไม่ได้ย่อไว้ จะได้ไม่ render ซ้ำ (บทพาทำเรียกทุกครั้งที่เปลี่ยนขั้น)
  const unfoldZone = useCallback((id: string) => {
    setFoldedZones((current) => (current.includes(id) ? current.filter((item) => item !== id) : current));
  }, []);

  const tourSnapshot = useMemo(
    () => ({
      canEdit: canEditActivePlan,
      browserOpen: isCourseBrowserOpen,
      searchResultCount: filteredRemoteClasses.length,
      plannerPoolCount: plannerPool.length,
      generatedPlanCount: generatedPlans.length,
      courseCount: courses.length,
      planCount: visiblePlans.length,
      inRoom: Boolean(shareSession),
      plannerNotice: plannerGenerateError,
    }),
    [canEditActivePlan, isCourseBrowserOpen, filteredRemoteClasses.length, plannerPool.length, generatedPlans.length, courses.length, visiblePlans.length, shareSession, plannerGenerateError],
  );
  const onboarding = useOnboarding(tourSnapshot, { onUnfoldZone: unfoldZone });
  // บทพาทำชี้การ์ดแรกที่ยังไม่ได้เก็บเข้าตัวช่วย การ์ดที่เก็บแล้วปุ่มกลายเป็น "เอาออก"
  const firstUnpickedRemoteIndex = useMemo(
    () => filteredRemoteClasses.findIndex((remoteClass) => !plannerPool.some((group) => group.code === remoteClass.coursecode)),
    [filteredRemoteClasses, plannerPool],
  );
  const { completeMission } = onboarding;

  function submitCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    if (toMinutes(form.start) >= toMinutes(form.end)) {
      return;
    }

    const nextCourse: Course = {
      ...form,
      id: editingId ?? crypto.randomUUID(),
      credits: Number(form.credits),
      color: editingId ? courses.find((course) => course.id === editingId)?.color ?? palette[0] : palette[courses.length % palette.length],
    };

    // แก้คาบหนึ่ง: ข้อมูลที่เป็นของทั้ง section (หน่วยกิต อาจารย์ วันสอบ) ตามไปที่คาบคู่ด้วย
    // ส่วนวัน เวลา และห้องเป็นของคาบนั้นเท่านั้น
    const editedCourse = editingId ? courses.find((course) => course.id === editingId) : undefined;
    const editedGroupKey = editedCourse ? courseGroupKey(editedCourse) : null;
    const sharedFields = {
      credits: nextCourse.credits,
      teacher: nextCourse.teacher,
      midterm: nextCourse.midterm,
      final: nextCourse.final,
    };

    updateActiveCourses((current) =>
      editingId
        ? current.map((course) => {
          if (course.id === editingId) {
            return nextCourse;
          }

          return editedGroupKey !== null && courseGroupKey(course) === editedGroupKey ? { ...course, ...sharedFields } : course;
        })
        : [...current, nextCourse],
    );
    setForm(emptyCourse);
    setEditingId(null);
    setIsManualCourseOpen(false);
  }

  function editCourse(course: Course) {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    setForm({
      name: course.name,
      code: course.code,
      credits: course.credits,
      day: course.day,
      start: course.start,
      end: course.end,
      room: course.room,
      teacher: course.teacher,
      midterm: course.midterm,
      final: course.final,
    });
    setEditingId(course.id);
    setIsManualCourseOpen(true);
  }

  function removeCourse(id: string) {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    const target = courses.find((course) => course.id === id);
    const groupKey = target ? courseGroupKey(target) : null;
    const removedIds = new Set(courses.filter((course) => course.id === id || (groupKey !== null && courseGroupKey(course) === groupKey)).map((course) => course.id));

    updateActiveCourses((current) => current.filter((course) => !removedIds.has(course.id)));
    if (editingId && removedIds.has(editingId)) {
      setEditingId(null);
      setForm(emptyCourse);
    }
  }

  // ซ่อน/ล็อกทั้ง section พร้อมกัน ใช้สถานะของรายการที่กดเป็นตัวตั้ง
  function updateCourseGroup(id: string, change: (target: Course) => Partial<Course>) {
    updateActiveCourses((current) => {
      const target = current.find((course) => course.id === id);

      if (!target) {
        return current;
      }

      const groupKey = courseGroupKey(target);
      const patch = change(target);
      return current.map((course) => (courseGroupKey(course) === groupKey ? { ...course, ...patch } : course));
    });
  }

  function removeAllCourses() {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    updateActiveCourses(() => []);
    setEditingId(null);
    setForm(emptyCourse);
  }

  function updateActiveCourses(updater: (current: Course[]) => Course[]) {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    hasLocalPlanMutationRef.current = true;
    if (isActiveSharedPlan) {
      setShareSession((current) => current && current.shareId === activePlan?.sharedId ? { ...current, dirty: true, status: "idle" } : current);
    }
    setPlans((currentPlans) =>
      currentPlans.map((plan) => (plan.id === currentPlanId ? { ...plan, courses: updater(plan.courses) } : plan)),
    );
  }

  function addPlan() {
    hasLocalPlanMutationRef.current = true;
    const nextPlanId = crypto.randomUUID();

    if (shareSession) {
      const localId = localRoomPlanId(shareSession.shareId, nextPlanId);
      setPlans((currentPlans) => {
        const roomPlans = currentPlans.filter((plan) => plan.sharedId === shareSession.shareId);

        return [
          ...currentPlans,
          {
            id: localId,
            name: nextTableName(roomPlans),
            courses: [],
            source: "shared" as const,
            sharedId: shareSession.shareId,
            canEdit: shareSession.mode === "edit",
          },
        ];
      });
      setShareSession((current) =>
        current && current.shareId === shareSession.shareId
          ? { ...current, localPlanId: localId, localPlanIds: [...current.localPlanIds, localId], dirty: true, status: "idle" }
          : current,
      );
      setActivePlanId(localId);
    } else {
      setPlans((currentPlans) => [
        ...currentPlans,
        {
          id: nextPlanId,
          name: nextTableName(currentPlans),
          courses: [],
        },
      ]);
      setActivePlanId(nextPlanId);
    }
    setEditingId(null);
    setForm(emptyCourse);
    setIsManualCourseOpen(false);
  }

  function renamePlan(name: string) {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    hasLocalPlanMutationRef.current = true;
    if (isActiveSharedPlan) {
      setShareSession((current) => current && current.shareId === activePlan?.sharedId ? { ...current, dirty: true, status: "idle" } : current);
    }
    setPlans((currentPlans) =>
      currentPlans.map((plan) => (plan.id === currentPlanId ? { ...plan, name } : plan)),
    );
  }

  function removePlan() {
    const currentRoomPlanIds = shareSession ? plans.filter((plan) => plan.sharedId === shareSession.shareId).map((plan) => plan.id) : [];

    if ((!shareSession && plans.length <= 1) || (shareSession && (!isActiveSharedPlan || currentRoomPlanIds.length <= 1))) {
      return;
    }

    hasLocalPlanMutationRef.current = true;

    if (shareSession && isActiveSharedPlan) {
      const nextRoomPlanIds = currentRoomPlanIds.filter((id) => id !== currentPlanId);
      const nextActivePlanId = nextRoomPlanIds[0];

      setPlans((currentPlans) => currentPlans.filter((plan) => plan.id !== currentPlanId));
      setActivePlanId(nextActivePlanId);
      setShareSession((current) =>
        current && current.shareId === shareSession.shareId
          ? { ...current, localPlanId: nextActivePlanId, localPlanIds: nextRoomPlanIds, dirty: true, status: "idle" }
          : current,
      );
    } else {
      const nextPlans = plans.filter((plan) => plan.id !== currentPlanId);
      setPlans(nextPlans);
      setActivePlanId(nextPlans[0].id);
    }
    setEditingId(null);
    setForm(emptyCourse);
  }

  function toggleCourseHidden(id: string) {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    updateCourseGroup(id, (target) => ({ hidden: !target.hidden }));
  }

  function showAllCourses() {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    updateActiveCourses((current) => current.map((course) => (course.hidden ? { ...course, hidden: false } : course)));
  }

  function toggleCourseLocked(id: string) {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    const target = courses.find((course) => course.id === id);
    updateCourseGroup(id, (current) => ({ locked: !current.locked }));
    if (target && !target.locked) {
      completeMission("lock");
    }
  }

  function groupRemoteClasses(list: RemoteClass[]): RemoteCourseGroup[] {
    const groups = new Map<string, RemoteClass[]>();

    list.forEach((remoteClass) => {
      const group = groups.get(remoteClass.coursecode) ?? [];
      group.push(remoteClass);
      groups.set(remoteClass.coursecode, group);
    });

    return Array.from(groups.entries()).map(([code, classes]) => ({
      code,
      name: classes[0]?.coursename ?? code,
      classes,
    }));
  }

  // เพิ่มหรืออัปเดตวิชาในคลัง โดยคงลำดับเดิมของวิชาที่มีอยู่แล้ว
  function mergeIntoPool(current: RemoteCourseGroup[], incoming: RemoteCourseGroup[]) {
    const incomingByCode = new Map(incoming.map((group) => [group.code, group]));
    const existingCodes = new Set(current.map((group) => group.code));

    const room = Math.max(0, maxPlannerPool - current.length);

    return [
      ...current.map((group) => incomingByCode.get(group.code) ?? group),
      ...incoming.filter((group) => !existingCodes.has(group.code)).slice(0, room),
    ];
  }

  function addAllToPlanner() {
    const groups = groupRemoteClasses(filteredRemoteClasses);

    if (groups.length === 0) {
      return;
    }

    const existingCodes = new Set(plannerPool.map((group) => group.code));
    const newGroups = groups.filter((group) => !existingCodes.has(group.code));
    const room = Math.max(0, maxPlannerPool - plannerPool.length);
    const added = Math.min(newGroups.length, room);
    const skipped = newGroups.length - added;

    setPlannerPool((current) => mergeIntoPool(current, groups));
    const message = skipped > 0
      ? `เพิ่ม ${added} วิชา ตัวช่วยเก็บได้สูงสุด ${maxPlannerPool} วิชา อีก ${skipped} วิชาไม่ได้เพิ่ม เอาวิชาที่ไม่ใช้ออกก่อนแล้วลองใหม่`
      : `เก็บ ${added} วิชาไว้ในตัวช่วยแล้ว ติ๊กวิชาที่ต้องการ (สูงสุด 7 วิชา) แล้วกดสร้างแผน`;
    setPlannerStatus(message);
    setPlannerPoolNotice(message);
  }

  function dropSectionPicks(code: string) {
    setPlannerSectionPicks((current) => {
      if (!(code in current)) {
        return current;
      }

      const next = { ...current };
      delete next[code];
      return next;
    });
  }

  function excludeCourse(code: string, name: string) {
    setExcludedCourses((current) => (current.some((course) => course.code === code) ? current : [...current, { code, name }]));

    if (plannerPool.some((group) => group.code === code)) {
      removeFromPlanner(code);
    }
  }

  function unexcludeCourse(code: string) {
    setExcludedCourses((current) => current.filter((course) => course.code !== code));
  }

  function removeFromPlanner(code: string) {
    setPlannerPool((current) => current.filter((group) => group.code !== code));
    setPlannerGroups((current) => moveCodeToGroup(current, code, null));
    setPlannerSelectedCodes((current) => current.filter((item) => item !== code));
    dropSectionPicks(code);
    setPlannerPoolNotice("");
  }

  function clearPlanner() {
    setPlannerPool([]);
    setPlannerPoolNotice("");
    setPlannerSelectedCodes([]);
    setPlannerSectionPicks({});
    setPlannerGroups([]);
    setExpandedPlannerCode(null);
    setGeneratedPlans([]);
    setPlannerStatus("");
  }

  function togglePlannerSelected(code: string) {
    if (plannerSelectedCodes.includes(code)) {
      setPlannerSelectedCodes((current) => current.filter((item) => item !== code));
      dropSectionPicks(code);
      return;
    }

    setPlannerSelectedCodes((current) => [...current, code]);
  }

  // section ที่ตัวช่วยจะใช้จริงของวิชานี้ (ทุก section ถ้าไม่ได้เลือกเฉพาะ)
  function plannerClassesFor(group: RemoteCourseGroup) {
    const picks = plannerSectionPicks[group.code];
    const picked = picks ? group.classes.filter((remoteClass) => picks.includes(remoteClass.classid)) : [];
    return picked.length > 0 ? picked : group.classes;
  }

  // เลือก/เลิกเลือก section เดียวให้ตัวช่วยจัดแผน และติ๊กวิชาให้อัตโนมัติ
  function togglePlannerSection(code: string, classId: number) {
    const picks = plannerSelectedCodes.includes(code) ? plannerSectionPicks[code] ?? [] : [];
    const nextPicks = picks.includes(classId) ? picks.filter((id) => id !== classId) : [...picks, classId];

    if (nextPicks.length === 0) {
      dropSectionPicks(code);
      // วิชาในกลุ่มไม่มีช่องติ๊กของตัวเอง เลิกเลือก section ตัวสุดท้าย = กลับไปใช้ทุก section แต่ยังอยู่ในกลุ่มที่ติ๊ก
      if (!groupOfCode(plannerGroups, code)) {
        setPlannerSelectedCodes((current) => current.filter((item) => item !== code));
      }
      return;
    }

    setPlannerSectionPicks((current) => ({ ...current, [code]: nextPicks }));
    setPlannerSelectedCodes((current) => selectWithGroup(current, code));
  }

  function selectAllPlannerSections(code: string) {
    dropSectionPicks(code);
    setPlannerSelectedCodes((current) => selectWithGroup(current, code));
  }

  // เลือกวิชาที่อยู่ในกลุ่ม = ติ๊กทั้งกลุ่ม (กลุ่มนับว่าติ๊กเมื่อสมาชิกอยู่ใน plannerSelectedCodes)
  function selectWithGroup(current: string[], code: string) {
    const members = groupOfCode(plannerGroups, code)?.codes ?? [code];
    const missing = [code, ...members].filter((item, index, all) => all.indexOf(item) === index && !current.includes(item));
    return missing.length === 0 ? current : [...current, ...missing];
  }

  // บันทึกวิชาในตัวช่วยจัดแผนเป็นไฟล์ .json (ย้ายเครื่อง / ส่งให้เพื่อน / สำรองไว้)
  function exportPlannerFile() {
    const snapshot: PlannerSnapshot = {
      pool: plannerPool as unknown as PlannerSnapshot["pool"],
      selectedCodes: plannerSelectedCodes,
      sectionPicks: plannerSectionPicks,
      groups: plannerGroups,
    };
    const url = URL.createObjectURL(new Blob([serializePlannerFile(snapshot)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = plannerFileName();
    link.click();
    URL.revokeObjectURL(url);
    setPlannerFileStatus({ tone: "ok", text: `บันทึก ${plannerPool.length} วิชาเป็นไฟล์แล้ว` });
  }

  function downloadIcs() {
    if (!icsDialog) {
      return;
    }

    let ics: string;
    try {
      ics = buildIcs(shownCourses, icsDialog, new Date());
    } catch (error) {
      setIcsDialog({ ...icsDialog, error: error instanceof Error ? error.message : "สร้างไฟล์ปฏิทินไม่สำเร็จ" });
      return;
    }

    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(activePlan?.name ?? defaultPlanName).replace(/[\\/:*?"<>|]/g, "-")}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    setIcsDialog(null);
  }

  // นำเข้าไฟล์: เพิ่มรวมกับของเดิม ไม่ทับวิชาที่มีอยู่ และไม่แตะเงื่อนไขเวลา
  async function importPlannerFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setPlannerFileStatus({ tone: "error", text: "ไฟล์ใหญ่เกิน 2MB" });
      return;
    }

    const parsed = parsePlannerFile(await file.text());
    if (!parsed.ok) {
      setPlannerFileStatus({ tone: "error", text: parsed.error });
      return;
    }

    const current: PlannerSnapshot = {
      pool: plannerPool as unknown as PlannerSnapshot["pool"],
      selectedCodes: plannerSelectedCodes,
      sectionPicks: plannerSectionPicks,
      groups: plannerGroups,
    };
    const { next, added, duplicates, skipped } = mergePlannerFile(current, parsed.data, { maxPool: maxPlannerPool, newId: () => crypto.randomUUID() });
    setPlannerPool(next.pool as unknown as RemoteCourseGroup[]);
    setPlannerSelectedCodes(next.selectedCodes);
    setPlannerSectionPicks(next.sectionPicks);
    setPlannerGroups(next.groups);

    const parts = [`เพิ่ม ${added} วิชา`];
    if (duplicates > 0) parts.push(`มีอยู่แล้ว ${duplicates} วิชา (คงของเดิมไว้)`);
    if (skipped > 0) parts.push(`ไม่ได้เพิ่ม ${skipped} วิชา เพราะตัวช่วยเก็บได้สูงสุด ${maxPlannerPool} วิชา`);
    setPlannerFileStatus({ tone: added > 0 ? "ok" : "error", text: parts.join(" · ") });
  }

  function createPlannerGroup(withCode?: string) {
    const group: CourseGroup = { id: crypto.randomUUID(), name: nextGroupName(plannerGroups), codes: [] };
    setPlannerGroups((current) => [...current, group]);
    if (withCode) {
      movePlannerCode(withCode, group.id, [...plannerGroups, group]);
    }
  }

  function renamePlannerGroup(id: string, name: string) {
    setPlannerGroups((current) => renameGroup(current, id, name));
  }

  function releaseCodes(codes: string[]) {
    setPlannerSelectedCodes((current) => current.filter((item) => !codes.includes(item)));
    codes.forEach(dropSectionPicks);
  }

  // ลบกลุ่ม: วิชากลับเป็นรายการปกติ ไม่ติ๊กและไม่มี section ที่เลือกไว้ (ยังอยู่ในตัวช่วย)
  function deletePlannerGroup(id: string) {
    releaseCodes(plannerGroups.find((group) => group.id === id)?.codes ?? []);
    setPlannerGroups((current) => removeGroup(current, id));
  }

  function movePlannerCode(code: string, groupId: string | null, groups: CourseGroup[] = plannerGroups) {
    if (groupId === null) {
      releaseCodes([code]);
      setPlannerGroups((current) => moveCodeToGroup(current, code, null));
      return;
    }

    const target = groups.find((group) => group.id === groupId);
    if (!target) {
      return;
    }

    const wasSelected = plannerSelectedCodes.includes(code);
    const groupTicked = target.codes.some((item) => plannerSelectedCodes.includes(item));
    setPlannerGroups((current) => moveCodeToGroup(current, code, groupId));
    if (wasSelected || groupTicked) {
      setPlannerSelectedCodes((current) => [...current, ...[code, ...target.codes].filter((item, index, all) => all.indexOf(item) === index && !current.includes(item))]);
    }
  }

  function togglePlannerGroup(id: string) {
    const group = plannerGroups.find((item) => item.id === id);
    if (!group || group.codes.length === 0) {
      return;
    }

    if (group.codes.some((code) => plannerSelectedCodes.includes(code))) {
      releaseCodes(group.codes);
      return;
    }

    setPlannerSelectedCodes((current) => [...current, ...group.codes.filter((code) => !current.includes(code))]);
  }

  // ปุ่มบนการ์ดผลค้นหา: เก็บวิชาเข้าคลังพร้อมติ๊กเลือก หรือเอาออกจากคลัง
  function togglePlannerCode(code: string) {
    if (plannerPool.some((group) => group.code === code)) {
      removeFromPlanner(code);
      return;
    }

    if (plannerPool.length >= maxPlannerPool) {
      setPlannerPoolNotice(`ตัวช่วยเก็บได้สูงสุด ${maxPlannerPool} วิชา เอาวิชาที่ไม่ใช้ออกก่อน`);
      return;
    }

    const groups = groupRemoteClasses(remoteClasses.filter((remoteClass) => remoteClass.coursecode === code));
    setPlannerPoolNotice("");
    setPlannerPool((current) => mergeIntoPool(current, groups));
    setPlannerSelectedCodes((current) => (current.includes(code) ? current : [...current, code]));
  }

  function toggleAvoidDay(day: DayKey) {
    setPlannerAvoidDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  }

  function generateSchedulePlans() {
    const selectedGroups = plannerSelectedCodes
      .map((code) => plannerPool.find((group) => group.code === code))
      .filter(Boolean) as RemoteCourseGroup[];

    if (selectedGroups.length === 0) {
      setGeneratedPlans([]);
      setPlannerStatus("เลือกรหัสวิชาจากข้อมูลที่โหลดก่อน");
      setPlannerGenerateError("เลือกรหัสวิชาจากข้อมูลที่โหลดก่อน");
      return;
    }

    if (countPlannerSlots(plannerSelectedCodes, plannerGroups) > 7) {
      setGeneratedPlans([]);
      setPlannerStatus("เลือกได้สูงสุด 7 วิชาต่อครั้งเพื่อให้คำนวณเร็ว");
      setPlannerGenerateError("เลือกได้สูงสุด 7 วิชาต่อครั้งเพื่อให้คำนวณเร็ว");
      return;
    }

    const replaceable = replaceableCodes(plannerSelectedCodes, plannerGroups);
    const lockedCourses = shownCourses.filter((course) => course.locked || !replaceable.has(course.code));
    const lockedCodes = new Set(shownCourses.filter((course) => course.locked).map((course) => course.code));
    const groupedCodes = new Set(plannerGroups.flatMap((group) => group.codes));
    const unlockedSingles = selectedGroups.filter((group) => !groupedCodes.has(group.code) && !lockedCodes.has(group.code));
    // กลุ่มที่ติ๊กและยังไม่มีสมาชิกถูกล็อกในตาราง (ล็อกไว้แล้ว = กลุ่มนี้ได้แล้ว ไม่ต้องเลือกเพิ่ม)
    const openGroups = plannerGroups.filter(
      (group) => group.codes.some((code) => plannerSelectedCodes.includes(code)) && !group.codes.some((code) => lockedCodes.has(code)),
    );
    if (coursesHaveConflict(lockedCourses)) {
      setGeneratedPlans([]);
      setPlannerStatus("วิชาที่ล็อกหรือวิชาที่คงไว้มีเวลาชนกัน จึงสร้างแผนไม่ได้");
      setPlannerGenerateError("วิชาที่ล็อกหรือวิชาที่คงไว้มีเวลาชนกัน จึงสร้างแผนไม่ได้");
      return;
    }

    if (unlockedSingles.length + openGroups.length === 0) {
      setGeneratedPlans([]);
      setPlannerStatus("วิชาที่เลือกถูกล็อกไว้ทั้งหมด หรือยังไม่ได้โหลด section ของรหัสที่เลือก");
      setPlannerGenerateError("วิชาที่เลือกถูกล็อกไว้ทั้งหมด หรือยังไม่ได้โหลด section ของรหัสที่เลือก");
      return;
    }

    type PlanOption = { remoteClass: RemoteClass; courses: Course[] };
    const toOptions = (classes: RemoteClass[], slotIndex: number): PlanOption[] =>
      classes.map((remoteClass, optionIndex) => ({
        remoteClass,
        courses: remoteClassToCourses(remoteClass, palette[(lockedCourses.length + slotIndex + optionIndex) % palette.length]),
      }));
    const slots: Slot<PlanOption>[] = [
      ...unlockedSingles.map((group, index) => ({ id: group.code, kind: "single" as const, options: toOptions(plannerClassesFor(group), index) })),
      ...openGroups.map((group, index) => ({
        id: group.id,
        kind: "group" as const,
        cap: 24,
        options: toOptions(
          interleave(
            group.codes.map((code) => {
              const member = plannerPool.find((item) => item.code === code);
              return member ? plannerClassesFor(member) : [];
            }),
          ),
          unlockedSingles.length + index,
        ),
      })),
    ];
    const results: GeneratedSchedulePlan[] = [];
    const solutions = solveSlots(
      slots,
      (chosen) => !coursesHaveConflict([...lockedCourses, ...chosen.flatMap((option) => option.courses)]),
      { perSlotCap: 12, maxResults: 20 },
    );

    solutions.forEach((solution) => {
      const candidateCourses = [...lockedCourses, ...solution.picks.flatMap((pick) => pick?.courses ?? [])];
      const scored = scorePlan(candidateCourses, plannerAvoidDays, plannerStart, plannerEnd, plannerLunchBreak);
      const groupNotes = openGroups.map((group) => {
        const pick = solution.picks[unlockedSingles.length + openGroups.indexOf(group)];
        return pick
          ? { groupId: group.id, group: group.name, text: `${group.name} → ${pick.remoteClass.coursename} S.${pick.remoteClass.sectioncode}`, skipped: false }
          : { groupId: group.id, group: group.name, text: `ข้ามกลุ่ม ${group.name}: ไม่มีวิชาที่ลงเวลาได้กับแผนนี้`, skipped: true };
      });
      const skippedNotes = groupNotes.filter((note) => note.skipped);
      results.push({
        id: crypto.randomUUID(),
        name: `แผนอัตโนมัติ ${results.length + 1}`,
        courses: candidateCourses,
        score: Math.max(0, scored.score - skippedNotes.length * 15),
        reasons: [...scored.reasons, ...skippedNotes.map((note) => note.text)],
        groupNotes,
      });
    });

    const sortedResults = selectTopPlans(results, 6, (plan) => plan.score, (plan) => plan.groupNotes.filter((note) => note.skipped).map((note) => note.groupId).join("|"));
    setGeneratedPlans(sortedResults);
    setPlannerStatus(sortedResults.length > 0 ? `พบแผนที่ไม่ชน ${sortedResults.length} แบบ` : "ไม่พบแผนที่ไม่ชนตามรายวิชาที่เลือก");
    setPlannerGenerateError(sortedResults.length > 0 ? null : "ไม่พบแผนที่ไม่ชนตามรายวิชาที่เลือก");
  }

  function applyGeneratedPlan(plan: GeneratedSchedulePlan) {
    hasLocalPlanMutationRef.current = true;
    const nextPlanId = crypto.randomUUID();
    const nextCourses = plan.courses.map((course) => ({ ...course, id: crypto.randomUUID() }));

    setPlans((currentPlans) => [
      ...currentPlans,
      {
        id: nextPlanId,
        name: nextTableName(currentPlans),
        courses: nextCourses,
      },
    ]);
    setActivePlanId(nextPlanId);
    setPlannerStatus(`ใช้ ${plan.name} แล้ว`);
    completeMission("planner");
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = feedbackText.trim();

    if (!message) {
      setFeedbackStatus({ tone: "error", text: "กรุณาพิมพ์ข้อเสนอแนะก่อนส่ง" });
      return;
    }

    setIsSendingFeedback(true);
    setFeedbackStatus(null);

    try {
      const result = await sendFeedbackAction(message);

      if (result.ok) {
        setFeedbackText("");
        setFeedbackStatus({ tone: "ok", text: "ส่งข้อเสนอแนะแล้ว ขอบคุณที่ช่วยแนะนำ" });
      } else {
        setFeedbackStatus({ tone: "error", text: result.error });
      }
    } catch {
      setFeedbackStatus({ tone: "error", text: "ส่งข้อเสนอแนะไม่สำเร็จ กรุณาลองใหม่ภายหลัง" });
    } finally {
      setIsSendingFeedback(false);
    }
  }

  async function createSharedRoom() {
    const planId = createRoomCode();
    const editToken = planId;
    const name = `ห้อง ${planId}`;
    const roomPlans: SharedRoomPlan[] = [{ id: crypto.randomUUID(), name: "ตาราง1", courses: [] }];

    const saved = await saveSharedPlan(planId, editToken, name, roomPlans);
    if (!saved) {
      return;
    }

    setSharedRoom(planId, name, saved.plans ?? roomPlans, saved.updatedAt, editToken);
    setRoomCodeInput(planId);
    window.history.replaceState(null, "", `?room=${planId}`);
    setShareStatus(`สร้างห้อง ${planId} แล้ว`);
    completeMission("room");
  }

  async function enterSharedRoom(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const roomCode = normalizeRoomCode(roomCodeInput);

    if (!roomCode) {
      setShareStatus("กรอกรหัสห้องก่อน");
      return;
    }

    setRoomCodeInput(roomCode);
    if (await loadSharedPlan(roomCode, true, roomCode, true)) {
      completeMission("room");
    }
  }

  async function copyRoomCode() {
    if (!shareSession) {
      return;
    }

    await navigator.clipboard.writeText(shareSession.shareId);
    setShareStatus("คัดลอกรหัสห้องแล้ว");
  }

  function copyActivePlanToLocal() {
    if (!activePlan) {
      return;
    }

    const nextPlanId = crypto.randomUUID();
    const copiedCourses = activePlan.courses.map((course) => ({ ...course, id: crypto.randomUUID() }));

    hasLocalPlanMutationRef.current = true;
    setPlans((currentPlans) => [
      ...currentPlans,
      {
        id: nextPlanId,
        name: nextTableName(currentPlans),
        courses: copiedCourses,
        source: "local",
      },
    ]);
    setActivePlanId(nextPlanId);
    setEditingId(null);
    setForm(emptyCourse);
    setShareStatus("คัดลอกเป็นตารางใหม่แล้ว");
  }

  function leaveSharedMode() {
    const roomPlanIds = shareSession?.localPlanIds ?? [];
    const nextActivePlan = plans.find((plan) => !roomPlanIds.includes(plan.id));

    if (shareSession) {
      const fallbackPlan: TimetablePlan = { id: crypto.randomUUID(), name: defaultPlanName, courses: [] };
      setPlans((currentPlans) => {
        const nextPlans = currentPlans.filter((plan) => !roomPlanIds.includes(plan.id));

        return nextPlans.length > 0 ? nextPlans : [fallbackPlan];
      });
      setActivePlanId(nextActivePlan?.id ?? fallbackPlan.id);
    }
    setShareSession(null);
    setRoomCodeInput("");
    setShareStatus("ออกจากห้องแล้ว");
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function exportExcel() {
    const writeXlsxFile = (await import("write-excel-file/browser")).default;
    const courseHeaders = ["รหัสวิชา", "ชื่อวิชา", "หน่วยกิต", "วันเรียน", "เวลาเริ่ม", "เวลาสิ้นสุด", "ห้อง", "อาจารย์", "สอบกลางภาค", "สอบปลายภาค"];
    const coursesSheet = [
      courseHeaders.map((header) => ({ value: header, fontWeight: "bold" as const })),
      ...courses.map((course) => [
        course.code,
        course.name,
        course.credits,
        days.find((day) => day.key === course.day)?.label ?? course.day,
        course.start,
        course.end,
        course.room,
        course.teacher,
        examText(course.midterm),
        examText(course.final),
      ]),
    ];

    const timetableRows = days.map((day) => {
      const row: Record<string, string> = { วัน: day.label };

      hours.forEach((hour) => {
        const rowStart = hour * 60;
        const rowEnd = rowStart + 60;
        const matches = courses.filter(
          (course) => course.day === day.key && toMinutes(course.start) < rowEnd && toMinutes(course.end) > rowStart,
        );

        row[`${String(hour).padStart(2, "0")}:00`] = matches
          .map((course) => `${course.code} ${course.name} (${course.start}-${course.end}) ${course.room}`)
          .join("\n");
      });

      return row;
    });
    const timetableHeaders = ["วัน", ...hours.map((hour) => `${String(hour).padStart(2, "0")}:00`)];
    const timetableSheet = [
      timetableHeaders.map((header) => ({ value: header, fontWeight: "bold" as const })),
      ...timetableRows.map((row) => timetableHeaders.map((header) => row[header] ?? "")),
    ];

    const examHeaders = ["รหัสวิชา", "ชื่อวิชา", "สอบกลางภาค", "สอบปลายภาค"];
    const examsSheet = [
      examHeaders.map((header) => ({ value: header, fontWeight: "bold" as const })),
      ...courses
        .filter((course) => course.midterm || course.final)
        .map((course) => [course.code, course.name, examText(course.midterm), examText(course.final)]),
    ];

    await writeXlsxFile([
      { sheet: "Courses", data: coursesSheet },
      { sheet: "Timetable", data: timetableSheet },
      { sheet: "Exams", data: examsSheet },
    ]).toFile(`${activePlan?.name || "timetable"}.xlsx`.replace(/[\\/:*?"<>|]/g, "_"));
  }

  function exportTimetableImage() {
    const scale = 2;
    const leftWidth = 132;
    const hourWidth = 116;
    const titleHeight = 92;
    const headerHeight = 46;
    const laneHeight = 112;
    const laneGap = 6;
    const rowPad = 18;
    const emptyRowHeight = 78;
    const noteHeight = 46;
    const padding = 32;

    // Same lane packing as the on-screen week: overlapping classes stack, never
    // paint over each other, so the exported sheet tells the truth about a clash.
    const dayStart = hours[0] * 60;
    const dayEnd = (hours[hours.length - 1] + 1) * 60;
    const dayMinutes = dayEnd - dayStart;
    const laidOutDays = days.map((day) => {
      const { placed, laneCount } = packDayLanes(shownCourses, day.key, dayStart, dayEnd);

      return {
        day,
        placed,
        height: placed.length === 0 ? emptyRowHeight : rowPad + laneCount * laneHeight + (laneCount - 1) * laneGap,
      };
    });

    const gridWidth = leftWidth + hours.length * hourWidth;
    const bodyHeight = laidOutDays.reduce((sum, row) => sum + row.height, 0);
    const gridHeight = headerHeight + bodyHeight;
    const width = padding * 2 + gridWidth;
    const height = padding * 2 + titleHeight + gridHeight + noteHeight;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    // the exported sheet is a second surface of the same design system:
    // registrar-console palette, Prompt for Thai, Montserrat for numerals.
    const bodyStyles = window.getComputedStyle(document.body);
    const readFamily = (name: string) => bodyStyles.getPropertyValue(name).trim();
    const thaiFace = [readFamily("--font-th"), '"Leelawadee UI"', '"Segoe UI"', "sans-serif"].filter(Boolean).join(", ");
    const numFace = [readFamily("--font-mont"), thaiFace].filter(Boolean).join(", ");
    const ink = { heading: "#5e5873", body: "#6e6b7b", quiet: "#71757c", muted: "#71757c" };
    const line = "#ebe9f1";
    const softLine = "#f2f0f7";
    const sunk = "#fafafc";
    const danger = "#ea5455";
    const dangerFill = "#fdeced";
    const tint = (hex: string, amount: number) => {
      const value = hex.replace("#", "");
      const channel = (index: number) => parseInt(value.slice(index * 2, index * 2 + 2), 16);
      const mix = (part: number) => Math.round(part * amount + 255 * (1 - amount));

      return `rgb(${mix(channel(0))}, ${mix(channel(1))}, ${mix(channel(2))})`;
    };

    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    context.fillStyle = ink.heading;
    context.font = `600 27px ${thaiFace}`;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText(activePlan?.name || defaultPlanName, padding, padding + 28);
    context.fillStyle = ink.quiet;
    context.font = `400 14px ${thaiFace}`;
    context.fillText(`${shownCourseCount} วิชา · ${totalCredits} หน่วยกิต · สร้างจาก TableLearn`, padding, padding + 52);
    context.strokeStyle = line;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding, padding + 68.5);
    context.lineTo(width - padding, padding + 68.5);
    context.stroke();

    const gridX = padding;
    const gridY = padding + titleHeight;

    context.fillStyle = "#ffffff";
    context.fillRect(gridX, gridY, gridWidth, gridHeight);
    context.fillStyle = sunk;
    context.fillRect(gridX, gridY, gridWidth, headerHeight);
    context.fillRect(gridX, gridY + headerHeight, leftWidth, bodyHeight);

    // alternating hour bands keep the eye on one column
    hours.forEach((hour, index) => {
      if (index % 2 === 0) {
        return;
      }

      context.fillStyle = "#fcfcfd";
      context.fillRect(gridX + leftWidth + index * hourWidth, gridY + headerHeight, hourWidth, bodyHeight);
    });

    context.font = `600 13px ${numFace}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = ink.quiet;

    hours.forEach((hour, index) => {
      const x = gridX + leftWidth + index * hourWidth;
      context.fillText(`${String(hour).padStart(2, "0")}:00`, x + hourWidth / 2, gridY + headerHeight / 2);
    });

    context.font = `500 13px ${thaiFace}`;
    context.fillStyle = ink.heading;
    context.fillText("วัน / เวลา", gridX + leftWidth / 2, gridY + headerHeight / 2);

    let rowY = gridY + headerHeight;
    const rowTops: number[] = [];

    laidOutDays.forEach((row) => {
      rowTops.push(rowY);
      context.fillStyle = ink.body;
      context.font = `500 14px ${thaiFace}`;
      context.fillText(row.day.label, gridX + leftWidth / 2, rowY + row.height / 2);
      rowY += row.height;
    });

    context.lineWidth = 1;

    for (let index = 0; index <= hours.length; index += 1) {
      const x = gridX + leftWidth + index * hourWidth;
      context.strokeStyle = softLine;
      context.beginPath();
      context.moveTo(x + 0.5, gridY);
      context.lineTo(x + 0.5, gridY + gridHeight);
      context.stroke();
    }

    [...rowTops, gridY + gridHeight].forEach((y) => {
      context.strokeStyle = line;
      context.beginPath();
      context.moveTo(gridX, y + 0.5);
      context.lineTo(gridX + gridWidth, y + 0.5);
      context.stroke();
    });

    context.strokeStyle = line;
    context.strokeRect(gridX + 0.5, gridY + 0.5, gridWidth - 1, gridHeight - 1);

    laidOutDays.forEach((row, dayIndex) => {
      row.placed.forEach(({ course, lane, start, finish }) => {
        const isClash = conflictIds.has(course.id);
        const left = ((start - dayStart) / dayMinutes) * (gridWidth - leftWidth);
        const span = ((finish - start) / dayMinutes) * (gridWidth - leftWidth);
        const x = gridX + leftWidth + left + 6;
        const y = rowTops[dayIndex] + 9 + lane * (laneHeight + laneGap);
        const blockWidth = Math.max(56, span - 12);
        const blockHeight = laneHeight - 10;
        const radius = 5;

        context.save();
        context.beginPath();
        context.roundRect(x, y, blockWidth, blockHeight, radius);
        context.shadowColor = "rgba(34, 41, 47, 0.1)";
        context.shadowBlur = 7;
        context.shadowOffsetY = 2;
        context.fillStyle = isClash ? dangerFill : tint(course.color, 0.09);
        context.fill();
        context.restore();

        context.strokeStyle = isClash ? danger : tint(course.color, 0.26);
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(x + 0.5, y + 0.5, blockWidth - 1, blockHeight - 1, radius);
        context.stroke();

        context.save();
        context.beginPath();
        context.roundRect(x, y, blockWidth, blockHeight, radius);
        context.clip();
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        // one course keeps one identity colour on every surface; the red border,
        // the red field and the ชนกัน pill already carry the clash on this sheet too
        context.fillStyle = course.color;
        context.font = `600 12px ${numFace}`;
        context.fillText(course.code, x + 13, y + 22);

        // a clash carries the word, never colour alone
        if (isClash) {
          const codeWidth = context.measureText(course.code).width;
          const badgeX = x + 13 + codeWidth + 8;
          const badgeWidth = 40;

          context.beginPath();
          context.roundRect(badgeX, y + 11, badgeWidth, 15, 7.5);
          context.fillStyle = danger;
          context.fill();
          context.fillStyle = "#ffffff";
          context.font = `500 10px ${thaiFace}`;
          context.textAlign = "center";
          context.fillText("ชนกัน", badgeX + badgeWidth / 2, y + 22);
          context.textAlign = "left";
        }

        context.fillStyle = ink.heading;
        context.font = `500 13.5px ${thaiFace}`;
        drawWrappedText(context, course.name, x + 13, y + 43, blockWidth - 24, 18, 2);
        context.fillStyle = ink.quiet;
        context.font = `400 12.5px ${thaiFace}`;
        drawWrappedText(context, course.teacher, x + 13, y + blockHeight - 41, blockWidth - 24, 16, 1);
        context.font = `500 12.5px ${numFace}`;
        drawWrappedText(context, `${course.start}-${course.end}`, x + 13, y + blockHeight - 24, blockWidth - 24, 16, 1);
        context.font = `400 12.5px ${thaiFace}`;
        drawWrappedText(context, course.room, x + 13, y + blockHeight - 8, blockWidth - 24, 16, 1);
        context.restore();
      });
    });

    const noteY = gridY + gridHeight + 22;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = ink.quiet;
    context.font = `400 12.5px ${thaiFace}`;
    context.fillText("เว็บนี้เป็นเครื่องมือช่วยวางแผนลงทะเบียน ไม่ใช่ระบบของมหาวิทยาลัย", padding, noteY);
    context.fillText("ข้อมูลรายวิชามาจาก reg.kmutnb.ac.th โปรดตรวจสอบข้อมูลล่าสุดจากเว็บนั้นก่อนลงทะเบียนจริง", padding, noteY + 18);

    downloadCanvas(canvas, `${activePlan?.name || "timetable"}.png`);
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      event.currentTarget.value = "";
      return;
    }

    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setExcelStatus("กำลังนำเข้า Excel...");

    try {
      if (file.size > maxExcelFileSize) {
        throw new Error("ไฟล์ Excel ใหญ่เกินไป รองรับสูงสุด 1 MB");
      }

      const { readSheet } = await import("read-excel-file/browser");
      let sheetRows = await readSheet(file, "Courses").catch(() => null);

      if (!sheetRows) {
        sheetRows = await readSheet(file);
      }

      const [headers = [], ...dataRows] = sheetRows;
      const headerNames = headers.map(excelCellText);
      const rows: Record<string, unknown>[] = [];

      dataRows.forEach((row) => {
        const values: Record<string, unknown> = {};
        headerNames.forEach((header, index) => {
          if (header) {
            values[header] = row[index] ?? "";
          }
        });
        rows.push(values);
      });

      if (rows.length > maxExcelRows) {
        throw new Error(`นำเข้าได้สูงสุด ${maxExcelRows} แถวต่อไฟล์`);
      }

      const importedCourses: Course[] = rows.flatMap((row, index) => {
        const code = rowValue(row, ["รหัสวิชา", "code", "course code", "coursecode"]);
        const name = rowValue(row, ["ชื่อวิชา", "name", "course name", "coursename"]);
        const start = parseImportedTime(rowValue(row, ["เวลาเริ่ม", "เริ่ม", "start", "start time"]), "09:00");
        const end = parseImportedTime(rowValue(row, ["เวลาสิ้นสุด", "สิ้นสุด", "end", "end time"]), "10:00");

        if (!code && !name) {
          return [];
        }

        if (toMinutes(start) >= toMinutes(end)) {
          return [];
        }

        return [{
          id: crypto.randomUUID(),
          name: name || code,
          code: code || name,
          credits: Number(rowValue(row, ["หน่วยกิต", "credits", "credit"])) || 3,
          day: parseImportedDay(rowValue(row, ["วันเรียน", "วัน", "day"])),
          start,
          end,
          room: rowValue(row, ["ห้อง", "ห้องเรียน", "room"]),
          teacher: rowValue(row, ["อาจารย์", "ผู้สอน", "teacher", "instructor"]),
          midterm: parseImportedDateTime(rowValue(row, ["สอบกลางภาค", "กลางภาค", "midterm"])),
          final: parseImportedDateTime(rowValue(row, ["สอบปลายภาค", "ปลายภาค", "final"])),
          color: palette[(courses.length + index) % palette.length],
        }];
      });

      if (importedCourses.length === 0) {
        throw new Error("ไม่พบรายวิชาที่นำเข้าได้ในไฟล์นี้");
      }

      updateActiveCourses((current) => [...current, ...importedCourses]);
      setExcelStatus(`นำเข้าแล้ว ${importedCourses.length} วิชา`);
    } catch (error) {
      setExcelStatus(error instanceof Error ? error.message : "นำเข้า Excel ไม่สำเร็จ");
    }
  }

  // catalog ใช้ตอนเปิดจากแค็ตตาล็อก GE เพราะ setCourseSearch/setCampusId ยังไม่ทันอัปเดต state
  async function loadRemoteClasses(catalog?: CatalogQuery) {
    setIsLoadingClasses(true);
    setClassError("");

    try {
      const params = classQueryParams(
        { academicYear, semester, campusId, divisionCode, levelId, facultyId, departmentId, classSet, courseSearch },
        catalog,
      );

      const response = await fetch(`/api/kmutnb/classes?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "โหลดข้อมูลรายวิชาไม่สำเร็จ");
      }

      const loadedClasses: RemoteClass[] = Array.isArray(data) ? data : [];
      setRemoteClasses(loadedClasses);
      // อัปเดต section ของวิชาที่เลือกไว้แล้ว ถ้าโหลดชุดใหม่มีวิชานั้นด้วย
      const loadedGroups = new Map(groupRemoteClasses(loadedClasses).map((group) => [group.code, group]));
      setPlannerPool((current) => current.map((group) => loadedGroups.get(group.code) ?? group));
      setHasLoadedClasses(true);
      window.requestAnimationFrame(() => {
        remoteResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setClassError(error instanceof Error ? error.message : "โหลดข้อมูลรายวิชาไม่สำเร็จ");
      setHasLoadedClasses(true);
    } finally {
      setIsLoadingClasses(false);
    }
  }

  function importRemoteClass(remoteClass: RemoteClass) {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    const color = palette[courses.length % palette.length];
    const importedCourses = remoteClassToCourses(remoteClass, color);

    updateActiveCourses((current) => [...current, ...importedCourses]);
  }

  function importPlannerSection(remoteClass: RemoteClass) {
    if (!canEditActivePlan) {
      setPlannerStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
      return;
    }

    importRemoteClass(remoteClass);
    setPlannerStatus(`นำ ${remoteClass.coursecode} S.${remoteClass.sectioncode} เข้าตารางแล้ว`);
  }

  // แถววิชาในตัวช่วยจัดแผน owner = กลุ่มที่วิชานี้อยู่ (วิชาในกลุ่มไม่มีช่องติ๊กของตัวเอง ติ๊กที่หัวกลุ่ม)
  function renderPickRow(group: RemoteCourseGroup, owner?: CourseGroup) {
    const isSelected = plannerSelectedCodes.includes(group.code);
    const picks = isSelected ? plannerSectionPicks[group.code] : undefined;
    const isExpanded = expandedPlannerCode === group.code;
    const panelId = `pick-sections-${group.code}`;

    return (
      <div className={isExpanded ? "pick-row is-open" : "pick-row"} key={group.code}>
        {owner ? (
          <span className="check-text pick-member">
            <b>{group.code}</b>
            {group.name} · {picks ? `เลือก ${picks.length}/${group.classes.length} section` : `${group.classes.length} section`}
          </span>
        ) : (
          <label className="check">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => togglePlannerSelected(group.code)}
            />
            <span className="check-box" aria-hidden="true" />
            <span className="check-text">
              <b>{group.code}</b>
              {group.name} · {picks ? `เลือก ${picks.length}/${group.classes.length} section` : `${group.classes.length} section`}
            </span>
          </label>
        )}
        <div className="pick-row-actions">
          <button
            type="button"
            className={isExpanded ? "btn btn-quiet is-on" : "btn btn-quiet"}
            aria-expanded={isExpanded}
            aria-controls={panelId}
            onClick={() => setExpandedPlannerCode(isExpanded ? null : group.code)}
          >
            ดู section
            <IconChevron className="pick-chevron" />
          </button>
          {owner ? (
            <button type="button" className="btn btn-quiet" onClick={() => movePlannerCode(group.code, null)}>
              นำออกจากกลุ่ม
            </button>
          ) : (
            <GroupMoveMenu
              groups={plannerGroups}
              onMove={(groupId) => movePlannerCode(group.code, groupId)}
              onCreate={() => createPlannerGroup(group.code)}
            />
          )}
          <button type="button" className="btn btn-quiet" onClick={() => removeFromPlanner(group.code)}>
            เอาออก
          </button>
        </div>
        {isExpanded && (
          <div className="pick-sections" id={panelId}>
            <p className="pick-sections-note">
              {!isSelected
                ? owner
                  ? "กลุ่มนี้ยังไม่ได้ใช้สร้างแผน เลือก section ที่ต้องการ หรือติ๊กที่หัวกลุ่มเพื่อใช้ทุก section"
                  : "ยังไม่ได้ใช้วิชานี้สร้างแผน เลือก section ที่ต้องการ หรือติ๊กวิชาเพื่อใช้ทุก section"
                : picks
                  ? `ตัวช่วยจะลองเฉพาะ ${group.classes.filter((remoteClass) => picks.includes(remoteClass.classid)).map((remoteClass) => `S.${remoteClass.sectioncode}`).join(", ")}`
                  : "ตัวช่วยจะลองทุก section ของวิชานี้"}
              {picks && (
                <button type="button" className="link-btn" onClick={() => selectAllPlannerSections(group.code)}>ใช้ทุก section</button>
              )}
            </p>
            <ul className="pick-section-list">
              {group.classes.map((remoteClass) => {
                const meetings = parseClassMeetings(remoteClass.classtime);
                const isPickedSection = Boolean(picks?.includes(remoteClass.classid));
                const clashes = remoteClassToCourses(remoteClass, "#000000").some((candidate) =>
                  shownCourses.some((course) => course.code !== remoteClass.coursecode && overlaps(candidate, course)),
                );

                return (
                  <li className={isPickedSection ? "pick-section is-picked" : "pick-section"} key={remoteClass.classid}>
                    <div className="pick-section-head">
                      <span className="remote-section">S.{remoteClass.sectioncode}</span>
                      {clashes && <span className="pick-section-clash">ชนกับตาราง</span>}
                    </div>
                    <ul className="pick-section-times">
                      {meetings.length === 0 ? (
                        <li>ไม่ระบุเวลา</li>
                      ) : (
                        meetings.map((meeting, index) => (
                          <li key={index}>
                            <b>{days.find((day) => day.key === meeting.day)?.label ?? ""}</b> {meeting.start}-{meeting.end}
                            {meeting.room && <span> · {meeting.room}</span>}
                          </li>
                        ))
                      )}
                    </ul>
                    {teacherName(remoteClass) && <p className="pick-section-teacher">{teacherName(remoteClass)}</p>}
                    <div className="pick-section-actions">
                      <button type="button" className="btn btn-primary" onClick={() => importPlannerSection(remoteClass)} disabled={!canEditActivePlan}>
                        นำเข้าตาราง
                      </button>
                      <button
                        type="button"
                        className={isPickedSection ? "btn btn-line is-on" : "btn btn-line"}
                        aria-pressed={isPickedSection}
                        onClick={() => togglePlannerSection(group.code, remoteClass.classid)}
                      >
                        {isPickedSection ? "ใช้วางแผนอยู่" : "ใช้ section นี้วางแผน"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-mark">
          <span className="mark-glyph" aria-hidden="true"><IconMark /></span>
          <span className="mark-words">
            <span className="mark-name">TableLearn</span>
            <span className="mark-sub">ผู้ช่วยวางแผนลงทะเบียน มจพ.</span>
          </span>
        </div>

        <button type="button" className="btn btn-primary rail-cta" data-tour="fetch-courses" onClick={() => setIsCourseBrowserOpen(true)}>
          ดึงรายวิชาจากเว็บ
          <IconArrow />
        </button>

        <nav className="rail-nav" data-tour="zone-nav" aria-label="ส่วนของหน้า">
          {zones.map((zone) => (
            <a
              key={zone.id}
              href={`#${zone.id}`}
              className={activeZone === zone.id ? "rail-tab is-active" : "rail-tab"}
              aria-current={activeZone === zone.id ? "true" : undefined}
              onClick={() => {
                unfoldZone(zone.id);
                // ส่วนท้าย ๆ เลื่อนขึ้นไม่ถึงจุดที่ observer จับ จึงตั้ง active เองและพัก observer ระหว่างเลื่อน
                navClickZoneRef.current = { id: zone.id, until: Date.now() + 1200 };
                setActiveZone(zone.id);
              }}
            >
              <zone.Icon />
              <span className="tab-long">{zone.label}</span>
              <span className="tab-short">{zone.short}</span>
            </a>
          ))}
        </nav>

        <div className="readout" aria-label="สรุปตารางเรียน">
          <p className="readout-head">ตารางปัจจุบัน</p>
          <p className="readout-plan">{activePlan?.name ?? defaultPlanName}</p>
          <dl className="measures">
            <div>
              <dt>รายวิชา</dt>
              <dd>{shownCourseCount}<i>วิชา</i></dd>
            </div>
            <div>
              <dt>หน่วยกิต</dt>
              <dd>{totalCredits}<i>นก.</i></dd>
            </div>
            <div className={conflicts.length > 0 ? "is-clash" : undefined}>
              <dt>เวลาชน</dt>
              <dd>{conflicts.length}<i>คู่</i></dd>
            </div>
            <div>
              <dt>ตารางสอบ</dt>
              <dd>{examCount}<i>วิชา</i></dd>
            </div>
          </dl>
          <p className="readout-room">
            <span>{shareSession ? "ห้องร่วมกัน" : "ตารางส่วนตัว"}</span>
            <b className={shareSession ? "is-code" : undefined}>{shareSession ? shareSession.shareId : "เก็บในเครื่องนี้"}</b>
          </p>
        </div>
      </aside>

      <main className="works">
        <section className="zone zone-primary" id="face" aria-labelledby="face-title" data-folded={foldedZones.includes("face") ? "true" : undefined}>
          <div className="zone-head">
            <button type="button" className="zone-fold" aria-expanded={!foldedZones.includes("face")} aria-label={foldedZones.includes("face") ? "เปิดส่วนนี้" : "ย่อส่วนนี้"} onClick={() => toggleZoneFold("face")}><IconChevron /></button>
            <div className="zone-title"><h1 id="face-title">ตารางเรียนสัปดาห์นี้</h1><HelpButton zone="face" onStartTour={onboarding.startTour} /></div>
            <p>ดูทุกคาบเรียนในสัปดาห์ พร้อมเวลาที่ชนกันและชั่วโมงว่างที่เหลือ</p>
          </div>

          {(isActiveReadOnlySharedPlan || conflicts.length > 0 || examWarnings.length > 0) && (
            <div className="alerts" role="status">
              {isActiveReadOnlySharedPlan && (
                <p className="alert-row">
                  <IconAnchor />
                  ห้องนี้เป็นโหมดดูอย่างเดียว จึงเพิ่ม ลบ หรือแก้รายวิชาไม่ได้
                </p>
              )}
              {conflicts.length > 0 && (
                <p className="alert-row is-clash">
                  <IconNote />
                  พบเวลาชนกัน {conflicts.length} คู่ ตรวจรายวิชาที่ทับซ้อนในตาราง
                </p>
              )}
              {examWarnings.length > 0 && (
                <p className="alert-row is-exam">
                  <IconStorm />
                  พบความเสี่ยงตารางสอบ {examWarnings.length} รายการ
                </p>
              )}
            </div>
          )}

          <div className="strip strip-plan">
            <label className="field field-select">
              <span>เลือกตาราง</span>
              <select
                value={currentPlanId}
                onChange={(event) => {
                  setActivePlanId(event.target.value);
                  setEditingId(null);
                  setForm(emptyCourse);
                }}
              >
                {visiblePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>ชื่อตาราง</span>
              <input value={activePlan?.name ?? ""} onChange={(event) => renamePlan(event.target.value)} disabled={!canEditActivePlan} />
            </label>
            <div className="strip-actions">
              <button type="button" className="btn btn-line" data-tour="add-plan" onClick={addPlan}>
                <IconPlus />
                เพิ่มตาราง
              </button>
              <button type="button" className="btn btn-line btn-destructive" onClick={removePlan} disabled={!canRemoveCurrentPlan}>
                ลบตาราง
              </button>
            </div>
          </div>

          <div className="strip strip-tools">
            <div className="tool-group">
              <input
                ref={excelInputRef}
                className="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={importExcel}
                aria-label="Import Excel"
              />
              <button type="button" className="btn btn-line" onClick={() => excelInputRef.current?.click()} disabled={!canEditActivePlan}>นำเข้า Excel</button>
              <button type="button" className="btn btn-line" onClick={exportTimetableImage} disabled={courses.length === 0}>บันทึกเป็นรูป</button>
              <button type="button" className="btn btn-line" onClick={() => setIcsDialog({ ...defaultIcsRange(new Date()), error: "" })} disabled={shownCourses.length === 0}>ส่งออกปฏิทิน</button>
              <button type="button" className="btn btn-line" onClick={exportExcel} disabled={courses.length === 0}>ส่งออก Excel</button>
            </div>
            <div className="view-toggle" role="group" aria-label="มุมมองตาราง">
              <button
                type="button"
                className={timetableView === "grid" ? "is-on" : undefined}
                onClick={() => setTimetableView("grid")}
                aria-pressed={timetableView === "grid"}
              >
                ตาราง
              </button>
              <button
                type="button"
                className={timetableView === "list" ? "is-on" : undefined}
                onClick={() => setTimetableView("list")}
                aria-pressed={timetableView === "list"}
              >
                รายวัน
              </button>
            </div>
          </div>

          {excelStatus && <p className="status-line">{excelStatus}</p>}

          {hiddenCourseCount > 0 && (
            <p className="hidden-strip">
              ซ่อนไว้ {hiddenCourseCount} รายการ แสดงเป็นสีเทา ไม่นับหน่วยกิตและเวลาชน
              <button type="button" className="link-btn" onClick={showAllCourses} disabled={!canEditActivePlan}>แสดงทั้งหมด</button>
            </p>
          )}

          {timetableView === "grid" ? (
            <div className="grid-scroll" data-tour="timetable">
              <div className="timetable">
                <div className="corner">วัน / เวลา</div>
                {hours.map((hour) => (
                  <div className="time-head" key={hour}>{String(hour).padStart(2, "0")}:00</div>
                ))}
                {days.map((day) => (
                  <DayRow
                    key={day.key}
                    day={day}
                    courses={courses}
                    conflictIds={conflictIds}
                    actions={canEditActivePlan ? { onHide: toggleCourseHidden, onRemove: removeCourse } : undefined}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="day-list" data-tour="timetable">
              {dailyCourses.map((day) => (
                <DayList
                  key={day.key}
                  day={day}
                  conflictIds={conflictIds}
                  actions={canEditActivePlan ? { onHide: toggleCourseHidden, onRemove: removeCourse } : undefined}
                />
              ))}
            </div>
          )}
        </section>

        <section className="zone" id="blocks" aria-labelledby="blocks-title" data-folded={foldedZones.includes("blocks") ? "true" : undefined}>
          <div className="zone-head">
            <button type="button" className="zone-fold" aria-expanded={!foldedZones.includes("blocks")} aria-label={foldedZones.includes("blocks") ? "เปิดส่วนนี้" : "ย่อส่วนนี้"} onClick={() => toggleZoneFold("blocks")}><IconChevron /></button>
            <div className="zone-title"><h2 id="blocks-title">รายวิชาที่บันทึก</h2><HelpButton zone="blocks" onStartTour={onboarding.startTour} /></div>
            <p>รายวิชาทั้งหมดในตารางนี้ ล็อกไว้เพื่อกันไม่ให้ตัวช่วยจัดแผนสลับ section</p>
            <div className="zone-actions">
              <button
                type="button"
                className="btn btn-line"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyCourse);
                  setIsManualCourseOpen(true);
                }}
                disabled={!canEditActivePlan}
              >
                <IconPlus />
                เพิ่มด้วยตนเอง
              </button>
              <button type="button" className="btn btn-line btn-destructive" onClick={removeAllCourses} disabled={courses.length === 0 || !canEditActivePlan}>
                ลบทั้งหมด
              </button>
            </div>
          </div>

          {courses.length === 0 ? (
            <p className="empty" data-tour="blocks-empty">ยังไม่มีรายวิชา ดึงรายวิชาจากเว็บหรือเพิ่มด้วยตนเองเพื่อเริ่มจัดตาราง</p>
          ) : (
            <div className="block-list">
              {courses.map((course, courseIndex) => (
                <article
                  className={["course-card", conflictIds.has(course.id) ? "is-clash" : "", course.hidden ? "is-hidden" : ""].filter(Boolean).join(" ")}
                  key={course.id}
                  style={{ ["--course" as string]: course.color }}
                >
                  <header>
                    <span className="course-code">{course.code}</span>
                    {course.locked && <span className="tag tag-lock"><IconAnchor />ล็อก</span>}
                    {conflictIds.has(course.id) && <span className="tag tag-clash">ชนกัน</span>}
                    {course.hidden && <span className="tag tag-hidden">ซ่อนอยู่</span>}
                  </header>
                  <p className="course-name">{course.name}</p>
                  <dl className="course-meta">
                    <div>
                      <dt>เวลา</dt>
                      <dd>{days.find((day) => day.key === course.day)?.label} {course.start}-{course.end}</dd>
                    </div>
                    <div>
                      <dt>ห้อง</dt>
                      <dd>{course.room || "-"}</dd>
                    </div>
                    <div>
                      <dt>อาจารย์</dt>
                      <dd>{course.teacher || "-"}</dd>
                    </div>
                    <div>
                      <dt>หน่วยกิต</dt>
                      <dd>{course.credits}</dd>
                    </div>
                  </dl>
                  <footer>
                    <button type="button" data-tour={courseIndex === 0 ? "lock-first" : undefined} onClick={() => toggleCourseLocked(course.id)} disabled={!canEditActivePlan}>
                      {course.locked ? "ปลดล็อก" : "ล็อก"}
                    </button>
                    <button type="button" onClick={() => toggleCourseHidden(course.id)} disabled={!canEditActivePlan}>
                      {course.hidden ? "แสดง" : "ซ่อน"}
                    </button>
                    <button type="button" onClick={() => editCourse(course)} disabled={!canEditActivePlan}>แก้ไข</button>
                    <button type="button" className="is-destructive" onClick={() => removeCourse(course.id)} disabled={!canEditActivePlan}>ลบ</button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="zone" id="ge" aria-labelledby="ge-title" data-folded={foldedZones.includes("ge") ? "true" : undefined}>
          <div className="zone-head">
            <button type="button" className="zone-fold" aria-expanded={!foldedZones.includes("ge")} aria-label={foldedZones.includes("ge") ? "เปิดส่วนนี้" : "ย่อส่วนนี้"} onClick={() => toggleZoneFold("ge")}><IconChevron /></button>
            <div className="zone-title"><h2 id="ge-title">วิชาศึกษาทั่วไป</h2><HelpButton zone="ge" onStartTour={onboarding.startTour} /></div>
            <p>
              สำหรับหลักสูตร ป.ตรี 4–5 ปี ที่เรียน ณ {geCampusInfo.label} ·{" "}
              <a href={GE_SOURCE_URL} target="_blank" rel="noreferrer">รายวิชาจากเล่มรายวิชาศึกษาทั่วไป ฉบับปี พ.ศ. 2566</a>
            </p>
          </div>

          <div className="ge-filters">
            <div className="ge-chips" role="group" aria-label="วิทยาเขต">
              {geCampuses.map((campus) => (
                <button
                  type="button"
                  key={campus.id}
                  className={geCampus === campus.id ? "btn btn-line is-on" : "btn btn-line"}
                  aria-pressed={geCampus === campus.id}
                  onClick={() => setGeCampus(campus.id)}
                >
                  {campus.short}
                </button>
              ))}
            </div>
            <input
              className="ge-search"
              type="search"
              value={geQuery}
              onChange={(event) => setGeQuery(event.target.value)}
              placeholder="ค้นหารหัสหรือชื่อวิชา"
              aria-label="ค้นหาวิชาศึกษาทั่วไป"
            />
            <div className="ge-chips" role="group" aria-label="กลุ่มวิชา">
              {[{ id: "" as const, short: "ทั้งหมด" }, ...geGroups].map((group) => (
                <button
                  type="button"
                  key={group.id || "all"}
                  className={geGroup === group.id ? "btn btn-line is-on" : "btn btn-line"}
                  aria-pressed={geGroup === group.id}
                  onClick={() => setGeGroup(group.id)}
                >
                  {group.short}
                </button>
              ))}
            </div>
            <p className="ge-count">แสดง {visibleGeCourses.length} จาก {campusGeCourses.length} วิชา</p>
          </div>

          {visibleGeCourses.length === 0 ? (
            <p className="empty">ไม่พบวิชาที่ตรงกับคำค้นหรือกลุ่มที่เลือก</p>
          ) : (
            geGroups.map((group) => {
              const rows = visibleGeCourses.filter((course) => course.group === group.id);
              if (rows.length === 0) return null;
              return (
                // พับทุกกลุ่มไว้ก่อน รายการยาวเกินไปถ้ากางหมด เปิดให้อัตโนมัติเมื่อค้นหาหรือเลือกกลุ่ม
                <details className="ge-group" key={`${group.id}-${geFiltering}`} open={geFiltering}>
                  <summary>
                    <IconChevron className="ge-chevron" />
                    <h3>{group.label} <span>{rows.length} วิชา</span></h3>
                  </summary>
                  <ul className="ge-list">
                    {rows.map((course) => (
                      <li className="ge-row" key={course.code}>
                        <span className="ge-code">{course.code}</span>
                        <div className="ge-name">
                          <p>
                            {course.nameTh}
                            {course.required && <span className="tag tag-lock">บังคับ</span>}
                            {course.citOnly && <span className="tag tag-cit" title="เล่มระบุว่าเปิดให้นักศึกษาวิทยาลัยเทคโนโลยีอุตสาหกรรมเท่านั้น">เปิดเฉพาะ CIT</span>}
                          </p>
                          <p className="ge-en">{course.nameEn}</p>
                        </div>
                        <span className="ge-credits">{course.credits}</span>
                        <button
                          type="button"
                          className="btn btn-line"
                          onClick={() => {
                            // วิชาระยองค้นที่วิทยาเขตระยอง วิชาชุดกรุงเทพฯ/ปราจีนบุรีคงวิทยาเขตที่เลือกไว้ ยกเว้นค้างอยู่ที่ระยอง
                            const nextCampusId =
                              course.campus === "rayong" ? geCampusInfo.registrarCampusId : campusId === "21" ? "10" : campusId;
                            setCourseSearch(course.code);
                            setCampusId(nextCampusId);
                            setFacultyId("");
                            setDepartmentId("");
                            setClassSet("");
                            setIsCourseBrowserOpen(true);
                            void loadRemoteClasses({ courseCode: course.code, campusId: nextCampusId });
                          }}
                        >
                          ดูกลุ่มเรียน
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })
          )}
        </section>

        <section className="zone" id="planner" aria-labelledby="planner-title" data-folded={foldedZones.includes("planner") ? "true" : undefined}>
          <div className="zone-head" data-tour="planner-head">
            <button type="button" className="zone-fold" aria-expanded={!foldedZones.includes("planner")} aria-label={foldedZones.includes("planner") ? "เปิดส่วนนี้" : "ย่อส่วนนี้"} onClick={() => toggleZoneFold("planner")}><IconChevron /></button>
            <div className="zone-title"><h2 id="planner-title">ตัวช่วยจัดแผน</h2><HelpButton zone="planner" onStartTour={onboarding.startTour} /></div>
            <p>เลือกหลาย section จากรายวิชาที่โหลด แล้วให้ระบบสร้างแผนที่ไม่ชนกับวิชาในตารางปัจจุบัน</p>
            <div className="zone-actions">
              <button type="button" className="btn btn-primary" data-tour="planner-generate" onClick={generateSchedulePlans} disabled={plannerSelectedCodes.length === 0}>
                สร้างแผนที่เป็นไปได้
                <IconArrow />
              </button>
            </div>
          </div>

          <div className="bench-grid">
            <div className="bench" data-tour="planner-pool">
              <div className="bench-head">
                <h3>วิชาในตัวช่วยจัดแผน</h3>
                {plannerPool.length > 0 && (
                  <button type="button" className="btn btn-quiet" onClick={clearPlanner}>
                    ล้างทั้งหมด
                  </button>
                )}
              </div>
              <div className="planner-file">
                <input ref={plannerFileInputRef} className="file-input" type="file" accept=".json,application/json" onChange={importPlannerFile} aria-label="นำเข้าไฟล์ตัวช่วยจัดแผน" />
                <button type="button" className="btn btn-line" onClick={exportPlannerFile} disabled={plannerPool.length === 0}>
                  บันทึกเป็นไฟล์
                </button>
                <button type="button" className="btn btn-line" onClick={() => plannerFileInputRef.current?.click()}>
                  นำเข้าไฟล์
                </button>
              </div>
              {plannerFileStatus && (
                <p className={plannerFileStatus.tone === "error" ? "status-line is-clash" : "status-line"} role="status">{plannerFileStatus.text}</p>
              )}
              {plannerPool.length === 0 ? (
                <p className="empty">ยังไม่มีวิชาในตัวช่วย ดึงรายวิชาจากเว็บแล้วกด “เลือกเข้าตัวช่วยจัดแผน” ทีละวิชา หรือ “เพิ่มทั้งหมดเข้าตัวช่วย”</p>
              ) : (
                <>
                <p className="status-line pick-count">เก็บไว้ {plannerPool.length}/{maxPlannerPool} วิชา · ติ๊กใช้สร้างแผน {countPlannerSlots(plannerSelectedCodes, plannerGroups)}/7</p>
                <div className="pick-list">
                  {plannerPool.filter((group) => !groupOfCode(plannerGroups, group.code)).map((group) => renderPickRow(group))}
                  {plannerGroups.map((courseGroup) => {
                    const members = courseGroup.codes
                      .map((code) => plannerPool.find((group) => group.code === code))
                      .filter((group): group is RemoteCourseGroup => Boolean(group));
                    const isTicked = courseGroup.codes.some((code) => plannerSelectedCodes.includes(code));

                    return (
                      <section className="pick-group" key={courseGroup.id} aria-label={`กลุ่ม ${courseGroup.name}`}>
                        <div className="pick-group-head">
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={isTicked}
                              disabled={members.length === 0}
                              onChange={() => togglePlannerGroup(courseGroup.id)}
                              aria-label={`ใช้กลุ่ม ${courseGroup.name} สร้างแผน`}
                            />
                            <span className="check-box" aria-hidden="true" />
                          </label>
                          <GroupNameInput key={courseGroup.name} name={courseGroup.name} onCommit={(name) => renamePlannerGroup(courseGroup.id, name)} />
                          <span className="pick-group-badge">เลือก 1 วิชา</span>
                          <button type="button" className="link-btn pick-group-delete" onClick={() => deletePlannerGroup(courseGroup.id)}>
                            ลบกลุ่ม
                          </button>
                        </div>
                        {members.length === 0 ? (
                          <p className="pick-group-empty">ย้ายวิชาเข้ากลุ่มนี้ด้วยปุ่ม “ย้ายเข้ากลุ่ม”</p>
                        ) : (
                          members.map((member) => renderPickRow(member, courseGroup))
                        )}
                      </section>
                    );
                  })}
                </div>
                <button type="button" className="btn btn-line pick-group-new" onClick={() => createPlannerGroup()}>
                  + สร้างกลุ่ม
                </button>
                </>
              )}
            </div>

            <div className="bench">
              <h3>เงื่อนไขเวลา</h3>
              <div className="field-pair">
                <label className="field">
                  <span>ไม่ก่อน</span>
                  <input type="time" value={plannerStart} onChange={(event) => setPlannerStart(event.target.value)} />
                </label>
                <label className="field">
                  <span>ไม่หลัง</span>
                  <input type="time" value={plannerEnd} onChange={(event) => setPlannerEnd(event.target.value)} />
                </label>
              </div>
              <p className="bench-label">เลี่ยงวัน</p>
              <div className="day-chips">
                {days.map((day) => (
                  <label className="day-chip" key={day.key}>
                    <input
                      type="checkbox"
                      checked={plannerAvoidDays.includes(day.key)}
                      onChange={() => toggleAvoidDay(day.key)}
                    />
                    <span>{day.short}</span>
                  </label>
                ))}
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={plannerLunchBreak}
                  onChange={(event) => setPlannerLunchBreak(event.target.checked)}
                />
                <span className="check-box" aria-hidden="true" />
                <span className="check-text">ต้องมีพักเที่ยง 12:00-13:00</span>
              </label>
            </div>

            <div className="bench">
              <h3>แผนแนะนำ</h3>
              {plannerStatus && <p className="status-line">{plannerStatus}</p>}
              {generatedPlans.length === 0 ? (
                <p className="empty">ยังไม่มีแผนที่สร้าง</p>
              ) : (
                <div className="plan-results">
                  {generatedPlans.map((plan, planIndex) => (
                    <article className="plan-result" key={plan.id}>
                      <div className="plan-score">
                        <b>{plan.score}</b>
                        <i>/100</i>
                      </div>
                      <div className="plan-body">
                        <strong>{plan.name}</strong>
                        <span><b>{plan.courses.length}</b> รายการ</span>
                        {plan.groupNotes.length > 0 && (
                          <span className="plan-group-notes">
                            {plan.groupNotes.map((note) => (
                              <span key={note.groupId} className={note.skipped ? "plan-group-note is-skipped" : "plan-group-note"}>{note.text}</span>
                            ))}
                          </span>
                        )}
                        <small>{plan.reasons.filter((reason) => !reason.startsWith("ข้ามกลุ่ม ")).join(" · ")}</small>
                      </div>
                      <button type="button" className="btn btn-line" data-tour={planIndex === 0 ? "apply-plan" : undefined} onClick={() => applyGeneratedPlan(plan)}>ใช้แผนนี้</button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="zone" id="compare" aria-labelledby="compare-title" data-folded={foldedZones.includes("compare") ? "true" : undefined}>
          <div className="zone-head">
            <button type="button" className="zone-fold" aria-expanded={!foldedZones.includes("compare")} aria-label={foldedZones.includes("compare") ? "เปิดส่วนนี้" : "ย่อส่วนนี้"} onClick={() => toggleZoneFold("compare")}><IconChevron /></button>
            <div className="zone-title"><h2 id="compare-title">เปรียบเทียบ 2 แผน</h2><HelpButton zone="compare" onStartTour={onboarding.startTour} /></div>
            <p>ดูคะแนนพื้นฐาน วันเรียน หน่วยกิต เวลาว่าง และรายวิชาที่ต่างกัน</p>
          </div>

          <div className="compare-bar" data-tour="compare-pickers">
            <label className="field field-select">
              <span>แผน A</span>
              <select value={comparePlanA?.id ?? ""} onChange={(event) => { setComparePlanAId(event.target.value); if (event.target.value !== comparePlanB?.id) completeMission("compare"); }}>
                {visiblePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </label>
            <label className="field field-select">
              <span>แผน B</span>
              <select value={comparePlanB?.id ?? ""} onChange={(event) => { setComparePlanBId(event.target.value); if (event.target.value !== comparePlanA?.id) completeMission("compare"); }}>
                {visiblePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </label>
            <div className="strip-actions">
              <button type="button" className="btn btn-line" onClick={() => comparePlanA && setActivePlanId(comparePlanA.id)} disabled={!comparePlanA}>ใช้แผน A</button>
              <button type="button" className="btn btn-line" onClick={() => comparePlanB && setActivePlanId(comparePlanB.id)} disabled={!comparePlanB}>ใช้แผน B</button>
            </div>
          </div>

          {comparison && (
            <table className="compare-table">
              <caption className="sr-only">ตารางเปรียบเทียบแผน A และแผน B</caption>
              <thead>
                <tr>
                  <th scope="col">ค่าที่วัด</th>
                  <th scope="col">แผน A</th>
                  <th scope="col">แผน B</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["หน่วยกิต", comparison.aStats.credits, comparison.bStats.credits, "นก."],
                  ["วันเรียน", comparison.aStats.usedDays, comparison.bStats.usedDays, "วัน"],
                  ["เวลาว่าง", comparison.aStats.freeHours, comparison.bStats.freeHours, "ชม."],
                  ["เวลาชน", comparison.aStats.conflicts, comparison.bStats.conflicts, "คู่"],
                ] as [string, number, number, string][]).map(([label, aValue, bValue, unit]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td className={label === "เวลาชน" && aValue > 0 ? "is-clash" : undefined}>{aValue}<i>{unit}</i></td>
                    <td className={label === "เวลาชน" && bValue > 0 ? "is-clash" : undefined}>{bValue}<i>{unit}</i></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {comparison && (
            <div className="diff-grid">
              <div className="bench">
                <h3>มีเฉพาะแผน A</h3>
                {comparison.onlyA.length === 0 ? <p className="empty">ไม่ต่างจากแผน B</p> : comparison.onlyA.map((course) => <CourseDifference key={course.id} course={course} />)}
              </div>
              <div className="bench">
                <h3>มีเฉพาะแผน B</h3>
                {comparison.onlyB.length === 0 ? <p className="empty">ไม่ต่างจากแผน A</p> : comparison.onlyB.map((course) => <CourseDifference key={course.id} course={course} />)}
              </div>
            </div>
          )}
        </section>

        <div className="zone-pair">
          <section className="zone" id="voids" aria-labelledby="voids-title" data-folded={foldedZones.includes("voids") ? "true" : undefined}>
            <div className="zone-head">
            <button type="button" className="zone-fold" aria-expanded={!foldedZones.includes("voids")} aria-label={foldedZones.includes("voids") ? "เปิดส่วนนี้" : "ย่อส่วนนี้"} onClick={() => toggleZoneFold("voids")}><IconChevron /></button>
              <div className="zone-title"><h2 id="voids-title">เวลาว่าง</h2><HelpButton zone="voids" onStartTour={onboarding.startTour} /></div>
              <p>ช่วงเวลาที่ไม่มีเรียนในแต่ละวัน</p>
            </div>
            {freeSlots.length === 0 ? (
              <p className="empty">ยังไม่มีข้อมูลเวลาว่างจากตารางปัจจุบัน</p>
            ) : (
              <ul className="free-list">
                {freeSlots.map((slot) => (
                  <li className="free-item" key={`${slot.day}-${slot.start}-${slot.end}`}>
                    <span className="free-day">{slot.label}</span>
                    <span className="free-span">{slot.start}–{slot.end}</span>
                    <span className="free-len">{Math.round(slot.minutes / 60 * 10) / 10}<i>ชม.</i></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="zone" id="exams" aria-labelledby="exams-title" data-folded={foldedZones.includes("exams") ? "true" : undefined}>
            <div className="zone-head">
            <button type="button" className="zone-fold" aria-expanded={!foldedZones.includes("exams")} aria-label={foldedZones.includes("exams") ? "เปิดส่วนนี้" : "ย่อส่วนนี้"} onClick={() => toggleZoneFold("exams")}><IconChevron /></button>
              <div className="zone-title"><h2 id="exams-title">ตารางสอบ</h2><HelpButton zone="exams" onStartTour={onboarding.startTour} /></div>
              <p>วันสอบกลางภาคและปลายภาคของทุกวิชาในตารางนี้</p>
            </div>
            {examWarnings.length > 0 && (
              <ul className="exam-warn-list">
                {examWarnings.map((warning) => (
                  <li key={warning}>
                    <IconStorm />
                    {warning}
                  </li>
                ))}
              </ul>
            )}
            {uniqueCourseGroups(shownCourses).filter((course) => course.midterm || course.final).length === 0 ? (
              <p className="empty">ยังไม่ได้กรอกเวลาสอบ</p>
            ) : (
              <ul className="exam-list">
                {uniqueCourseGroups(shownCourses).filter((course) => course.midterm || course.final).map((course) => (
                  <li className="exam-item" key={course.id} style={{ ["--course" as string]: course.color }}>
                    <span className="exam-code">{course.code}</span>
                    <span className="exam-name">{course.name}</span>
                    <span className="exam-when">
                      <i>กลางภาค</i>
                      {course.midterm ? examText(course.midterm) : "-"}
                    </span>
                    <span className="exam-when">
                      <i>ปลายภาค</i>
                      {course.final ? examText(course.final) : "-"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="zone" id="room" aria-labelledby="room-title" data-folded={foldedZones.includes("room") ? "true" : undefined}>
          <div className="zone-head">
            <button type="button" className="zone-fold" aria-expanded={!foldedZones.includes("room")} aria-label={foldedZones.includes("room") ? "เปิดส่วนนี้" : "ย่อส่วนนี้"} onClick={() => toggleZoneFold("room")}><IconChevron /></button>
            <div className="zone-title"><h2 id="room-title">ห้องตารางร่วมกัน</h2><HelpButton zone="room" onStartTour={onboarding.startTour} /></div>
            <p>ส่งรหัสห้องให้เพื่อน แล้วแก้ตารางเดียวกันจากคนละเครื่อง</p>
          </div>

          <div className="room-grid">
            <div className={shareSession ? "room-code is-live" : "room-code"}>
              <span className="room-code-label">{shareSession ? "รหัสห้องปัจจุบัน" : "ยังไม่ได้เข้าห้อง"}</span>
              {shareSession ? (
                <strong className="room-code-value">{shareSession.shareId}</strong>
              ) : (
                <span className="room-code-slots" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, index) => (
                    <i key={index}>–</i>
                  ))}
                </span>
              )}
              <p>{shareSession ? "ส่งรหัสนี้ให้เพื่อนเพื่อเข้ามาแก้ตารางเดียวกัน" : "สร้างห้องใหม่จะได้ตารางว่างสำหรับเริ่มจัดร่วมกัน"}</p>
              <p className="room-note">ห้องจะถูกลบหากไม่มีการอัปเดตเกิน 30 วัน</p>
              {shareSession && (
                <p className="room-note">
                  อัปเดตอัตโนมัติทุก 2 วินาที{shareSession.lastServerUpdatedAt ? ` · ล่าสุด ${new Date(shareSession.lastServerUpdatedAt).toLocaleTimeString("th-TH")}` : ""}
                </p>
              )}
            </div>

            <div className="bench">
              <h3>เข้าห้อง</h3>
              <button type="button" className="btn btn-primary room-create" data-tour="room-create" onClick={createSharedRoom}>
                สร้างห้องว่าง
                <IconArrow />
              </button>
              <p className="bench-note">สร้างรหัสใหม่และพาไปตารางห้องเปล่า ไม่ดึงวิชาจากตารางนี้</p>
              <form className="room-join" data-tour="room-join" onSubmit={enterSharedRoom}>
                <label className="field">
                  <span>รหัสห้อง</span>
                  <input
                    value={roomCodeInput}
                    onChange={(event) => setRoomCodeInput(normalizeRoomCode(event.target.value))}
                    placeholder="เช่น A7K2QD"
                    maxLength={64}
                  />
                </label>
                <button type="submit" className="btn btn-line">เข้าห้อง</button>
              </form>
            </div>

            <div className="bench">
              <h3>จัดการห้อง</h3>
              <div className="room-actions">
                <button type="button" className="btn btn-line" data-tour="room-code" onClick={copyRoomCode} disabled={!shareSession}>
                  <IconCopy />
                  คัดลอกรหัสห้อง
                </button>
                <button type="button" className="btn btn-line" onClick={() => shareSession && loadSharedPlan(shareSession.shareId, true, shareSession.editToken)} disabled={!shareSession}>โหลดล่าสุด</button>
                <button type="button" className="btn btn-line btn-destructive" data-tour="room-leave" onClick={() => leaveSharedMode()} disabled={!shareSession}>ออกจากห้อง</button>
              </div>
              {shareStatus && <p className="status-line">{shareStatus}</p>}
            </div>
          </div>

          {shareSession?.status === "conflict" && (
            <div className="room-conflict">
              <p>
                <IconNote />
                <b>ห้องมีข้อมูลใหม่กว่า</b>
                โหลดข้อมูลล่าสุดก่อนบันทึกต่อ หรือเก็บงานที่แก้ไว้เป็นตารางส่วนตัว
              </p>
              <div className="strip-actions">
                <button type="button" className="btn btn-primary" onClick={() => shareSession && loadSharedPlan(shareSession.shareId, true, shareSession.editToken)} disabled={!shareSession}>โหลดล่าสุด</button>
                <button type="button" className="btn btn-line" onClick={copyActivePlanToLocal}>เก็บเป็นตารางส่วนตัว</button>
              </div>
            </div>
          )}
        </section>

        <section className="zone" id="feedback" aria-labelledby="feedback-title" data-folded={foldedZones.includes("feedback") ? "true" : undefined}>
          <div className="zone-head">
            <button type="button" className="zone-fold" aria-expanded={!foldedZones.includes("feedback")} aria-label={foldedZones.includes("feedback") ? "เปิดส่วนนี้" : "ย่อส่วนนี้"} onClick={() => toggleZoneFold("feedback")}><IconChevron /></button>
            <div className="zone-title"><h2 id="feedback-title">ข้อเสนอแนะ</h2><HelpButton zone="feedback" onStartTour={onboarding.startTour} /></div>
            <p>เจอปัญหาหรืออยากให้เพิ่มอะไร บอกเราได้สั้น ๆ ไม่ต้องระบุตัวตน</p>
          </div>

          <form className="feedback-form" onSubmit={submitFeedback}>
            <label className="field">
              <span>ข้อความ</span>
              <textarea
                value={feedbackText}
                onChange={(event) => {
                  setFeedbackText(Array.from(event.target.value).slice(0, maxFeedbackLength).join(""));
                  setFeedbackStatus(null);
                }}
                placeholder="เช่น อยากให้ export เป็น Google Calendar ได้"
                rows={3}
                aria-describedby="feedback-count"
              />
            </label>
            <div className="feedback-foot">
              <span
                id="feedback-count"
                className={countChars(feedbackText) >= maxFeedbackLength ? "feedback-count is-full" : "feedback-count"}
                aria-live="polite"
              >
                {countChars(feedbackText)}/{maxFeedbackLength}
              </span>
              <button type="submit" className="btn btn-primary" disabled={isSendingFeedback || !feedbackText.trim()}>
                {isSendingFeedback ? "กำลังส่ง…" : "ส่งข้อเสนอแนะ"}
              </button>
            </div>
            {feedbackStatus && (
              <p className={feedbackStatus.tone === "error" ? "status-line is-clash" : "status-line"} role="status">{feedbackStatus.text}</p>
            )}
          </form>
        </section>

        <footer className="site-note">
          <h2>หมายเหตุการใช้งาน</h2>
          <ul>
            <li>เว็บนี้ทำขึ้นเพื่อช่วยอำนวยความสะดวกสำหรับวางแผนการลงทะเบียนการศึกษาเท่านั้น ไม่ได้เป็นระบบของมหาวิทยาลัย</li>
            <li>
              ข้อมูลรายวิชานำมาจากเว็บ <a href="https://reg.kmutnb.ac.th/" target="_blank" rel="noreferrer">reg.kmutnb.ac.th</a>
              {" "}หากข้อมูลผิดพลาดหรือไม่ตรงกัน ให้ตรวจสอบข้อมูลล่าสุดจากเว็บ
            </li>
          </ul>
        </footer>
      </main>

      {isManualCourseOpen && (
        <div
          className="scrim"
          role="presentation"
          {...scrimCloseProps(() => {
            setIsManualCourseOpen(false);
            setEditingId(null);
            setForm(emptyCourse);
          })}
        >
          <form
            className="dialog dialog-form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-course-title"
            onSubmit={submitCourse}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="manual-course-title">{editingId ? "แก้ไขรายวิชา" : "เพิ่มรายวิชาด้วยตนเอง"}</h2>
              <button
                type="button"
                className="btn btn-icon"
                aria-label="ปิด"
                onClick={() => {
                  setIsManualCourseOpen(false);
                  setEditingId(null);
                  setForm(emptyCourse);
                }}
              >
                <IconClose />
              </button>
            </div>

            <div className="dialog-body">
              <label className="field">
                <span>ชื่อวิชา</span>
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="เช่น การเขียนโปรแกรมเว็บ" />
              </label>

              <div className="field-pair">
                <label className="field">
                  <span>รหัสวิชา</span>
                  <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="CS101" />
                </label>
                <label className="field">
                  <span>หน่วยกิต</span>
                  <input required min="1" max="9" type="number" value={form.credits} onChange={(event) => setForm({ ...form, credits: Number(event.target.value) })} />
                </label>
              </div>

              <div className="field-trio">
                <label className="field field-select">
                  <span>วันเรียน</span>
                  <select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value as DayKey })}>
                    {days.map((day) => (
                      <option key={day.key} value={day.key}>{day.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>เริ่ม</span>
                  <input required type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} />
                </label>
                <label className="field">
                  <span>สิ้นสุด</span>
                  <input required type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} />
                </label>
              </div>

              <div className="field-pair">
                <label className="field">
                  <span>ห้องเรียน</span>
                  <input required value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="อาคาร 5 ห้อง 301" />
                </label>
                <label className="field">
                  <span>อาจารย์</span>
                  <input required value={form.teacher} onChange={(event) => setForm({ ...form, teacher: event.target.value })} placeholder="อ. สมชาย" />
                </label>
              </div>

              <div className="field-pair">
                <label className="field">
                  <span>สอบกลางภาค</span>
                  <input type="datetime-local" value={form.midterm} onChange={(event) => setForm({ ...form, midterm: event.target.value })} />
                </label>
                <label className="field">
                  <span>สอบปลายภาค</span>
                  <input type="datetime-local" value={form.final} onChange={(event) => setForm({ ...form, final: event.target.value })} />
                </label>
              </div>
              <p className="field-hint">ช่องวันสอบใช้ตัวเลือกวันที่ของเบราว์เซอร์ ลำดับวัน/เดือน/ปีจึงเป็นไปตามภาษาของเครื่อง เว้นว่างได้ถ้ายังไม่ประกาศตารางสอบ</p>
            </div>

            <div className="dialog-foot">
              <button className="btn btn-primary" type="submit">
                {editingId ? "บันทึกการแก้ไข" : "เพิ่มลงตาราง"}
                <IconArrow />
              </button>
            </div>
          </form>
        </div>
      )}

      {icsDialog && (
        <div className="scrim" role="presentation" {...scrimCloseProps(() => setIcsDialog(null))}>
          <form
            className="dialog dialog-form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ics-title"
            onSubmit={(event) => {
              event.preventDefault();
              downloadIcs();
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="ics-title">ส่งออกเป็นปฏิทิน (.ics)</h2>
              <button type="button" className="btn btn-icon" aria-label="ปิด" onClick={() => setIcsDialog(null)}>
                <IconClose />
              </button>
            </div>

            <div className="dialog-body">
              <p className="field-hint">
                ใช้กับ Google Calendar, Apple Calendar หรือ Outlook ได้ ใน Google Calendar ไปที่ ตั้งค่า → นำเข้าและส่งออก แล้วเลือกไฟล์นี้ แนะนำให้สร้างปฏิทินแยกไว้สำหรับตารางเรียน ถ้าแก้ตารางแล้วส่งออกใหม่ ให้ลบปฏิทินนั้นแล้วสร้างใหม่ก่อนนำเข้า เพราะการนำเข้าซ้ำจะไม่อัปเดตนัดเดิม
              </p>
              <div className="field-pair">
                <label className="field">
                  <span>วันเริ่มเรียน</span>
                  <input required type="date" value={icsDialog.firstDay} onChange={(event) => setIcsDialog({ ...icsDialog, firstDay: event.target.value, error: "" })} />
                </label>
                <label className="field">
                  <span>วันเรียนวันสุดท้าย</span>
                  <input required type="date" value={icsDialog.lastDay} onChange={(event) => setIcsDialog({ ...icsDialog, lastDay: event.target.value, error: "" })} />
                </label>
              </div>
              {icsDialog.error && <p className="status-line is-clash" role="alert">{icsDialog.error}</p>}
            </div>

            <div className="dialog-foot">
              <button className="btn btn-primary" type="submit">
                ดาวน์โหลดไฟล์
                <IconArrow />
              </button>
            </div>
          </form>
        </div>
      )}

      {isCourseBrowserOpen && (
        <div className="scrim" role="presentation" {...scrimCloseProps(() => setIsCourseBrowserOpen(false))}>
          <section
            className="dialog dialog-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-browser-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-head">
              <div>
                <h2 id="course-browser-title">ข้อมูลรายวิชา KMUTNB</h2>
                <p>เลือกตัวกรองแล้วกดโหลด ระบบจะดึงข้อมูลจาก regapi ตามค่าที่กำหนด</p>
              </div>
              <button type="button" className="btn btn-icon" data-tour="browser-close" aria-label="ปิด" onClick={() => setIsCourseBrowserOpen(false)}>
                <IconClose />
              </button>
            </div>

            <div className="dialog-body">
              <div className="filter-grid" data-tour="course-search">
                <label className="field">
                  <span>ปีการศึกษา</span>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={academicYear}
                    onChange={(event) => setAcademicYear(event.target.value.replace(/\D/g, ""))}
                    placeholder="2569"
                  />
                </label>
                <label className="field field-select">
                  <span>ภาคเรียน</span>
                  <select value={semester} onChange={(event) => setSemester(event.target.value)}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </label>
                <label className="field field-select">
                  <span>วิทยาเขต</span>
                  <select value={campusId} onChange={(event) => setCampusId(event.target.value)}>
                    {filterOptions.campuses.map((option) => (
                      <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                    ))}
                  </select>
                </label>
                <label className="field field-select">
                  <span>ประเภทนักศึกษา</span>
                  <select value={divisionCode} onChange={(event) => setDivisionCode(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {filterOptions.divisions.map((option) => (
                      <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                    ))}
                  </select>
                </label>
                <label className="field field-select">
                  <span>ระดับการศึกษา</span>
                  <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
                    {filterOptions.levels.map((option) => (
                      <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                    ))}
                  </select>
                </label>
                <label className="field field-select">
                  <span>คณะ</span>
                  <select value={facultyId} onChange={(event) => setFacultyId(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {filterOptions.faculties.map((option) => (
                      <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                    ))}
                  </select>
                </label>
                <label className="field field-select">
                  <span>ภาควิชา</span>
                  <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} disabled={!facultyId}>
                    <option value="">ทั้งหมด</option>
                    {departmentOptions.map((option) => (
                      <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                    ))}
                  </select>
                </label>
                <label className="field field-select">
                  <span>กลุ่มเรียน</span>
                  <select value={classSet} onChange={(event) => setClassSet(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {filterOptions.classSets.map((option) => (
                      <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>รหัสวิชา</span>
                  <input
                    value={courseSearch}
                    onChange={(event) => setCourseSearch(event.target.value)}
                    placeholder="เช่น 040613100"
                  />
                </label>
              </div>

              <div className="dialog-run" data-tour="course-search">
                <button className="btn btn-primary" type="button" onClick={() => loadRemoteClasses()} disabled={isLoadingClasses}>
                  {isLoadingClasses ? "กำลังค้นหา..." : "ค้นหารายวิชา"}
                  <IconArrow />
                </button>
                {filteredRemoteClasses.length > 0 && (
                  <button className="btn btn-line" type="button" onClick={addAllToPlanner}>
                    เพิ่มทั้งหมดเข้าตัวช่วย
                  </button>
                )}
                <div ref={remoteResultsRef} className="dialog-run-status">
                  {remoteClasses.length > 0 && (
                    <p className="status-line">
                      แสดง {filteredRemoteClasses.length} จาก {remoteClasses.length} รายการ
                      {hiddenExcludedCount > 0 && ` · ซ่อนวิชาที่ไม่เอา ${hiddenExcludedCount} รายการ`}
                      {` · ตัวช่วยเก็บไว้ ${plannerPool.length}/${maxPlannerPool} วิชา`}
                    </p>
                  )}
                  {plannerPoolNotice && <p className="status-line">{plannerPoolNotice}</p>}
                </div>
              </div>

              {excludedCourses.length > 0 && (
                <ExcludedCourseBar courses={excludedCourses} onRemove={unexcludeCourse} />
              )}

              {filterError && <p className="status-line is-clash">{filterError}</p>}
              {classError && <p className="status-line is-clash">{classError}</p>}
              {hasLoadedClasses && !classError && remoteClasses.length === 0 && (
                <p className="empty">ไม่พบรายวิชาตามเงื่อนไขที่เลือก ลองปรับคณะ ภาควิชา หรือรหัสวิชาแล้วโหลดอีกครั้ง</p>
              )}
              {remoteClasses.length > 0 && filteredRemoteClasses.length === 0 && (
                <p className="empty">
                  {hiddenExcludedCount > 0
                    ? "รายวิชาที่ตรงเงื่อนไขอยู่ในรายการ “ไม่เอาแน่นอน” ทั้งหมด กดกากบาทที่ชิปด้านบนเพื่อนำกลับมา"
                    : `ไม่พบรายวิชาที่ตรงกับรหัสวิชา “${courseSearch}”`}
                </p>
              )}

              {filteredRemoteClasses.length > 0 && (
                <ul className="remote-list">
                  {filteredRemoteClasses.map((remoteClass, remoteIndex) => {
                    const parsedTime = parseClassTime(remoteClass.classtime);
                    const dayLabel = days.find((day) => day.key === parsedTime.day)?.label ?? "";
                    const isPicked = plannerPool.some((group) => group.code === remoteClass.coursecode);

                    return (
                      <li className="remote-card" key={remoteClass.classid}>
                        <div className="remote-head">
                          <span className="remote-code">{remoteClass.coursecode}</span>
                          <span className="remote-section">S.{remoteClass.sectioncode}</span>
                        </div>
                        <p className="remote-name">{remoteClass.coursename}</p>
                        <dl className="course-meta">
                          <div>
                            <dt>เวลา</dt>
                            <dd>{dayLabel} {parsedTime.start}-{parsedTime.end}</dd>
                          </div>
                          <div>
                            <dt>ห้อง</dt>
                            <dd>{parsedTime.room || "-"}</dd>
                          </div>
                          <div>
                            <dt>อาจารย์</dt>
                            <dd>{teacherName(remoteClass) || "-"}</dd>
                          </div>
                          <div>
                            <dt>หน่วยกิต</dt>
                            <dd>{remoteClass.courseunit}</dd>
                          </div>
                        </dl>
                        <div className="remote-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => importRemoteClass(remoteClass)}
                            disabled={!canEditActivePlan}
                          >
                            นำเข้าลงตาราง
                          </button>
                          <button
                            type="button"
                            className={isPicked ? "btn btn-line is-on" : "btn btn-line"}
                            data-tour={remoteIndex === firstUnpickedRemoteIndex ? "add-to-planner" : undefined}
                            onClick={() => togglePlannerCode(remoteClass.coursecode)}
                            disabled={!isPicked && plannerPool.length >= maxPlannerPool}
                          >
                            {isPicked ? "เอาออกจากตัวช่วยจัดแผน" : plannerPool.length >= maxPlannerPool ? `ตัวช่วยเต็ม ${maxPlannerPool} วิชา` : "เลือกเข้าตัวช่วยจัดแผน"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-destructive remote-exclude"
                            onClick={() => excludeCourse(remoteClass.coursecode, remoteClass.coursename)}
                            title="ซ่อนวิชานี้ทุกกลุ่มเรียน และจำไว้จนกว่าจะยกเลิก"
                          >
                            ไม่เอาวิชานี้
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      <MissionPanel
        progress={onboarding.progress}
        open={onboarding.panelOpen}
        onOpenChange={onboarding.setPanelOpen}
        onStart={onboarding.startTour}
        notice={onboarding.notice}
      />
      {onboarding.tour && onboarding.stepIndex >= 0 && (
        <TourOverlay
          tour={onboarding.tour}
          stepIndex={onboarding.stepIndex}
          onAck={onboarding.ackStep}
          onSkip={onboarding.skipTour}
          onStartTour={onboarding.startTour}
          hint={onboarding.hint}
        />
      )}
    </div>
  );
}


// แถบวิชาที่ไม่เอา ยุบเหลือแถวเดียวเมื่อยาวเกิน แล้วกดขยายดูทั้งหมดได้
function ExcludedCourseBar({ courses, onRemove }: { courses: ExcludedCourse[]; onRemove: (code: string) => void }) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);

  useEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    // นับชิปที่ล้นแถวแรก ใช้ตัดสินว่าต้องมีปุ่มขยายไหม
    const measure = () => {
      const chips = Array.from(list.children) as HTMLElement[];
      const firstTop = chips[0]?.offsetTop ?? 0;
      setHiddenCount(chips.filter((chip) => chip.offsetTop > firstTop + 4).length);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [courses]);

  const canToggle = hiddenCount > 0;

  return (
    <div className="excluded-bar">
      <span className="excluded-label">ไม่เอาแน่นอน {courses.length} วิชา</span>
      <ul ref={listRef} className={isExpanded ? "excluded-chips is-expanded" : "excluded-chips"}>
        {courses.map((course) => (
          <li className="excluded-chip" key={course.code} title={course.name}>
            <span className="excluded-chip-code">{course.code}</span>
            <span className="excluded-chip-name">{course.name}</span>
            <button
              type="button"
              className="excluded-chip-remove"
              onClick={() => onRemove(course.code)}
              aria-label={`ยกเลิกไม่เอาวิชา ${course.code}`}
            >
              <IconClose />
            </button>
          </li>
        ))}
      </ul>
      {(canToggle || isExpanded) && (
        <button type="button" className="excluded-toggle" onClick={() => setIsExpanded((current) => !current)} aria-expanded={isExpanded}>
          {isExpanded ? "ย่อ" : `+${hiddenCount} ดูทั้งหมด`}
        </button>
      )}
    </div>
  );
}

type CourseBlockActions = {
  onHide: (id: string) => void;
  onRemove: (id: string) => void;
};

function CourseBlockButtons({ course, actions }: { course: Course; actions?: CourseBlockActions }) {
  if (!actions) {
    return null;
  }

  return (
    <span className="block-actions">
      <button
        type="button"
        onClick={() => actions.onHide(course.id)}
        aria-label={`${course.hidden ? "แสดง" : "ซ่อน"} ${course.code} ${course.name}`}
        title={course.hidden ? "แสดงกลับในตาราง" : "ซ่อน (เป็นสีเทา ไม่นับเวลาชน)"}
      >
        {course.hidden ? <IconEye /> : <IconEyeOff />}
      </button>
      <button type="button" className="is-destructive" onClick={() => actions.onRemove(course.id)} aria-label={`ลบ ${course.code} ${course.name}`} title="ลบออกจากตาราง">
        <IconClose />
      </button>
    </span>
  );
}

function DayRow({ day, courses, conflictIds, actions }: { day: (typeof days)[number]; courses: Course[]; conflictIds: Set<string>; actions?: CourseBlockActions }) {
  const dayStart = hours[0] * 60;
  const dayEnd = (hours[hours.length - 1] + 1) * 60;
  const dayMinutes = dayEnd - dayStart;
  const laneHeight = 130;
  const laneGap = 5;
  const { placed, laneCount } = packDayLanes(courses, day.key, dayStart, dayEnd);
  const positionedCourses = placed.map(({ course, lane, start, finish }) => ({
    course,
    lane,
    left: ((start - dayStart) / dayMinutes) * 100,
    width: ((finish - start) / dayMinutes) * 100,
  }));
  const rowHeight = positionedCourses.length === 0 ? 68 : 12 + laneCount * laneHeight + (laneCount - 1) * laneGap;

  return (
    <>
      <div className="day-label">
        <b>{day.short}</b>
        <span>{day.label}</span>
      </div>
      <div className="day-timeline" style={{ minHeight: rowHeight }}>
        <div className="timeline-slots" aria-hidden="true">
          {hours.map((hour) => (
            <div className="slot" key={`${day.key}-${hour}`} />
          ))}
        </div>
        {positionedCourses.map(({ course, lane, left, width }) => (
          <article
            className={["block", conflictIds.has(course.id) ? "is-clash" : "", course.hidden ? "is-hidden" : ""].filter(Boolean).join(" ")}
            key={course.id}
            style={{
              ["--course" as string]: course.color,
              left: `${left}%`,
              top: 6 + lane * (laneHeight + laneGap),
              width: `${width}%`,
            }}
          >
            <span className="block-code">
              {course.code}
              {course.locked && <IconAnchor className="ico-sm" />}
              {conflictIds.has(course.id) && <em className="block-clash">ชนกัน</em>}
              {course.hidden && <em className="block-hidden">ซ่อน</em>}
            </span>
            <span className="block-name">{course.name}</span>
            <span className="block-time">
              <time>{course.start}–{course.end}</time>
            </span>
            {course.room && <span className="block-room">{course.room}</span>}
            <CourseBlockButtons course={course} actions={actions} />
          </article>
        ))}
      </div>
    </>
  );
}

function CourseDifference({ course }: { course: Course }) {
  return (
    <div className="diff-block" style={{ ["--course" as string]: course.color }}>
      <span className="diff-code">{course.code}</span>
      <span className="diff-name">{course.name}</span>
      <span className="diff-when">
        <b>{days.find((day) => day.key === course.day)?.label}</b>
        <time>{course.start}–{course.end}</time>
      </span>
    </div>
  );
}

function DayList({ day, conflictIds, actions }: { day: (typeof days)[number] & { courses: Course[] }; conflictIds: Set<string>; actions?: CourseBlockActions }) {
  return (
    <section className="day-agenda">
      <h3>
        <b>{day.short}</b>
        {day.label}
      </h3>
      {day.courses.length === 0 ? (
        <p className="day-free">ไม่มีเรียน · ว่างทั้งวัน</p>
      ) : (
        <div className="day-agenda-body">
          {day.courses.map((course, index) => {
            // ช่วงว่างคิดจากวิชาที่แสดงอยู่เท่านั้น วิชาที่ซ่อนไม่นับว่าเป็นเวลาเรียน
            const nextCourse = course.hidden ? undefined : day.courses.slice(index + 1).find((next) => !next.hidden);
            const gapMinutes = nextCourse ? toMinutes(nextCourse.start) - toMinutes(course.end) : 0;

            return (
              <div key={course.id}>
                <article
                  className={["agenda-item", conflictIds.has(course.id) ? "is-clash" : "", course.hidden ? "is-hidden" : ""].filter(Boolean).join(" ")}
                  style={{ ["--course" as string]: course.color }}
                >
                  <span className="agenda-time">{course.start}<i>{course.end}</i></span>
                  <span className="agenda-body">
                    <b>{course.code}</b>
                    <span>{course.name}</span>
                    <small>{course.room || "-"} · {course.teacher || "-"} · {course.credits} หน่วยกิต{course.locked ? " · ล็อกไว้" : ""}{course.hidden ? " · ซ่อนอยู่" : ""}</small>
                  </span>
                  <CourseBlockButtons course={course} actions={actions} />
                </article>
                {nextCourse && gapMinutes > 0 && (
                  <p className="agenda-gap">
                    ว่าง <time>{minutesToTime(toMinutes(course.end))}–{minutesToTime(toMinutes(nextCourse.start))}</time> · <time>{Math.round((gapMinutes / 60) * 10) / 10}</time> ชม.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
