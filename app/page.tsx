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

const palette = ["#1d5aa8", "#14746a", "#a8471d", "#5b3fa8", "#0f6ba8", "#7a6a1f", "#a83d63"];
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
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function IconBlock({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3 20.5 7.5v9L12 21l-8.5-4.5v-9Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </Svg>
  );
}

function IconFace({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 4h18v16H3Z" />
      <path d="M3 9h18" />
      <path d="M9 9v11" />
      <path d="M15 9v11" />
    </Svg>
  );
}

function IconCrane({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 21V4" />
      <path d="M3 21h6" />
      <path d="M6 4h13" />
      <path d="M17 4v5" />
      <path d="M14 9h6v3h-6Z" />
    </Svg>
  );
}

function IconCompare({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 5h7v14H4Z" />
      <path d="M13 9h7v10h-7Z" />
      <path d="M13 5h7" />
    </Svg>
  );
}

function IconVoid({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 4h6M14 4h6M20 4v6M20 14v6M20 20h-6M10 20H4M4 20v-6M4 10V4" />
      <path d="M9 12h6" />
    </Svg>
  );
}

function IconStorm({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.4 1.3A3.4 3.4 0 0 1 17 15Z" />
      <path d="M8 18.5 7 21" />
      <path d="M12 18.5 11 21" />
      <path d="M16 18.5 15 21" />
    </Svg>
  );
}

function IconRail({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 3v18M16 3v18" />
      <path d="M8 7h8M8 12h8M8 17h8" />
    </Svg>
  );
}

function IconNote({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.5 21 20H3Z" />
      <path d="M12 10v4" />
      <path d="M12 16.6v.2" />
    </Svg>
  );
}

function IconArrow({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12h13" />
      <path d="m13 7 5 5-5 5" />
    </Svg>
  );
}

