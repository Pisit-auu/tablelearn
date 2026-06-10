"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSharedPlanAction, saveSharedPlanAction } from "./actions/shared-plans";

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
};

type TimetablePlan = {
  id: string;
  name: string;
  courses: Course[];
  source?: "local" | "shared";
  sharedId?: string;
  canEdit?: boolean;
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

const palette = ["#2457ff", "#008c7a", "#d36b00", "#d8345f", "#7357ff", "#25935f", "#b84a1b"];
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

function examText(value: string) {
  return value ? new Date(value).toLocaleString("th-TH") : "";
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

function createEditToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

function examWarningsForCourses(courseList: Course[]) {
  const items = examItems(courseList);

  return items.flatMap((item, index) =>
    items.slice(index + 1).flatMap((next) => {
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

function planStats(courseList: Course[]) {
  const usedDays = new Set(courseList.map((course) => course.day));
  const freeMinutes = freeSlotsForCourses(courseList)
    .filter((slot) => usedDays.has(slot.day))
    .reduce((sum, slot) => sum + slot.minutes, 0);

  return {
    credits: courseList.reduce((sum, course) => sum + course.credits, 0),
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
  const [courseSearch, setCourseSearch] = useState("");
  const [academicYear, setAcademicYear] = useState("2569");
  const [semester, setSemester] = useState("1");
  const [campusId, setCampusId] = useState("10");
  const [divisionCode, setDivisionCode] = useState("");
  const [levelId, setLevelId] = useState("61");
  const [facultyId, setFacultyId] = useState("4");
  const [departmentId, setDepartmentId] = useState("406");
  const [classSet, setClassSet] = useState("");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(fallbackFilters);
  const [departmentOptions, setDepartmentOptions] = useState<ComboOption[]>([]);
  const [filterError, setFilterError] = useState("");
  const [isCourseBrowserOpen, setIsCourseBrowserOpen] = useState(false);
  const [isManualCourseOpen, setIsManualCourseOpen] = useState(false);
  const [sharedPlanId, setSharedPlanId] = useState<string | null>(null);
  const [sharedEditToken, setSharedEditToken] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [shareConflict, setShareConflict] = useState(false);
  const [excelStatus, setExcelStatus] = useState("");
  const [plannerSelectedCodes, setPlannerSelectedCodes] = useState<string[]>([]);
  const [plannerAvoidDays, setPlannerAvoidDays] = useState<DayKey[]>([]);
  const [plannerStart, setPlannerStart] = useState("08:00");
  const [plannerEnd, setPlannerEnd] = useState("17:00");
  const [plannerLunchBreak, setPlannerLunchBreak] = useState(true);
  const [generatedPlans, setGeneratedPlans] = useState<GeneratedSchedulePlan[]>([]);
  const [plannerStatus, setPlannerStatus] = useState("");
  const [comparePlanAId, setComparePlanAId] = useState("");
  const [comparePlanBId, setComparePlanBId] = useState("");
  const [timetableView, setTimetableView] = useState<"grid" | "list">("grid");
  const [lastSharedUpdatedAt, setLastSharedUpdatedAt] = useState("");
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const lastSharedUpdatedAtRef = useRef("");
  const sharedEditTokenRef = useRef("");
  const hasLocalPlanMutationRef = useRef(false);
  const sharedDirtyRef = useRef(false);
  const plansRef = useRef<TimetablePlan[]>([]);

  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? plans[0];
  const currentPlanId = activePlan?.id ?? activePlanId;
  const courses = activePlan?.courses ?? noCourses;
  const sharedLocalPlan = sharedPlanId ? plans.find((plan) => plan.sharedId === sharedPlanId) ?? null : null;
  const sharedLocalPlanId = sharedLocalPlan?.id ?? (sharedPlanId ? `shared-${sharedPlanId}` : "");
  const isActiveSharedPlan = activePlan?.source === "shared";
  const canEditActivePlan = !isActiveSharedPlan || activePlan?.canEdit === true;
  const isActiveReadOnlySharedPlan = isActiveSharedPlan && !canEditActivePlan;

  const setSharedPlan = useCallback((planId: string, planName: string, planCourses: Course[], updatedAt = "", editToken = sharedEditTokenRef.current, activate = true, preferredLocalId = "") => {
    const canEdit = Boolean(editToken);
    const localId = preferredLocalId || plansRef.current.find((plan) => plan.sharedId === planId)?.id || `shared-${planId}`;

    setPlans((currentPlans) => {
      const nextPlan = { id: localId, name: planName, courses: planCourses, source: "shared" as const, sharedId: planId, canEdit };
      const existing = currentPlans.some((plan) => plan.id === localId || plan.sharedId === planId);

      return existing ? currentPlans.map((plan) => (plan.id === localId || plan.sharedId === planId ? nextPlan : plan)) : [...currentPlans, nextPlan];
    });
    if (activate) {
      setActivePlanId(localId);
    }
    setSharedPlanId(planId);
    setSharedEditToken(editToken);
    sharedEditTokenRef.current = editToken;
    if (updatedAt) {
      sharedDirtyRef.current = false;
      lastSharedUpdatedAtRef.current = updatedAt;
      setLastSharedUpdatedAt(updatedAt);
    }
    setShareUrl(`${window.location.origin}${window.location.pathname}?share=${planId}${editToken ? `&edit=${editToken}` : ""}`);
  }, []);

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  const loadSharedPlan = useCallback(async (planId: string, showStatus = true, editToken = "") => {
    if (showStatus) {
      setShareStatus("กำลังโหลดตารางแชร์...");
    }

    try {
      const data = await loadSharedPlanAction(planId);

      setSharedPlan(planId, data.name, data.courses, data.updatedAt, editToken);
      if (showStatus) {
        setShareStatus(editToken ? "โหลดตารางแชร์แล้ว" : "โหลดตารางแชร์แล้ว โหมดดูอย่างเดียว");
      }
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "โหลดตารางแชร์ไม่สำเร็จ");
    }
  }, [setSharedPlan]);

  const saveSharedPlan = useCallback(async (planId: string, editToken: string, name: string, planCourses: Course[], showStatus = true) => {
    if (!editToken) {
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อบันทึก");
      return false;
    }

    if (showStatus) {
      setShareStatus("กำลังบันทึกตารางแชร์...");
    }

    try {
      const data = await saveSharedPlanAction(planId, {
        name,
        courses: planCourses,
        editToken,
        updatedAt: lastSharedUpdatedAtRef.current,
      });
      lastSharedUpdatedAtRef.current = data.updatedAt;
      setLastSharedUpdatedAt(data.updatedAt);
      sharedDirtyRef.current = false;
      setShareConflict(false);

      if (showStatus) {
        setShareStatus("บันทึกตารางแชร์แล้ว");
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "บันทึกตารางแชร์ไม่สำเร็จ";
      setShareStatus(message);
      if (message.includes("เปลี่ยนแปลงใหม่กว่า")) {
        setShareConflict(true);
      }
      return false;
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
        setPlans(savedPlans);
      } else {
        const saved = readJson<Course[]>("student-timetable", []);
        setPlans([{ id: "default", name: defaultPlanName, courses: saved }]);
      }

      setActivePlanId(window.localStorage.getItem("student-timetable-active-plan") ?? "default");
      setHasLoadedLocalData(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hasLoadedLocalData) {
      return;
    }

    window.localStorage.setItem("student-timetable-plans", JSON.stringify(plans));
  }, [hasLoadedLocalData, plans]);

  useEffect(() => {
    if (!hasLoadedLocalData) {
      return;
    }

    window.localStorage.setItem("student-timetable-active-plan", currentPlanId);
  }, [currentPlanId, hasLoadedLocalData]);

  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("share");
    const editToken = new URLSearchParams(window.location.search).get("edit") ?? "";

    if (sharedId) {
      const timeout = window.setTimeout(() => {
        loadSharedPlan(sharedId, true, editToken);
      }, 0);

      return () => window.clearTimeout(timeout);
    }
  }, [loadSharedPlan]);

  useEffect(() => {
    if (!sharedPlanId || !sharedEditToken || !sharedLocalPlan) {
      return;
    }

    if (!sharedLocalPlan.canEdit || !sharedDirtyRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      saveSharedPlan(sharedPlanId, sharedEditToken, sharedLocalPlan.name, sharedLocalPlan.courses, false);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [saveSharedPlan, sharedEditToken, sharedLocalPlan, sharedPlanId]);

  useEffect(() => {
    if (!sharedPlanId) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        if (sharedDirtyRef.current || (isManualCourseOpen && activePlanId === sharedLocalPlanId)) {
          return;
        }

        const data = await loadSharedPlanAction(sharedPlanId);

        if (data.updatedAt && data.updatedAt !== lastSharedUpdatedAtRef.current) {
          setSharedPlan(sharedPlanId, data.name, data.courses, data.updatedAt, sharedEditTokenRef.current, false);
          setShareStatus("อัปเดตตารางล่าสุดแล้ว");
        }
      } catch (error) {
        setShareStatus(error instanceof Error ? error.message : "ซิงก์ตารางแชร์ไม่สำเร็จ");
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [activePlanId, isManualCourseOpen, setSharedPlan, sharedLocalPlanId, sharedPlanId]);

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

        setDepartmentOptions(data.departments);

        if (!data.departments.some((option: ComboOption) => comboValue(option) === departmentId)) {
          setDepartmentId("");
        }
      } catch (error) {
        setFilterError(error instanceof Error ? error.message : "โหลดภาควิชาไม่สำเร็จ");
      }
    }

    loadDepartments();
  }, [departmentId, facultyId]);

  const totalCredits = useMemo(() => courses.reduce((sum, course) => sum + course.credits, 0), [courses]);
  const examCount = useMemo(() => courses.filter((course) => course.midterm || course.final).length, [courses]);
  const conflicts = useMemo(
    () =>
      courses.flatMap((course, index) =>
        courses.slice(index + 1).filter((next) => overlaps(course, next)).map((next) => [course, next]),
      ),
    [courses],
  );
  const filteredRemoteClasses = useMemo(() => {
    const keyword = courseSearch.trim().toLowerCase();

    if (!keyword) {
      return remoteClasses;
    }

    return remoteClasses.filter((remoteClass) => remoteClass.coursecode.toLowerCase().includes(keyword));
  }, [courseSearch, remoteClasses]);
  const remoteCourseGroups = useMemo(() => {
    const groups = new Map<string, RemoteClass[]>();

    remoteClasses.forEach((remoteClass) => {
      const group = groups.get(remoteClass.coursecode) ?? [];
      group.push(remoteClass);
      groups.set(remoteClass.coursecode, group);
    });

    return Array.from(groups.entries()).map(([code, classes]) => ({
      code,
      name: classes[0]?.coursename ?? code,
      classes,
    }));
  }, [remoteClasses]);
  const freeSlots = useMemo(() => freeSlotsForCourses(courses).filter((slot) => courses.some((course) => course.day === slot.day)).slice(0, 14), [courses]);
  const examWarnings = useMemo(() => examWarningsForCourses(courses), [courses]);
  const comparePlanA = plans.find((plan) => plan.id === comparePlanAId) ?? plans[0];
  const comparePlanB = plans.find((plan) => plan.id === comparePlanBId) ?? plans[1] ?? plans[0];
  const comparison = useMemo(() => {
    if (!comparePlanA || !comparePlanB) {
      return null;
    }

    const aKeys = new Set(comparePlanA.courses.map(courseKey));
    const bKeys = new Set(comparePlanB.courses.map(courseKey));
    const onlyA = comparePlanA.courses.filter((course) => !bKeys.has(courseKey(course)));
    const onlyB = comparePlanB.courses.filter((course) => !aKeys.has(courseKey(course)));

    return {
      aStats: planStats(comparePlanA.courses),
      bStats: planStats(comparePlanB.courses),
      onlyA,
      onlyB,
    };
  }, [comparePlanA, comparePlanB]);
  const dailyCourses = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        courses: courses.filter((course) => course.day === day.key).sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
      })),
    [courses],
  );

  function submitCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditActivePlan) {
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อแก้ตาราง");
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

    updateActiveCourses((current) =>
      editingId ? current.map((course) => (course.id === editingId ? nextCourse : course)) : [...current, nextCourse],
    );
    setForm(emptyCourse);
    setEditingId(null);
    setIsManualCourseOpen(false);
  }

  function editCourse(course: Course) {
    if (!canEditActivePlan) {
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อแก้ตาราง");
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
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อแก้ตาราง");
      return;
    }

    updateActiveCourses((current) => current.filter((course) => course.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyCourse);
    }
  }

  function removeAllCourses() {
    if (!canEditActivePlan) {
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อแก้ตาราง");
      return;
    }

    updateActiveCourses(() => []);
    setEditingId(null);
    setForm(emptyCourse);
  }

  function updateActiveCourses(updater: (current: Course[]) => Course[]) {
    if (!canEditActivePlan) {
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อแก้ตาราง");
      return;
    }

    hasLocalPlanMutationRef.current = true;
    if (isActiveSharedPlan) {
      sharedDirtyRef.current = true;
    }
    setPlans((currentPlans) =>
      currentPlans.map((plan) => (plan.id === currentPlanId ? { ...plan, courses: updater(plan.courses) } : plan)),
    );
  }

  function addPlan() {
    hasLocalPlanMutationRef.current = true;
    const nextPlanId = crypto.randomUUID();

    setPlans((currentPlans) => [
      ...currentPlans,
      {
        id: nextPlanId,
        name: nextTableName(currentPlans),
        courses: [],
      },
    ]);
    setActivePlanId(nextPlanId);
    setEditingId(null);
    setForm(emptyCourse);
    setIsManualCourseOpen(false);
  }

  function renamePlan(name: string) {
    if (!canEditActivePlan) {
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อแก้ตาราง");
      return;
    }

    hasLocalPlanMutationRef.current = true;
    if (isActiveSharedPlan) {
      sharedDirtyRef.current = true;
    }
    setPlans((currentPlans) =>
      currentPlans.map((plan) => (plan.id === currentPlanId ? { ...plan, name } : plan)),
    );
  }

  function removePlan() {
    if (plans.length <= 1) {
      return;
    }

    const nextPlans = plans.filter((plan) => plan.id !== currentPlanId);
    hasLocalPlanMutationRef.current = true;
    setPlans(nextPlans);
    setActivePlanId(nextPlans[0].id);
    if (currentPlanId === sharedLocalPlanId) {
      leaveSharedMode(false);
    }
    setEditingId(null);
    setForm(emptyCourse);
  }

  function toggleCourseLocked(id: string) {
    if (!canEditActivePlan) {
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อแก้ตาราง");
      return;
    }

    updateActiveCourses((current) => current.map((course) => (course.id === id ? { ...course, locked: !course.locked } : course)));
  }

  function togglePlannerCode(code: string) {
    setPlannerSelectedCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }

  function toggleAvoidDay(day: DayKey) {
    setPlannerAvoidDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  }

  function generateSchedulePlans() {
    const selectedGroups = plannerSelectedCodes
      .map((code) => remoteCourseGroups.find((group) => group.code === code))
      .filter(Boolean) as typeof remoteCourseGroups;

    if (selectedGroups.length === 0) {
      setGeneratedPlans([]);
      setPlannerStatus("เลือกรหัสวิชาจากข้อมูลที่โหลดก่อน");
      return;
    }

    if (selectedGroups.length > 7) {
      setGeneratedPlans([]);
      setPlannerStatus("เลือกได้สูงสุด 7 วิชาต่อครั้งเพื่อให้คำนวณเร็ว");
      return;
    }

    const lockedCourses = courses.filter((course) => course.locked || !plannerSelectedCodes.includes(course.code));
    const lockedCodes = new Set(courses.filter((course) => course.locked).map((course) => course.code));
    const unlockedSelectedGroups = selectedGroups.filter((group) => !lockedCodes.has(group.code));
    const results: GeneratedSchedulePlan[] = [];

    if (coursesHaveConflict(lockedCourses)) {
      setGeneratedPlans([]);
      setPlannerStatus("วิชาที่ล็อกหรือวิชาที่คงไว้มีเวลาชนกัน จึงสร้างแผนไม่ได้");
      return;
    }

    if (unlockedSelectedGroups.length === 0) {
      setGeneratedPlans([]);
      setPlannerStatus("วิชาที่เลือกถูกล็อกไว้ทั้งหมด หรือยังไม่ได้โหลด section ของรหัสที่เลือก");
      return;
    }

    function walk(groupIndex: number, picked: Course[][]) {
      if (results.length >= 20) {
        return;
      }

      if (groupIndex >= unlockedSelectedGroups.length) {
        const candidateCourses = [...lockedCourses, ...picked.flat()];

        if (coursesHaveConflict(candidateCourses)) {
          return;
        }

        const { score, reasons } = scorePlan(candidateCourses, plannerAvoidDays, plannerStart, plannerEnd, plannerLunchBreak);
        results.push({
          id: crypto.randomUUID(),
          name: `แผนอัตโนมัติ ${results.length + 1}`,
          courses: candidateCourses,
          score,
          reasons,
        });
        return;
      }

      unlockedSelectedGroups[groupIndex].classes.slice(0, 12).forEach((remoteClass, optionIndex) => {
        const color = palette[(lockedCourses.length + groupIndex + optionIndex) % palette.length];
        const candidate = remoteClassToCourses(remoteClass, color);
        const partialCourses = [...lockedCourses, ...picked.flat(), ...candidate];

        if (!coursesHaveConflict(partialCourses)) {
          walk(groupIndex + 1, [...picked, candidate]);
        }
      });
    }

    walk(0, []);

    const sortedResults = results.sort((a, b) => b.score - a.score).slice(0, 6);
    setGeneratedPlans(sortedResults);
    setPlannerStatus(sortedResults.length > 0 ? `พบแผนที่ไม่ชน ${sortedResults.length} แบบ` : "ไม่พบแผนที่ไม่ชนตามรายวิชาที่เลือก");
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
  }

  async function createShareLink() {
    const planId = crypto.randomUUID().slice(0, 8);
    const editToken = createEditToken();
    const name = activePlan?.name || defaultPlanName;

    const saved = await saveSharedPlan(planId, editToken, name, courses);
    if (!saved) {
      return;
    }

    setSharedPlan(planId, name, courses, lastSharedUpdatedAtRef.current, editToken, true, currentPlanId);
    window.history.replaceState(null, "", `?share=${planId}&edit=${editToken}`);
  }

  async function copySharedPlanLink(mode: "view" | "edit") {
    if (!sharedPlanId) {
      return;
    }

    if (mode === "edit" && !sharedEditToken) {
      setShareStatus("ยังไม่มีลิงก์แก้ไข");
      return;
    }

    const link = `${window.location.origin}${window.location.pathname}?share=${sharedPlanId}${mode === "edit" ? `&edit=${sharedEditToken}` : ""}`;

    await navigator.clipboard.writeText(link);
    setShareStatus(mode === "edit" ? "คัดลอกลิงก์แก้ไขแล้ว" : "คัดลอกลิงก์ดูอย่างเดียวแล้ว");
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

  function leaveSharedMode(copyCurrentPlan = true) {
    if (copyCurrentPlan && isActiveSharedPlan) {
      copyActivePlanToLocal();
    }

    setSharedPlanId(null);
    setSharedEditToken("");
    sharedEditTokenRef.current = "";
    setShareUrl("");
    setLastSharedUpdatedAt("");
    lastSharedUpdatedAtRef.current = "";
    sharedDirtyRef.current = false;
    setShareConflict(false);
    setShareStatus("ออกจากโหมดแชร์แล้ว");
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
    const leftWidth = 150;
    const hourWidth = 120;
    const titleHeight = 96;
    const headerHeight = 54;
    const rowHeight = 122;
    const padding = 36;
    const width = padding * 2 + leftWidth + hours.length * hourWidth;
    const height = padding * 2 + titleHeight + headerHeight + days.length * rowHeight;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);
    context.fillStyle = "#f7f8f2";
    context.fillRect(0, 0, width, height);

    context.fillStyle = "#172033";
    context.font = '900 32px "Noto Sans Thai", "Segoe UI", sans-serif';
    context.fillText(activePlan?.name || defaultPlanName, padding, padding + 34);
    context.fillStyle = "#465064";
    context.font = '700 17px "Noto Sans Thai", "Segoe UI", sans-serif';
    context.fillText(`${courses.length} วิชา · ${totalCredits} หน่วยกิต · สร้างจาก TableLearn`, padding, padding + 66);

    const gridX = padding;
    const gridY = padding + titleHeight;
    const gridWidth = leftWidth + hours.length * hourWidth;
    const gridHeight = headerHeight + days.length * rowHeight;

    context.fillStyle = "#fffef8";
    context.fillRect(gridX, gridY, gridWidth, gridHeight);
    context.strokeStyle = "#bdc7b1";
    context.lineWidth = 1;
    context.strokeRect(gridX, gridY, gridWidth, gridHeight);

    context.fillStyle = "#edf1e8";
    context.fillRect(gridX, gridY, gridWidth, headerHeight);
    context.fillRect(gridX, gridY, leftWidth, gridHeight);

    context.fillStyle = "#364056";
    context.font = '900 15px "Noto Sans Thai", "Segoe UI", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("วัน / เวลา", gridX + leftWidth / 2, gridY + headerHeight / 2);

    hours.forEach((hour, index) => {
      const x = gridX + leftWidth + index * hourWidth;
      context.fillText(`${String(hour).padStart(2, "0")}:00`, x + hourWidth / 2, gridY + headerHeight / 2);
    });

    days.forEach((day, index) => {
      const y = gridY + headerHeight + index * rowHeight;
      context.fillText(day.label, gridX + leftWidth / 2, y + rowHeight / 2);
    });

    context.strokeStyle = "#d9dece";
    for (let index = 0; index <= hours.length; index += 1) {
      const x = gridX + leftWidth + index * hourWidth;
      context.beginPath();
      context.moveTo(x, gridY);
      context.lineTo(x, gridY + gridHeight);
      context.stroke();
    }

    for (let index = 0; index <= days.length; index += 1) {
      const y = gridY + headerHeight + index * rowHeight;
      context.beginPath();
      context.moveTo(gridX, y);
      context.lineTo(gridX + gridWidth, y);
      context.stroke();
    }

    courses.forEach((course) => {
      const dayIndex = days.findIndex((day) => day.key === course.day);
      const startOffset = (toMinutes(course.start) - hours[0] * 60) / 60;
      const endOffset = (toMinutes(course.end) - hours[0] * 60) / 60;

      if (dayIndex < 0 || endOffset <= 0 || startOffset >= hours.length) {
        return;
      }

      const x = gridX + leftWidth + Math.max(0, startOffset) * hourWidth + 5;
      const y = gridY + headerHeight + dayIndex * rowHeight + 8;
      const blockWidth = Math.max(48, (Math.min(hours.length, endOffset) - Math.max(0, startOffset)) * hourWidth - 10);
      const blockHeight = rowHeight - 16;

      context.fillStyle = course.color;
      context.beginPath();
      context.roundRect(x, y, blockWidth, blockHeight, 8);
      context.fill();

      context.fillStyle = "#ffffff";
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.font = '900 15px "Noto Sans Thai", "Segoe UI", sans-serif';
      drawWrappedText(context, course.code, x + 10, y + 24, blockWidth - 20, 18, 1);
      context.font = '700 13px "Noto Sans Thai", "Segoe UI", sans-serif';
      drawWrappedText(context, course.name, x + 10, y + 46, blockWidth - 20, 17, 2);
      context.font = '700 12px "Noto Sans Thai", "Segoe UI", sans-serif';
      drawWrappedText(context, `${course.start}-${course.end} ${course.room}`, x + 10, y + blockHeight - 14, blockWidth - 20, 16, 1);
    });

    downloadCanvas(canvas, `${activePlan?.name || "timetable"}.png`);
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    if (!canEditActivePlan) {
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อแก้ตาราง");
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

  async function loadRemoteClasses() {
    setIsLoadingClasses(true);
    setClassError("");

    try {
      const params = new URLSearchParams({
        year: academicYear,
        semester,
        campus: campusId,
        division: divisionCode,
        level: levelId,
        faculty: facultyId,
        department: departmentId,
      });

      if (courseSearch.trim()) {
        params.set("courseCode", courseSearch.trim());
      }

      if (classSet) {
        params.set("classSet", classSet);
      }

      const response = await fetch(`/api/kmutnb/classes?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "โหลดข้อมูลรายวิชาไม่สำเร็จ");
      }

      setRemoteClasses(Array.isArray(data) ? data : []);
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
      setShareStatus("ลิงก์นี้ดูได้อย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อแก้ตาราง");
      return;
    }

    const color = palette[courses.length % palette.length];
    const importedCourses = remoteClassToCourses(remoteClass, color);

    updateActiveCourses((current) => [...current, ...importedCourses]);
  }

  function importRemoteCourseGroup(group: { code: string; name: string; classes: RemoteClass[] }) {
    const firstClass = group.classes[0];

    if (!firstClass) {
      setPlannerStatus("ไม่พบ section สำหรับรายวิชานี้");
      return;
    }

    importRemoteClass(firstClass);
    setPlannerStatus(`เพิ่ม ${group.code} เข้าในรายวิชาที่บันทึกแล้ว`);
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div className="brand-heading">
          <div className="logo-mark" aria-hidden="true">
            <span>TL</span>
          </div>
          <div>
            <p className="eyebrow">KMUTNB study planner</p>
            <h1>TableLearn</h1>
            <p className="hero-copy">จัดตารางเรียน ตารางสอบ และแผนสำรองให้อยู่ในหน้าเดียว พร้อมนำเข้ารายวิชาจากระบบมหาวิทยาลัย</p>
          </div>
        </div>
        <div className="summary" aria-label="สรุปตารางเรียน">
          <div>
            <span>รายวิชา</span>
            <strong>{courses.length}</strong>
          </div>
          <div>
            <span>หน่วยกิต</span>
            <strong>{totalCredits}</strong>
          </div>
          <div>
            <span>เวลาชน</span>
            <strong>{conflicts.length}</strong>
          </div>
          <div>
            <span>ตารางสอบ</span>
            <strong>{examCount}</strong>
          </div>
        </div>
      </section>

      <section className="notice panel" aria-label="หมายเหตุการใช้งาน">
        <div className="notice-mark" aria-hidden="true">!</div>
        <div className="notice-content">
          <strong>หมายเหตุการใช้งาน</strong>
          <ul>
            <li>เว็บนี้ทำขึ้นเพื่อช่วยอำนวยความสะดวกสำหรับวางแผนการลงทะเบียนการศึกษาเท่านั้น ไม่ได้เป็นระบบของมหาวิทยาลัย</li>
            <li>
              ข้อมูลรายวิชานำมาจากเว็บ <a href="https://reg.kmutnb.ac.th/" target="_blank" rel="noreferrer">reg.kmutnb.ac.th</a>
              หากข้อมูลผิดพลาดหรือไม่ตรงกัน ให้ตรวจสอบข้อมูลล่าสุดจากเว็บ
              <a href="https://reg.kmutnb.ac.th/" target="_blank" rel="noreferrer"> reg.kmutnb.ac.th</a>
            </li>
            <li>เว็บไซต์นี้ไม่มีการเก็บข้อมูลผู้ใช้ใด ๆ และจัดทำขึ้นโดยนักศึกษาเพื่ออำนวยความสะดวกให้นักศึกษา มจพ. โดยไม่มีส่วนเกี่ยวข้องกับมหาวิทยาลัยอย่างเป็นทางการ</li>
          </ul>
        </div>
      </section>

      <section className="planner panel" aria-label="ตัวช่วยจัดแผนตาราง">
        <div className="planner-head">
          <div>
            <h2>ตัวช่วยจัดแผน</h2>
            <p>เลือกหลาย section จากรายวิชาที่โหลด แล้วให้ระบบสร้างแผนที่ไม่ชนกับวิชาในตารางปัจจุบัน</p>
          </div>
          <button type="button" className="primary" onClick={generateSchedulePlans} disabled={remoteCourseGroups.length === 0}>
            สร้างแผนที่เป็นไปได้
          </button>
        </div>

        <div className="planner-grid">
          <div className="planner-box">
            <h3>รายวิชาที่โหลด</h3>
            {remoteCourseGroups.length === 0 ? (
              <p className="empty">โหลดรายวิชา KMUTNB ก่อน แล้วเลือกวิชาที่ต้องการให้ช่วยจัด section</p>
            ) : (
              <div className="planner-course-picks">
                {remoteCourseGroups.slice(0, 18).map((group) => (
                  <div className="planner-course-row" key={group.code}>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={plannerSelectedCodes.includes(group.code)}
                        onChange={() => togglePlannerCode(group.code)}
                      />
                      <span>
                        <strong>{group.code}</strong>
                        {group.name} · {group.classes.length} section
                      </span>
                    </label>
                    <button type="button" className="ghost" onClick={() => importRemoteCourseGroup(group)} disabled={!canEditActivePlan}>
                      เพิ่ม
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="planner-box">
            <h3>เงื่อนไขเวลา</h3>
            <div className="planner-times">
              <label>
                ไม่ก่อน
                <input type="time" value={plannerStart} onChange={(event) => setPlannerStart(event.target.value)} />
              </label>
              <label>
                ไม่หลัง
                <input type="time" value={plannerEnd} onChange={(event) => setPlannerEnd(event.target.value)} />
              </label>
            </div>
            <div className="planner-days">
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
            <label className="check-row">
              <input
                type="checkbox"
                checked={plannerLunchBreak}
                onChange={(event) => setPlannerLunchBreak(event.target.checked)}
              />
              <span>ต้องมีพักเที่ยง 12:00-13:00</span>
            </label>
          </div>

          <div className="planner-box planner-results">
            <h3>แผนแนะนำ</h3>
            {plannerStatus && <p className="planner-status">{plannerStatus}</p>}
            {generatedPlans.length === 0 ? (
              <p className="empty">ยังไม่มีแผนที่สร้าง</p>
            ) : (
              generatedPlans.map((plan) => (
                <article className="generated-plan" key={plan.id}>
                  <div>
                    <strong>{plan.name}</strong>
                    <span>คะแนน {plan.score}/100 · {plan.courses.length} รายการ</span>
                    <small>{plan.reasons.join(" · ")}</small>
                  </div>
                  <button type="button" className="secondary" onClick={() => applyGeneratedPlan(plan)}>ใช้แผนนี้</button>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="compare panel" aria-label="เปรียบเทียบตาราง">
        <div className="compare-head">
          <div>
            <h2>เปรียบเทียบ 2 แผน</h2>
            <p>ดูคะแนนพื้นฐาน วันเรียน หน่วยกิต เวลาว่าง และรายวิชาที่ต่างกัน</p>
          </div>
          <div className="button-row">
            <button type="button" className="ghost" onClick={() => comparePlanA && setActivePlanId(comparePlanA.id)} disabled={!comparePlanA}>ใช้แผน A</button>
            <button type="button" className="ghost" onClick={() => comparePlanB && setActivePlanId(comparePlanB.id)} disabled={!comparePlanB}>ใช้แผน B</button>
          </div>
        </div>
        <div className="compare-selects">
          <label>
            แผน A
            <select value={comparePlanA?.id ?? ""} onChange={(event) => setComparePlanAId(event.target.value)}>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </label>
          <label>
            แผน B
            <select value={comparePlanB?.id ?? ""} onChange={(event) => setComparePlanBId(event.target.value)}>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </label>
        </div>
        {comparison && (
          <div className="compare-grid">
            {[
              ["หน่วยกิต", comparison.aStats.credits, comparison.bStats.credits],
              ["วันเรียน", comparison.aStats.usedDays, comparison.bStats.usedDays],
              ["เวลาว่าง", `${comparison.aStats.freeHours} ชม.`, `${comparison.bStats.freeHours} ชม.`],
              ["เวลาชน", comparison.aStats.conflicts, comparison.bStats.conflicts],
            ].map(([label, aValue, bValue]) => (
              <div className="compare-stat" key={label}>
                <span>{label}</span>
                <strong>{aValue}</strong>
                <strong>{bValue}</strong>
              </div>
            ))}
          </div>
        )}
        {comparison && (
          <div className="compare-diff">
            <div>
              <h3>มีเฉพาะแผน A</h3>
              {comparison.onlyA.length === 0 ? <p className="empty">ไม่ต่างจากแผน B</p> : comparison.onlyA.map((course) => <CourseDifference key={course.id} course={course} />)}
            </div>
            <div>
              <h3>มีเฉพาะแผน B</h3>
              {comparison.onlyB.length === 0 ? <p className="empty">ไม่ต่างจากแผน A</p> : comparison.onlyB.map((course) => <CourseDifference key={course.id} course={course} />)}
            </div>
          </div>
        )}
      </section>

      <section className="workspace">
        <section className="board">
          <div className="board-head">
            <div>
              <h2>{activePlan?.name ?? defaultPlanName}</h2>
              <p>
                {courses.length} วิชา · {totalCredits} หน่วยกิต
                {isActiveSharedPlan ? ` · ${canEditActivePlan ? "ตารางแชร์แบบแก้ไข" : "ตารางแชร์แบบดูอย่างเดียว"}` : ""}
              </p>
              {excelStatus && <p className="excel-status">{excelStatus}</p>}
            </div>
            <div className="button-row">
              <input
                ref={excelInputRef}
                className="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={importExcel}
                aria-label="Import Excel"
              />
              <button type="button" className="ghost" onClick={() => excelInputRef.current?.click()} disabled={!canEditActivePlan}>Import Excel</button>
              <button type="button" className="ghost" onClick={exportTimetableImage} disabled={courses.length === 0}>บันทึกเป็นรูป</button>
              <button type="button" className="ghost" onClick={exportExcel} disabled={courses.length === 0}>Export Excel</button>
              <button type="button" className="ghost" onClick={() => setTimetableView((view) => (view === "grid" ? "list" : "grid"))}>
                {timetableView === "grid" ? "มุมมองรายการ" : "มุมมองตาราง"}
              </button>
            </div>
          </div>
          <div className="board-controls">
            <div className="plan-bar">
              <label>
                เลือกตาราง
                <select value={currentPlanId} onChange={(event) => { setActivePlanId(event.target.value); setEditingId(null); setForm(emptyCourse); }}>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </label>
              <label>
                ชื่อตาราง
                <input value={activePlan?.name ?? ""} onChange={(event) => renamePlan(event.target.value)} disabled={!canEditActivePlan} />
              </label>
              <div className="button-row">
                <button type="button" className="secondary" onClick={addPlan}>เพิ่มตาราง</button>
                <button type="button" className="ghost danger" onClick={removePlan} disabled={plans.length <= 1}>ลบตาราง</button>
              </div>
            </div>

            <div className="share-bar">
              <div>
                <h2>แชร์ตารางร่วมกัน</h2>
                <p>{shareUrl || "สร้างลิงก์ให้เพื่อนร่วมแผนเปิดและแก้ตารางเดียวกันได้"}</p>
                {sharedPlanId && (
                  <small className="sync-note">
                    อัปเดตอัตโนมัติทุก 2 วินาที{lastSharedUpdatedAt ? ` · ล่าสุด ${new Date(lastSharedUpdatedAt).toLocaleTimeString("th-TH")}` : ""}
                  </small>
                )}
              </div>
              <div className="button-row">
                <button type="button" className="primary" onClick={createShareLink}>สร้างลิงก์แชร์</button>
                <button type="button" className="ghost" onClick={() => copySharedPlanLink("view")} disabled={!sharedPlanId}>คัดลอกลิงก์ดู</button>
                <button type="button" className="ghost" onClick={() => copySharedPlanLink("edit")} disabled={!sharedPlanId || !sharedEditToken}>คัดลอกลิงก์แก้ไข</button>
                <button type="button" className="ghost" onClick={() => sharedPlanId && loadSharedPlan(sharedPlanId)} disabled={!sharedPlanId}>โหลดล่าสุด</button>
                <button type="button" className="ghost" onClick={() => leaveSharedMode()} disabled={!sharedPlanId}>ออกจากโหมดแชร์</button>
              </div>
              {shareConflict && (
                <div className="share-conflict">
                  <span>ตารางกลางมีข้อมูลใหม่กว่า</span>
                  <button type="button" className="ghost" onClick={() => sharedPlanId && loadSharedPlan(sharedPlanId)} disabled={!sharedPlanId}>โหลดล่าสุด</button>
                  <button type="button" className="secondary" onClick={copyActivePlanToLocal}>คัดลอกเป็นตารางใหม่</button>
                </div>
              )}
              {shareStatus && <span>{shareStatus}</span>}
            </div>
          </div>
          {isActiveReadOnlySharedPlan && (
            <div className="alert">
              ลิงก์นี้เป็นโหมดดูอย่างเดียว ต้องใช้ลิงก์แก้ไขเพื่อเพิ่ม ลบ หรือแก้รายวิชา
            </div>
          )}
          {conflicts.length > 0 && (
            <div className="alert">
              พบเวลาชนกัน {conflicts.length} คู่ ตรวจรายวิชาที่ทับซ้อนในตาราง
            </div>
          )}
          {examWarnings.length > 0 && (
            <div className="alert danger-alert">
              พบความเสี่ยงตารางสอบ {examWarnings.length} รายการ
            </div>
          )}

          {timetableView === "grid" ? (
            <div className="timetable">
              <div className="corner">วัน / เวลา</div>
              {hours.map((hour) => (
                <div className="time-head" key={hour}>{String(hour).padStart(2, "0")}:00</div>
              ))}
              {days.map((day) => (
                <DayRow key={day.key} day={day} courses={courses} />
              ))}
            </div>
          ) : (
            <div className="mobile-day-list">
              {dailyCourses.map((day) => (
                <DayList key={day.key} day={day} />
              ))}
            </div>
          )}
        </section>
      </section>

      {isManualCourseOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => { setIsManualCourseOpen(false); setEditingId(null); setForm(emptyCourse); }}>
          <form className="panel form modal-panel course-modal" role="dialog" aria-modal="true" aria-labelledby="manual-course-title" onSubmit={submitCourse} onClick={(event) => event.stopPropagation()}>
            <div className="panel-title">
              <h2 id="manual-course-title">{editingId ? "แก้ไขรายวิชา" : "เพิ่มรายวิชาด้วยตนเอง"}</h2>
              <button type="button" className="ghost" onClick={() => { setIsManualCourseOpen(false); setEditingId(null); setForm(emptyCourse); }}>
                ปิด
              </button>
            </div>

            <label>
              ชื่อวิชา
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="เช่น การเขียนโปรแกรมเว็บ" />
            </label>

            <div className="grid-2">
              <label>
                รหัสวิชา
                <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="CS101" />
              </label>
              <label>
                หน่วยกิต
                <input required min="1" max="9" type="number" value={form.credits} onChange={(event) => setForm({ ...form, credits: Number(event.target.value) })} />
              </label>
            </div>

            <div className="grid-3">
              <label>
                วันเรียน
                <select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value as DayKey })}>
                  {days.map((day) => (
                    <option key={day.key} value={day.key}>{day.label}</option>
                  ))}
                </select>
              </label>
              <label>
                เริ่ม
                <input required type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} />
              </label>
              <label>
                สิ้นสุด
                <input required type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} />
              </label>
            </div>

            <div className="grid-2">
              <label>
                ห้องเรียน
                <input required value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="อาคาร 5 ห้อง 301" />
              </label>
              <label>
                อาจารย์
                <input required value={form.teacher} onChange={(event) => setForm({ ...form, teacher: event.target.value })} placeholder="อ. สมชาย" />
              </label>
            </div>

            <label>
              สอบกลางภาค
              <input type="datetime-local" value={form.midterm} onChange={(event) => setForm({ ...form, midterm: event.target.value })} />
            </label>
            <label>
              สอบปลายภาค
              <input type="datetime-local" value={form.final} onChange={(event) => setForm({ ...form, final: event.target.value })} />
            </label>

            <button className="primary" type="submit">{editingId ? "บันทึกการแก้ไข" : "เพิ่มลงตาราง"}</button>
          </form>
        </div>
      )}

      {isCourseBrowserOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsCourseBrowserOpen(false)}>
          <section className="remote modal-panel" role="dialog" aria-modal="true" aria-labelledby="course-browser-title" onClick={(event) => event.stopPropagation()}>
            <div className="remote-head">
              <div>
                <h2 id="course-browser-title">ข้อมูลรายวิชา KMUTNB</h2>
                <p>เลือกตัวกรองแล้วกดโหลด ระบบจะดึงข้อมูลจาก regapi ตามค่าที่กำหนด</p>
              </div>
              <button type="button" className="ghost" onClick={() => setIsCourseBrowserOpen(false)}>ปิด</button>
            </div>
            <div className="remote-tools">
              <label>
                ปีการศึกษา
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={academicYear}
                  onChange={(event) => setAcademicYear(event.target.value.replace(/\D/g, ""))}
                  placeholder="2569"
                />
              </label>
              <label>
                ภาคเรียน
                <select value={semester} onChange={(event) => setSemester(event.target.value)}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </label>
              <label>
                วิทยาเขต
                <select value={campusId} onChange={(event) => setCampusId(event.target.value)}>
                  {filterOptions.campuses.map((option) => (
                    <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                  ))}
                </select>
              </label>
              <label>
                ประเภทนักศึกษา
                <select value={divisionCode} onChange={(event) => setDivisionCode(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {filterOptions.divisions.map((option) => (
                    <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                  ))}
                </select>
              </label>
              <label>
                ระดับการศึกษา
                <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
                  {filterOptions.levels.map((option) => (
                    <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                  ))}
                </select>
              </label>
              <label>
                คณะ
                <select value={facultyId} onChange={(event) => setFacultyId(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {filterOptions.faculties.map((option) => (
                    <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                  ))}
                </select>
              </label>
              <label>
                ภาควิชา
                <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} disabled={!facultyId}>
                  <option value="">ทั้งหมด</option>
                  {departmentOptions.map((option) => (
                    <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                  ))}
                </select>
              </label>
              <label>
                กลุ่มเรียน
                <select value={classSet} onChange={(event) => setClassSet(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {filterOptions.classSets.map((option) => (
                    <option key={comboValue(option)} value={comboValue(option)}>{option.comboshow}</option>
                  ))}
                </select>
              </label>
              <label>
                รหัสวิชา
                <input
                  value={courseSearch}
                  onChange={(event) => setCourseSearch(event.target.value)}
                  placeholder="เช่น 040613100"
                />
              </label>
              <button className="primary" type="button" onClick={loadRemoteClasses} disabled={isLoadingClasses}>
                {isLoadingClasses ? "กำลังโหลด..." : "โหลดรายวิชา KMUTNB"}
              </button>
            </div>
            {filterError && <div className="alert">{filterError}</div>}
            {classError && <div className="alert">{classError}</div>}
            <div ref={remoteResultsRef}>
              {remoteClasses.length > 0 && (
                <p className="remote-count">แสดง {filteredRemoteClasses.length} จาก {remoteClasses.length} รายการ</p>
              )}
              {hasLoadedClasses && !classError && remoteClasses.length === 0 && (
                <p className="empty">ไม่พบรายวิชาตามเงื่อนไขที่เลือก ลองปรับคณะ ภาควิชา หรือรหัสวิชาแล้วโหลดอีกครั้ง</p>
              )}
              {remoteClasses.length > 0 && filteredRemoteClasses.length === 0 && (
                <p className="empty">ไม่พบรายวิชาที่ตรงกับรหัสวิชา “{courseSearch}”</p>
              )}
            </div>
            {filteredRemoteClasses.length > 0 && (
              <ul className="remote-list">
                {filteredRemoteClasses.map((remoteClass) => {
                  const parsedTime = parseClassTime(remoteClass.classtime);
                  const dayLabel = days.find((day) => day.key === parsedTime.day)?.label ?? "";

                  return (
                    <li className="remote-item" key={remoteClass.classid}>
                      <div className="remote-item-title">
                        <span className="remote-item-code">{remoteClass.coursecode}</span>
                        <span className="remote-item-section">S.{remoteClass.sectioncode}</span>
                      </div>
                      <div className="remote-item-name">{remoteClass.coursename}</div>
                      <dl className="remote-item-meta">
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
                      <button
                        type="button"
                        className="remote-item-import"
                        onClick={() => importRemoteClass(remoteClass)}
                        disabled={!canEditActivePlan}
                      >
                        นำเข้าลงตาราง
                      </button>
                      <button
                        type="button"
                        className="remote-item-select"
                        onClick={() => togglePlannerCode(remoteClass.coursecode)}
                      >
                        {plannerSelectedCodes.includes(remoteClass.coursecode) ? "เอาออกจากตัวช่วยจัดแผน" : "เลือกเข้าตัวช่วยจัดแผน"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <section className="lower">
        <div className="panel">
          <div className="panel-title course-list-head">
            <h2>รายวิชาที่บันทึก</h2>
            <div className="button-row">
              <button type="button" className="primary" onClick={() => setIsCourseBrowserOpen(true)}>ดึงรายวิชาจากเว็บ</button>
              <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(emptyCourse); setIsManualCourseOpen(true); }} disabled={!canEditActivePlan}>เพิ่มด้วยตนเอง</button>
              <button type="button" className="ghost danger" onClick={removeAllCourses} disabled={courses.length === 0 || !canEditActivePlan}>ลบทั้งหมด</button>
            </div>
          </div>
          <div className="course-list">
            {courses.length === 0 ? (
              <p className="empty">ยังไม่มีรายวิชา ดึงรายวิชาจากเว็บหรือเพิ่มด้วยตนเองเพื่อเริ่มจัดตาราง</p>
            ) : (
              courses.map((course) => (
                <article className="course-card" key={course.id} style={{ borderColor: course.color }}>
                  <div>
                    <strong>{course.code} · {course.name}</strong>
                    <span>{days.find((day) => day.key === course.day)?.label} {course.start}-{course.end} · {course.room}</span>
                    <span>{course.teacher} · {course.credits} หน่วยกิต</span>
                  </div>
                  <div className="actions">
                    <button type="button" className={course.locked ? "secondary" : ""} onClick={() => toggleCourseLocked(course.id)} disabled={!canEditActivePlan}>
                      {course.locked ? "ปลดล็อก" : "ล็อก"}
                    </button>
                    <button type="button" onClick={() => editCourse(course)} disabled={!canEditActivePlan}>แก้ไข</button>
                    <button type="button" className="danger" onClick={() => removeCourse(course.id)} disabled={!canEditActivePlan}>ลบ</button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <h2>เวลาว่าง</h2>
          <div className="free-list">
            {freeSlots.length === 0 ? (
              <p className="empty">ยังไม่มีข้อมูลเวลาว่างจากตารางปัจจุบัน</p>
            ) : (
              freeSlots.map((slot) => (
                <div className="free-item" key={`${slot.day}-${slot.start}-${slot.end}`}>
                  <strong>{slot.label}</strong>
                  <span>{slot.start}-{slot.end}</span>
                  <small>{Math.round(slot.minutes / 60 * 10) / 10} ชม.</small>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <h2>ตารางสอบ</h2>
          {examWarnings.length > 0 && (
            <div className="exam-warnings">
              {examWarnings.map((warning) => (
                <div className="exam-warning" key={warning}>{warning}</div>
              ))}
            </div>
          )}
          <div className="exam-list">
            {courses.filter((course) => course.midterm || course.final).length === 0 ? (
              <p className="empty">ยังไม่ได้กรอกเวลาสอบ</p>
            ) : (
              courses.map((course) => (
                <div className="exam-item" key={course.id}>
                  <strong>{course.code}</strong>
                  <span>{course.name}</span>
                  <span>กลางภาค: {course.midterm ? new Date(course.midterm).toLocaleString("th-TH") : "-"}</span>
                  <span>ปลายภาค: {course.final ? new Date(course.final).toLocaleString("th-TH") : "-"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function DayRow({ day, courses }: { day: (typeof days)[number]; courses: Course[] }) {
  return (
    <>
      <div className="day-label">{day.label}</div>
      {hours.map((hour) => {
        const rowStart = hour * 60;
        const rowEnd = rowStart + 60;
        const matches = courses.filter(
          (course) => course.day === day.key && toMinutes(course.start) < rowEnd && toMinutes(course.end) > rowStart,
        );
        return (
          <div className="slot" key={`${day.key}-${hour}`}>
            {matches.map((course) => (
              <div className="block" key={course.id} style={{ backgroundColor: course.color }}>
                <strong>{course.code}</strong>
                <span>{course.name}</span>
                <small>{course.start}-{course.end}</small>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function CourseDifference({ course }: { course: Course }) {
  return (
    <div className="diff-course" style={{ borderColor: course.color }}>
      <strong>{course.code}</strong>
      <span>{course.name}</span>
      <small>{days.find((day) => day.key === course.day)?.label} {course.start}-{course.end}</small>
    </div>
  );
}

function DayList({ day }: { day: (typeof days)[number] & { courses: Course[] } }) {
  return (
    <section className="day-list-section">
      <h3>{day.label}</h3>
      {day.courses.length === 0 ? (
        <p className="empty">ไม่มีเรียน</p>
      ) : (
        <div className="day-list-courses">
          {day.courses.map((course, index) => {
            const nextCourse = day.courses[index + 1];
            const gapMinutes = nextCourse ? toMinutes(nextCourse.start) - toMinutes(course.end) : 0;

            return (
              <div key={course.id}>
                <article className="day-list-card" style={{ borderColor: course.color }}>
                  <div>
                    <strong>{course.code} · {course.name}</strong>
                    <span>{course.start}-{course.end} · {course.room || "-"}</span>
                    <small>{course.teacher || "-"} · {course.credits} หน่วยกิต{course.locked ? " · ล็อกไว้" : ""}</small>
                  </div>
                </article>
                {gapMinutes > 0 && (
                  <div className="day-gap">
                    ว่าง {minutesToTime(toMinutes(course.end))}-{minutesToTime(toMinutes(nextCourse.start))} · {Math.round((gapMinutes / 60) * 10) / 10} ชม.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
