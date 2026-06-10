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
};

type TimetablePlan = {
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
const defaultPlanName = "ตารางเรียนหลัก";
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

export default function Home() {
  const [plans, setPlans] = useState<TimetablePlan[]>(() => {
    if (typeof window === "undefined") {
      return [{ id: "default", name: defaultPlanName, courses: [] }];
    }

    const savedPlans = readJson<TimetablePlan[] | null>("student-timetable-plans", null);
    if (savedPlans) {
      return savedPlans;
    }

    const saved = readJson<Course[]>("student-timetable", []);
    return [{ id: "default", name: defaultPlanName, courses: saved }];
  });
  const [activePlanId, setActivePlanId] = useState(() => {
    if (typeof window === "undefined") {
      return "default";
    }

    return window.localStorage.getItem("student-timetable-active-plan") ?? "default";
  });
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
  const [excelStatus, setExcelStatus] = useState("");
  const [lastSharedUpdatedAt, setLastSharedUpdatedAt] = useState("");
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const lastSharedUpdatedAtRef = useRef("");
  const sharedEditTokenRef = useRef("");
  const skipNextSharedSaveRef = useRef(false);

  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? plans[0];
  const currentPlanId = activePlan?.id ?? activePlanId;
  const courses = activePlan?.courses ?? noCourses;

  const setSharedPlan = useCallback((planId: string, planName: string, planCourses: Course[], updatedAt = "", editToken = sharedEditTokenRef.current) => {
    const localId = `shared-${planId}`;
    setPlans((currentPlans) => {
      const nextPlan = { id: localId, name: planName, courses: planCourses };
      const existing = currentPlans.some((plan) => plan.id === localId);

      return existing ? currentPlans.map((plan) => (plan.id === localId ? nextPlan : plan)) : [...currentPlans, nextPlan];
    });
    setActivePlanId(localId);
    setSharedPlanId(planId);
    setSharedEditToken(editToken);
    sharedEditTokenRef.current = editToken;
    if (updatedAt) {
      skipNextSharedSaveRef.current = true;
      lastSharedUpdatedAtRef.current = updatedAt;
      setLastSharedUpdatedAt(updatedAt);
    }
    setShareUrl(`${window.location.origin}${window.location.pathname}?share=${planId}${editToken ? `&edit=${editToken}` : ""}`);
  }, []);

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

      if (showStatus) {
        setShareStatus("บันทึกตารางแชร์แล้ว");
      }
      return true;
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "บันทึกตารางแชร์ไม่สำเร็จ");
      return false;
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("student-timetable-plans", JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    window.localStorage.setItem("student-timetable-active-plan", currentPlanId);
  }, [currentPlanId]);

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
    if (!sharedPlanId || !sharedEditToken || !activePlan) {
      return;
    }

    if (skipNextSharedSaveRef.current) {
      skipNextSharedSaveRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      saveSharedPlan(sharedPlanId, sharedEditToken, activePlan.name, courses, false);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [activePlan, courses, saveSharedPlan, sharedEditToken, sharedPlanId]);

  useEffect(() => {
    if (!sharedPlanId) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const data = await loadSharedPlanAction(sharedPlanId);

        if (data.updatedAt && data.updatedAt !== lastSharedUpdatedAtRef.current) {
          setSharedPlan(sharedPlanId, data.name, data.courses, data.updatedAt);
          setShareStatus("อัปเดตตารางล่าสุดแล้ว");
        }
      } catch (error) {
        setShareStatus(error instanceof Error ? error.message : "ซิงก์ตารางแชร์ไม่สำเร็จ");
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [setSharedPlan, sharedPlanId]);

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

  function submitCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    updateActiveCourses((current) => current.filter((course) => course.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyCourse);
    }
  }

  function updateActiveCourses(updater: (current: Course[]) => Course[]) {
    setPlans((currentPlans) =>
      currentPlans.map((plan) => (plan.id === currentPlanId ? { ...plan, courses: updater(plan.courses) } : plan)),
    );
  }

  function addPlan() {
    const nextPlan: TimetablePlan = {
      id: crypto.randomUUID(),
      name: `ตารางเรียน ${plans.length + 1}`,
      courses: [],
    };

    setPlans((currentPlans) => [...currentPlans, nextPlan]);
    setActivePlanId(nextPlan.id);
    setEditingId(null);
    setForm(emptyCourse);
    setIsManualCourseOpen(false);
  }

  function renamePlan(name: string) {
    setPlans((currentPlans) =>
      currentPlans.map((plan) => (plan.id === currentPlanId ? { ...plan, name } : plan)),
    );
  }

  function removePlan() {
    if (plans.length <= 1) {
      return;
    }

    const nextPlans = plans.filter((plan) => plan.id !== currentPlanId);
    setPlans(nextPlans);
    setActivePlanId(nextPlans[0].id);
    setEditingId(null);
    setForm(emptyCourse);
  }

  async function createShareLink() {
    const planId = crypto.randomUUID().slice(0, 8);
    const editToken = createEditToken();
    const name = activePlan?.name || defaultPlanName;

    const saved = await saveSharedPlan(planId, editToken, name, courses);
    if (!saved) {
      return;
    }

    setSharedPlan(planId, name, courses, lastSharedUpdatedAtRef.current, editToken);
    window.history.replaceState(null, "", `?share=${planId}&edit=${editToken}`);
  }

  async function copyShareLink() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    setShareStatus("คัดลอกลิงก์แล้ว");
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

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
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
    const meetings = parseClassMeetings(remoteClass.classtime);
    const color = palette[courses.length % palette.length];
    const importedCourses: Course[] = (meetings.length > 0 ? meetings : [parseClassTime(remoteClass.classtime)]).map((meeting, index, allMeetings) => ({
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

    updateActiveCourses((current) => [...current, ...importedCourses]);
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

      <section className="control-grid">
        <div className="plan-bar panel">
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
            <input value={activePlan?.name ?? ""} onChange={(event) => renamePlan(event.target.value)} />
          </label>
          <div className="button-row">
            <button type="button" className="primary" onClick={() => setIsCourseBrowserOpen(true)}>ดึงรายวิชาจากเว็บ</button>
            <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(emptyCourse); setIsManualCourseOpen(true); }}>เพิ่มด้วยตนเอง</button>
            <button type="button" className="secondary" onClick={addPlan}>เพิ่มตาราง</button>
            <button type="button" className="ghost danger" onClick={removePlan} disabled={plans.length <= 1}>ลบตาราง</button>
          </div>
        </div>

        <div className="share-bar panel">
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
            <button type="button" className="ghost" onClick={copyShareLink} disabled={!shareUrl}>คัดลอกลิงก์</button>
            <button type="button" className="ghost" onClick={() => sharedPlanId && loadSharedPlan(sharedPlanId)} disabled={!sharedPlanId}>โหลดล่าสุด</button>
          </div>
          {shareStatus && <span>{shareStatus}</span>}
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

      <section className="workspace">
        <section className="board">
          <div className="board-head">
            <div>
              <h2>{activePlan?.name ?? defaultPlanName}</h2>
              <p>{courses.length} วิชา · {totalCredits} หน่วยกิต</p>
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
              <button type="button" className="ghost" onClick={() => excelInputRef.current?.click()}>Import Excel</button>
              <button type="button" className="ghost" onClick={exportExcel} disabled={courses.length === 0}>Export Excel</button>
            </div>
          </div>
          {conflicts.length > 0 && (
            <div className="alert">
              พบเวลาชนกัน {conflicts.length} คู่ ตรวจรายวิชาที่ทับซ้อนในตาราง
            </div>
          )}

          <div className="timetable">
            <div className="corner">วัน / เวลา</div>
            {hours.map((hour) => (
              <div className="time-head" key={hour}>{String(hour).padStart(2, "0")}:00</div>
            ))}
            {days.map((day) => (
              <DayRow key={day.key} day={day} courses={courses} />
            ))}
          </div>
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
                      >
                        นำเข้าลงตาราง
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
          <h2>รายวิชาที่บันทึก</h2>
          <div className="course-list">
            {courses.length === 0 ? (
              <p className="empty">ยังไม่มีรายวิชา เพิ่มข้อมูลด้านบนเพื่อเริ่มจัดตาราง</p>
            ) : (
              courses.map((course) => (
                <article className="course-card" key={course.id} style={{ borderColor: course.color }}>
                  <div>
                    <strong>{course.code} · {course.name}</strong>
                    <span>{days.find((day) => day.key === course.day)?.label} {course.start}-{course.end} · {course.room}</span>
                    <span>{course.teacher} · {course.credits} หน่วยกิต</span>
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => editCourse(course)}>แก้ไข</button>
                    <button type="button" className="danger" onClick={() => removeCourse(course.id)}>ลบ</button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <h2>ตารางสอบ</h2>
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