function IconClose({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

function IconAnchor({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 7v13" />
      <path d="M5 13a7 7 0 0 0 14 0" />
      <path d="M9 4h6v3H9Z" />
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
      <path d="M8 8h12v12H8Z" />
      <path d="M16 8V4H4v12h4" />
    </Svg>
  );
}

const zones: { id: string; label: string; short: string; Icon: (props: IconProps) => React.JSX.Element }[] = [
  { id: "face", label: "หน้าตัด", short: "ตาราง", Icon: IconFace },
  { id: "blocks", label: "รายวิชา", short: "วิชา", Icon: IconBlock },
  { id: "planner", label: "ตัวช่วยจัดแผน", short: "จัดแผน", Icon: IconCrane },
  { id: "compare", label: "เปรียบเทียบ", short: "เทียบ", Icon: IconCompare },
  { id: "voids", label: "เวลาว่าง", short: "ว่าง", Icon: IconVoid },
  { id: "exams", label: "ตารางสอบ", short: "สอบ", Icon: IconStorm },
  { id: "room", label: "ห้องร่วมกัน", short: "ห้อง", Icon: IconRail },
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
  const [shareSession, setShareSession] = useState<ShareSession | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
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
  const [activeZone, setActiveZone] = useState<string>("face");
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const hasLocalPlanMutationRef = useRef(false);
  const plansRef = useRef<TimetablePlan[]>([]);
  const sharedRoomLoadRequestRef = useRef(0);

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

  const loadSharedPlan = useCallback(async (planId: string, showStatus = true, editToken = "", updateUrl = false) => {
    const requestId = sharedRoomLoadRequestRef.current + 1;
    sharedRoomLoadRequestRef.current = requestId;

    if (showStatus) {
      setShareStatus("กำลังเข้าห้อง...");
    }

    try {
      const data = await loadSharedPlanAction(planId);

      if (requestId !== sharedRoomLoadRequestRef.current) {
        return;
      }

      setSharedRoom(planId, data.name, data.plans ?? [{ id: "main", name: data.name, courses: data.courses }], data.updatedAt, editToken);
      setRoomCodeInput(planId);
      if (updateUrl) {
        window.history.replaceState(null, "", `?room=${planId}`);
      }
      if (showStatus) {
        setShareStatus(editToken ? `เข้าห้อง ${planId} แล้ว` : `เข้าห้อง ${planId} แล้ว โหมดดูอย่างเดียว`);
      }
    } catch (error) {
      if (requestId !== sharedRoomLoadRequestRef.current) {
        return;
      }

      setShareStatus(error instanceof Error ? error.message : "เข้าห้องไม่สำเร็จ");
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
      const data = await saveSharedPlanAction(planId, {
        name,
        courses: roomPlans[0]?.courses ?? [],
        plans: roomPlans,
        editToken,
        updatedAt,
      });

      if (showStatus) {
        setShareStatus("บันทึกห้องแล้ว");
      }
      return data;
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
        const data = await loadSharedPlanAction(shareSession.shareId);

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
      aStats: planStats(comparePlanA.courses),
      bStats: planStats(comparePlanB.courses),
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

    courses.forEach((course, index) => {
      courses.slice(index + 1).forEach((next) => {
        if (overlaps(course, next)) {
          ids.add(course.id);
          ids.add(next.id);
        }
      });
    });

    return ids;
  }, [courses]);

  useEffect(() => {
    if (!isManualCourseOpen && !isCourseBrowserOpen) {
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

      setIsManualCourseOpen(false);
      setEditingId(null);
      setForm(emptyCourse);
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isCourseBrowserOpen, isManualCourseOpen]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      setTimetableView("list");
    }
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

    return () => observer.disconnect();
  }, [timetableView]);

  useEffect(() => {
    const nav = document.querySelector(".rail-nav");
    const tab = nav?.querySelector<HTMLElement>(".rail-tab.is-active");

    if (!nav || !tab || nav.scrollWidth <= nav.clientWidth) {
      return;
    }

    nav.scrollTo({ left: tab.offsetLeft - nav.clientWidth / 2 + tab.offsetWidth / 2, behavior: "smooth" });
  }, [activeZone]);

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

    updateActiveCourses((current) =>
      editingId ? current.map((course) => (course.id === editingId ? nextCourse : course)) : [...current, nextCourse],
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

    updateActiveCourses((current) => current.filter((course) => course.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyCourse);
    }
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

  function toggleCourseLocked(id: string) {
    if (!canEditActivePlan) {
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
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
  }

  async function enterSharedRoom(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const roomCode = normalizeRoomCode(roomCodeInput);

    if (!roomCode) {
      setShareStatus("กรอกรหัสห้องก่อน");
      return;
    }

    setRoomCodeInput(roomCode);
    await loadSharedPlan(roomCode, true, roomCode, true);
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
    context.fillStyle = "#0d2e5e";
    context.fillRect(0, 0, width, height);

    context.fillStyle = "#ffffff";
    context.font = '700 32px "Chakra Petch", "Leelawadee UI", "Segoe UI", sans-serif';
    context.fillText(activePlan?.name || defaultPlanName, padding, padding + 34);
    context.fillStyle = "#4da7e6";
    context.font = '500 17px "Chakra Petch", "Leelawadee UI", "Segoe UI", sans-serif';
    context.fillText(`${courses.length} วิชา · ${totalCredits} หน่วยกิต · สร้างจาก TableLearn`, padding, padding + 66);

    const gridX = padding;
    const gridY = padding + titleHeight;
    const gridWidth = leftWidth + hours.length * hourWidth;
    const gridHeight = headerHeight + days.length * rowHeight;

    context.fillStyle = "#f5f7f9";
    context.fillRect(gridX, gridY, gridWidth, gridHeight);
    context.strokeStyle = "#c3cad2";
    context.lineWidth = 1;
    context.strokeRect(gridX, gridY, gridWidth, gridHeight);

    const skyX = gridX + leftWidth;
    const skyY = gridY + headerHeight;
    const skyHeight = gridHeight - headerHeight;
    const sky = context.createLinearGradient(0, skyY, 0, skyY + skyHeight);
    sky.addColorStop(0, "#5fb2e9");
    sky.addColorStop(0.45, "#4da7e6");
    sky.addColorStop(1, "#3d97d8");
    context.fillStyle = sky;
    context.fillRect(skyX, skyY, gridWidth - leftWidth, skyHeight);

    context.fillStyle = "#0d2e5e";
    context.fillRect(gridX, gridY, gridWidth, headerHeight);
    context.fillStyle = "#e9edf1";
    context.fillRect(gridX, gridY + headerHeight, leftWidth, gridHeight - headerHeight);

    context.font = '600 14px "Chakra Petch", "Leelawadee UI", "Segoe UI", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#4da7e6";
    context.fillText("วัน / เวลา", gridX + leftWidth / 2, gridY + headerHeight / 2);
    context.fillStyle = "#e6edf6";

    hours.forEach((hour, index) => {
      const x = gridX + leftWidth + index * hourWidth;
      context.fillText(`${String(hour).padStart(2, "0")}:00`, x + hourWidth / 2, gridY + headerHeight / 2);
    });

    context.fillStyle = "#0d2e5e";
    days.forEach((day, index) => {
      const y = gridY + headerHeight + index * rowHeight;
      context.fillText(day.label, gridX + leftWidth / 2, y + rowHeight / 2);
    });

    for (let index = 0; index <= hours.length; index += 1) {
      const x = gridX + leftWidth + index * hourWidth;
      context.strokeStyle = "rgba(255, 255, 255, 0.4)";
      context.beginPath();
      context.moveTo(x, skyY);
      context.lineTo(x, gridY + gridHeight);
      context.stroke();
    }

    for (let index = 0; index <= days.length; index += 1) {
      const y = gridY + headerHeight + index * rowHeight;
      context.strokeStyle = "#c3cad2";
      context.beginPath();
      context.moveTo(gridX, y);
      context.lineTo(gridX + leftWidth, y);
      context.stroke();
      context.strokeStyle = "rgba(255, 255, 255, 0.4)";
      context.beginPath();
      context.moveTo(skyX, y);
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

      const notch = 10;

      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + blockWidth - notch, y);
      context.lineTo(x + blockWidth, y + notch);
      context.lineTo(x + blockWidth, y + blockHeight);
      context.lineTo(x, y + blockHeight);
      context.closePath();
      context.save();
      context.shadowColor = "rgba(6, 32, 63, 0.34)";
      context.shadowBlur = 6;
      context.shadowOffsetY = 2;
      context.fillStyle = "#ffffff";
      context.fill();
      context.restore();
      context.save();
      context.clip();
      const stone = context.createLinearGradient(0, y, 0, y + blockHeight);
      stone.addColorStop(0, "#ffffff");
      stone.addColorStop(1, "#e7ecf1");
      context.fillStyle = stone;
      context.fillRect(x, y, blockWidth, blockHeight);
      context.fillStyle = course.color;
      context.fillRect(x, y, 7, blockHeight);
      context.restore();

      context.fillStyle = course.color;
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.font = '700 15px "Azeret Mono", ui-monospace, monospace';
      drawWrappedText(context, course.code, x + 16, y + 24, blockWidth - 26, 18, 1);
      context.fillStyle = "#0d2e5e";
      context.font = '600 13px "Chakra Petch", "Leelawadee UI", "Segoe UI", sans-serif';
      drawWrappedText(context, course.name, x + 16, y + 46, blockWidth - 26, 17, 2);
      context.fillStyle = "#4a5f7d";
      context.font = '500 12px "Chakra Petch", "Leelawadee UI", "Segoe UI", sans-serif';
      drawWrappedText(context, course.teacher, x + 16, y + blockHeight - 30, blockWidth - 26, 16, 1);
      context.font = '500 12px "Azeret Mono", ui-monospace, monospace';
      drawWrappedText(context, `${course.start}-${course.end} ${course.room}`, x + 16, y + blockHeight - 14, blockWidth - 26, 16, 1);
    });

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
      setShareStatus("ห้องนี้ดูได้อย่างเดียว จึงแก้ตารางไม่ได้");
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
    <div className="quarry">
      <div className="grain" aria-hidden="true" />

      <aside className="rail">
        <div className="rail-mark">
          <span className="mark-glyph" aria-hidden="true"><IconBlock /></span>
          <span className="mark-words">
            <span className="mark-name">TableLearn</span>
            <span className="mark-sub">ผู้ช่วยจัดตารางเรียน มจพ.</span>
          </span>
        </div>

        <button type="button" className="btn btn-primary rail-cta" onClick={() => setIsCourseBrowserOpen(true)}>
          ดึงรายวิชาจากเว็บ
          <IconArrow />
        </button>

        <nav className="rail-nav" aria-label="ส่วนของหน้า">
          {zones.map((zone) => (
            <a
              key={zone.id}
              href={`#${zone.id}`}
              className={activeZone === zone.id ? "rail-tab is-active" : "rail-tab"}
              aria-current={activeZone === zone.id ? "true" : undefined}
            >
              <zone.Icon />
              <span className="tab-long">{zone.label}</span>
              <span className="tab-short">{zone.short}</span>
            </a>
          ))}
        </nav>

        <div className="readout" aria-label="สรุปตารางเรียน">
          <p className="readout-head">แผ่นงานปัจจุบัน</p>
          <p className="readout-plan">{activePlan?.name ?? defaultPlanName}</p>
          <dl className="measures">
            <div>
              <dt>รายวิชา</dt>
              <dd>{courses.length}<i>วิชา</i></dd>
            </div>
            <div>
              <dt>หน่วยกิต</dt>
              <dd>{totalCredits}<i>นก.</i></dd>
            </div>
            <div className={conflicts.length > 0 ? "is-fracture" : undefined}>
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
        <section className="zone zone-face" id="face" aria-labelledby="face-title">
          <div className="zone-head">
            <h1 id="face-title">หน้าตัดสัปดาห์</h1>
            <p>ทุกวิชาที่ลงคือบล็อกที่ตัดออกจากสัปดาห์ ช่องฟ้าที่เหลือคือเวลาว่างของคุณ</p>
          </div>

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
              <button type="button" className="btn btn-line" onClick={addPlan}>
                <IconPlus />
                เพิ่มตาราง
              </button>
              <button type="button" className="btn btn-line btn-fracture" onClick={removePlan} disabled={!canRemoveCurrentPlan}>
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
              <button type="button" className="btn btn-line" onClick={exportExcel} disabled={courses.length === 0}>ส่งออก Excel</button>
            </div>
            <div className="view-toggle" role="group" aria-label="มุมมองตาราง">
              <button
                type="button"
                className={timetableView === "grid" ? "is-on" : undefined}
                onClick={() => setTimetableView("grid")}
                aria-pressed={timetableView === "grid"}
              >
                หน้าตัด
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

          {(isActiveReadOnlySharedPlan || conflicts.length > 0 || examWarnings.length > 0) && (
            <div className="weather" role="status">
              {isActiveReadOnlySharedPlan && (
                <p className="weather-row">
                  <IconAnchor />
                  ห้องนี้เป็นโหมดดูอย่างเดียว จึงเพิ่ม ลบ หรือแก้รายวิชาไม่ได้
                </p>
              )}
              {conflicts.length > 0 && (
                <p className="weather-row is-fracture">
                  <IconNote />
                  พบเวลาชนกัน {conflicts.length} คู่ ตรวจรายวิชาที่ทับซ้อนในตาราง
                </p>
              )}
              {examWarnings.length > 0 && (
                <p className="weather-row is-storm">
                  <IconStorm />
                  พบความเสี่ยงตารางสอบ {examWarnings.length} รายการ
                </p>
              )}
            </div>
          )}

          {timetableView === "grid" ? (
            <div className="face-scroll">
              <div className="timetable">
                <div className="corner">วัน / เวลา</div>
                {hours.map((hour) => (
                  <div className="time-head" key={hour}>{String(hour).padStart(2, "0")}:00</div>
                ))}
                {days.map((day) => (
                  <DayRow key={day.key} day={day} courses={courses} conflictIds={conflictIds} />
                ))}
              </div>
            </div>
          ) : (
            <div className="day-list">
              {dailyCourses.map((day) => (
                <DayList key={day.key} day={day} conflictIds={conflictIds} />
              ))}
            </div>
          )}
        </section>

        <section className="zone" id="blocks" aria-labelledby="blocks-title">
          <div className="zone-head">
            <h2 id="blocks-title">รายวิชาที่บันทึก</h2>
            <p>บล็อกทั้งหมดที่ตัดไว้ในแผ่นงานนี้ ล็อกไว้เพื่อกันไม่ให้ตัวช่วยจัดแผนสลับ section</p>
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
              <button type="button" className="btn btn-line btn-fracture" onClick={removeAllCourses} disabled={courses.length === 0 || !canEditActivePlan}>
                ลบทั้งหมด
              </button>
            </div>
          </div>

          {courses.length === 0 ? (
            <p className="empty">ยังไม่มีรายวิชา ดึงรายวิชาจากเว็บหรือเพิ่มด้วยตนเองเพื่อเริ่มจัดตาราง</p>
          ) : (
            <div className="block-list">
              {courses.map((course) => (
                <article
                  className={conflictIds.has(course.id) ? "cut-block is-fracture" : "cut-block"}
                  key={course.id}
                  style={{ ["--cut" as string]: course.color }}
                >
                  <header>
                    <span className="cut-code">{course.code}</span>
                    {course.locked && <span className="tag tag-anchor"><IconAnchor />ล็อก</span>}
                    {conflictIds.has(course.id) && <span className="tag tag-fracture">ชนกัน</span>}
                  </header>
                  <p className="cut-name">{course.name}</p>
                  <dl className="cut-measures">
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
                    <button type="button" onClick={() => toggleCourseLocked(course.id)} disabled={!canEditActivePlan}>
                      {course.locked ? "ปลดล็อก" : "ล็อก"}
                    </button>
                    <button type="button" onClick={() => editCourse(course)} disabled={!canEditActivePlan}>แก้ไข</button>
                    <button type="button" className="is-fracture" onClick={() => removeCourse(course.id)} disabled={!canEditActivePlan}>ลบ</button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="zone" id="planner" aria-labelledby="planner-title">
          <div className="zone-head">
            <h2 id="planner-title">ตัวช่วยจัดแผน</h2>
            <p>เลือกหลาย section จากรายวิชาที่โหลด แล้วให้ระบบสร้างแผนที่ไม่ชนกับวิชาในตารางปัจจุบัน</p>
            <div className="zone-actions">
              <button type="button" className="btn btn-primary" onClick={generateSchedulePlans} disabled={remoteCourseGroups.length === 0}>
                สร้างแผนที่เป็นไปได้
                <IconArrow />
              </button>
            </div>
          </div>

          <div className="bench-grid">
            <div className="bench">
              <h3>รายวิชาที่โหลด</h3>
              {remoteCourseGroups.length === 0 ? (
                <p className="empty">โหลดรายวิชา KMUTNB ก่อน แล้วเลือกวิชาที่ต้องการให้ช่วยจัด section</p>
              ) : (
                <div className="pick-list">
                  {remoteCourseGroups.slice(0, 18).map((group) => (
                    <div className="pick-row" key={group.code}>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={plannerSelectedCodes.includes(group.code)}
                          onChange={() => togglePlannerCode(group.code)}
                        />
                        <span className="check-box" aria-hidden="true" />
                        <span className="check-text">
                          <b>{group.code}</b>
                          {group.name} · {group.classes.length} section
                        </span>
                      </label>
                      <button type="button" className="btn btn-quiet" onClick={() => importRemoteCourseGroup(group)} disabled={!canEditActivePlan}>
                        เพิ่ม
                      </button>
                    </div>
                  ))}
                </div>
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
                  {generatedPlans.map((plan) => (
                    <article className="plan-result" key={plan.id}>
                      <div className="plan-score">
                        <b>{plan.score}</b>
                        <i>/100</i>
                      </div>
                      <div className="plan-body">
                        <strong>{plan.name}</strong>
                        <span><b>{plan.courses.length}</b> รายการ</span>
                        <small>{plan.reasons.join(" · ")}</small>
                      </div>
                      <button type="button" className="btn btn-line" onClick={() => applyGeneratedPlan(plan)}>ใช้แผนนี้</button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="zone" id="compare" aria-labelledby="compare-title">
          <div className="zone-head">
            <h2 id="compare-title">เปรียบเทียบ 2 แผน</h2>
            <p>ดูคะแนนพื้นฐาน วันเรียน หน่วยกิต เวลาว่าง และรายวิชาที่ต่างกัน</p>
          </div>

          <div className="compare-bar">
            <label className="field field-select">
              <span>แผน A</span>
              <select value={comparePlanA?.id ?? ""} onChange={(event) => setComparePlanAId(event.target.value)}>
                {visiblePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </label>
            <label className="field field-select">
              <span>แผน B</span>
              <select value={comparePlanB?.id ?? ""} onChange={(event) => setComparePlanBId(event.target.value)}>
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
                    <td>{aValue}<i>{unit}</i></td>
                    <td>{bValue}<i>{unit}</i></td>
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
          <section className="zone" id="voids" aria-labelledby="voids-title">
            <div className="zone-head">
              <h2 id="voids-title">เวลาว่าง</h2>
              <p>ช่องฟ้าที่เหลือหลังตัดบล็อกในแต่ละวัน</p>
            </div>
            {freeSlots.length === 0 ? (
              <p className="empty">ยังไม่มีข้อมูลเวลาว่างจากตารางปัจจุบัน</p>
            ) : (
              <ul className="void-list">
                {freeSlots.map((slot) => (
                  <li className="void-item" key={`${slot.day}-${slot.start}-${slot.end}`}>
                    <span className="void-day">{slot.label}</span>
                    <span className="void-span">{slot.start}–{slot.end}</span>
                    <span className="void-len">{Math.round(slot.minutes / 60 * 10) / 10}<i>ชม.</i></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="zone" id="exams" aria-labelledby="exams-title">
            <div className="zone-head">
              <h2 id="exams-title">ตารางสอบ</h2>
              <p>วันสอบกลางภาคและปลายภาคของทุกวิชาในแผ่นงานนี้</p>
            </div>
            {examWarnings.length > 0 && (
              <ul className="storm-list">
                {examWarnings.map((warning) => (
                  <li key={warning}>
                    <IconStorm />
                    {warning}
                  </li>
                ))}
              </ul>
            )}
            {courses.filter((course) => course.midterm || course.final).length === 0 ? (
              <p className="empty">ยังไม่ได้กรอกเวลาสอบ</p>
            ) : (
              <ul className="exam-list">
                {courses.filter((course) => course.midterm || course.final).map((course) => (
                  <li className="exam-item" key={course.id} style={{ ["--cut" as string]: course.color }}>
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

        <section className="zone" id="room" aria-labelledby="room-title">
          <div className="zone-head">
            <h2 id="room-title">ห้องตารางร่วมกัน</h2>
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
                    <i key={index} />
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
              <button type="button" className="btn btn-primary room-create" onClick={createSharedRoom}>
                สร้างห้องว่าง
                <IconArrow />
              </button>
              <p className="bench-note">สร้างรหัสใหม่และพาไปตารางห้องเปล่า ไม่ดึงวิชาจากตารางนี้</p>
              <form className="room-join" onSubmit={enterSharedRoom}>
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
                <button type="button" className="btn btn-line" onClick={copyRoomCode} disabled={!shareSession}>
                  <IconCopy />
                  คัดลอกรหัสห้อง
                </button>
                <button type="button" className="btn btn-line" onClick={() => shareSession && loadSharedPlan(shareSession.shareId, true, shareSession.editToken)} disabled={!shareSession}>โหลดล่าสุด</button>
                <button type="button" className="btn btn-line" onClick={() => leaveSharedMode()} disabled={!shareSession}>ออกจากห้อง</button>
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
          onClick={() => {
            setIsManualCourseOpen(false);
            setEditingId(null);
            setForm(emptyCourse);
          }}
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

      {isCourseBrowserOpen && (
        <div className="scrim" role="presentation" onClick={() => setIsCourseBrowserOpen(false)}>
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
              <button type="button" className="btn btn-icon" aria-label="ปิด" onClick={() => setIsCourseBrowserOpen(false)}>
                <IconClose />
              </button>
            </div>

            <div className="dialog-body">
              <div className="filter-grid">
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

              <div className="dialog-run">
                <button className="btn btn-primary" type="button" onClick={loadRemoteClasses} disabled={isLoadingClasses}>
                  {isLoadingClasses ? "กำลังโหลด..." : "โหลดรายวิชา KMUTNB"}
                  <IconArrow />
                </button>
                <div ref={remoteResultsRef} className="dialog-run-status">
                  {remoteClasses.length > 0 && (
                    <p className="status-line">แสดง {filteredRemoteClasses.length} จาก {remoteClasses.length} รายการ</p>
                  )}
                </div>
              </div>

              {filterError && <p className="status-line is-fracture">{filterError}</p>}
              {classError && <p className="status-line is-fracture">{classError}</p>}
              {hasLoadedClasses && !classError && remoteClasses.length === 0 && (
                <p className="empty">ไม่พบรายวิชาตามเงื่อนไขที่เลือก ลองปรับคณะ ภาควิชา หรือรหัสวิชาแล้วโหลดอีกครั้ง</p>
              )}
              {remoteClasses.length > 0 && filteredRemoteClasses.length === 0 && (
                <p className="empty">ไม่พบรายวิชาที่ตรงกับรหัสวิชา “{courseSearch}”</p>
              )}

              {filteredRemoteClasses.length > 0 && (
                <ul className="quarry-face-list">
                  {filteredRemoteClasses.map((remoteClass) => {
                    const parsedTime = parseClassTime(remoteClass.classtime);
                    const dayLabel = days.find((day) => day.key === parsedTime.day)?.label ?? "";
                    const isPicked = plannerSelectedCodes.includes(remoteClass.coursecode);

                    return (
                      <li className="raw-block" key={remoteClass.classid}>
                        <div className="raw-head">
                          <span className="raw-code">{remoteClass.coursecode}</span>
                          <span className="raw-section">S.{remoteClass.sectioncode}</span>
                        </div>
                        <p className="raw-name">{remoteClass.coursename}</p>
                        <dl className="cut-measures">
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
                        <div className="raw-actions">
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
                            onClick={() => togglePlannerCode(remoteClass.coursecode)}
                          >
                            {isPicked ? "เอาออกจากตัวช่วยจัดแผน" : "เลือกเข้าตัวช่วยจัดแผน"}
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
    </div>
  );
}


function DayRow({ day, courses, conflictIds }: { day: (typeof days)[number]; courses: Course[]; conflictIds: Set<string> }) {
  const dayStart = hours[0] * 60;
  const dayEnd = (hours[hours.length - 1] + 1) * 60;
  const dayMinutes = dayEnd - dayStart;
  const laneHeight = 88;
  const laneGap = 5;
  const lanes: number[] = [];
  const positionedCourses = courses
    .filter((course) => course.day === day.key && toMinutes(course.start) < dayEnd && toMinutes(course.end) > dayStart)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || toMinutes(a.end) - toMinutes(b.end))
    .map((course) => {
      const start = Math.max(dayStart, toMinutes(course.start));
      const end = Math.min(dayEnd, toMinutes(course.end));
      let lane = lanes.findIndex((laneEnd) => laneEnd <= start);

      if (lane === -1) {
        lane = lanes.length;
        lanes.push(end);
      } else {
        lanes[lane] = end;
      }

      return {
        course,
        lane,
        left: ((start - dayStart) / dayMinutes) * 100,
        width: ((end - start) / dayMinutes) * 100,
      };
    });
  const laneCount = Math.max(1, lanes.length);
  const rowHeight = positionedCourses.length === 0 ? 62 : 12 + laneCount * laneHeight + (laneCount - 1) * laneGap;

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
            className={conflictIds.has(course.id) ? "block is-fracture" : "block"}
            key={course.id}
            style={{
              ["--cut" as string]: course.color,
              left: `${left}%`,
              top: 6 + lane * (laneHeight + laneGap),
              width: `${width}%`,
            }}
          >
            <span className="block-code">
              {course.code}
              {course.locked && <IconAnchor className="ico-sm" />}
            </span>
            <span className="block-name">{course.name}</span>
            {course.teacher && <span className="block-teacher">{course.teacher}</span>}
            <span className="block-time">
              <time>{course.start}–{course.end}</time>
              {course.room && <em>{course.room}</em>}
            </span>
          </article>
        ))}
      </div>
    </>
  );
}

function CourseDifference({ course }: { course: Course }) {
  return (
    <div className="diff-block" style={{ ["--cut" as string]: course.color }}>
      <span className="diff-code">{course.code}</span>
      <span className="diff-name">{course.name}</span>
      <span className="diff-when">
        <b>{days.find((day) => day.key === course.day)?.label}</b>
        <time>{course.start}–{course.end}</time>
      </span>
    </div>
  );
}

function DayList({ day, conflictIds }: { day: (typeof days)[number] & { courses: Course[] }; conflictIds: Set<string> }) {
  return (
    <section className="day-strata">
      <h3>
        <b>{day.short}</b>
        {day.label}
      </h3>
      {day.courses.length === 0 ? (
        <p className="day-void">ไม่มีเรียน · ว่างทั้งวัน</p>
      ) : (
        <div className="day-strata-body">
          {day.courses.map((course, index) => {
            const nextCourse = day.courses[index + 1];
            const gapMinutes = nextCourse ? toMinutes(nextCourse.start) - toMinutes(course.end) : 0;

            return (
              <div key={course.id}>
                <article
                  className={conflictIds.has(course.id) ? "strata-block is-fracture" : "strata-block"}
                  style={{ ["--cut" as string]: course.color }}
                >
                  <span className="strata-time">{course.start}<i>{course.end}</i></span>
                  <span className="strata-body">
                    <b>{course.code}</b>
                    <span>{course.name}</span>
                    <small>{course.room || "-"} · {course.teacher || "-"} · {course.credits} หน่วยกิต{course.locked ? " · ล็อกไว้" : ""}</small>
                  </span>
                </article>
                {gapMinutes > 0 && (
                  <p className="strata-gap">
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
