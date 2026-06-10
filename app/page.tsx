"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

const palette = ["#2563eb", "#0f766e", "#b45309", "#be123c", "#6d28d9", "#15803d", "#c2410c"];
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

export default function Home() {
  const [plans, setPlans] = useState<TimetablePlan[]>(() => {
    if (typeof window === "undefined") {
      return [{ id: "default", name: defaultPlanName, courses: [] }];
    }

    const savedPlans = window.localStorage.getItem("student-timetable-plans");
    if (savedPlans) {
      return JSON.parse(savedPlans);
    }

    const saved = window.localStorage.getItem("student-timetable");
    return [{ id: "default", name: defaultPlanName, courses: saved ? JSON.parse(saved) : [] }];
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
  const [classError, setClassError] = useState("");
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
  const [sharedPlanId, setSharedPlanId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? plans[0];
  const currentPlanId = activePlan?.id ?? activePlanId;
  const courses = activePlan?.courses ?? noCourses;

  const setSharedPlan = useCallback((planId: string, planName: string, planCourses: Course[]) => {
    const localId = `shared-${planId}`;
    setPlans((currentPlans) => {
      const nextPlan = { id: localId, name: planName, courses: planCourses };
      const existing = currentPlans.some((plan) => plan.id === localId);

      return existing ? currentPlans.map((plan) => (plan.id === localId ? nextPlan : plan)) : [...currentPlans, nextPlan];
    });
    setActivePlanId(localId);
    setSharedPlanId(planId);
    setShareUrl(`${window.location.origin}${window.location.pathname}?share=${planId}`);
  }, []);

  const loadSharedPlan = useCallback(async (planId: string, showStatus = true) => {
    if (showStatus) {
      setShareStatus("กำลังโหลดตารางแชร์...");
    }

    try {
      const data = await loadSharedPlanAction(planId);

      setSharedPlan(planId, data.name, data.courses);
      if (showStatus) {
        setShareStatus("โหลดตารางแชร์แล้ว");
      }
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "โหลดตารางแชร์ไม่สำเร็จ");
    }
  }, [setSharedPlan]);

  const saveSharedPlan = useCallback(async (planId: string, name: string, planCourses: Course[], showStatus = true) => {
    if (showStatus) {
      setShareStatus("กำลังบันทึกตารางแชร์...");
    }

    try {
      await saveSharedPlanAction(planId, { name, courses: planCourses });

      if (showStatus) {
        setShareStatus("บันทึกตารางแชร์แล้ว");
      }
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "บันทึกตารางแชร์ไม่สำเร็จ");
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

    if (sharedId) {
      const timeout = window.setTimeout(() => {
        loadSharedPlan(sharedId);
      }, 0);

      return () => window.clearTimeout(timeout);
    }
  }, [loadSharedPlan]);

  useEffect(() => {
    if (!sharedPlanId || !activePlan) {
      return;
    }

    const timeout = window.setTimeout(() => {
      saveSharedPlan(sharedPlanId, activePlan.name, courses, false);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [activePlan, courses, saveSharedPlan, sharedPlanId]);

  useEffect(() => {
    if (!sharedPlanId) {
      return;
    }

    const interval = window.setInterval(() => {
      loadSharedPlan(sharedPlanId, false);
    }, 8000);

    return () => window.clearInterval(interval);
  }, [loadSharedPlan, sharedPlanId]);

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
    const name = activePlan?.name || defaultPlanName;

    await saveSharedPlan(planId, name, courses);
    setSharedPlan(planId, name, courses);
    window.history.replaceState(null, "", `?share=${planId}`);
  }

  async function copyShareLink() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    setShareStatus("คัดลอกลิงก์แล้ว");
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const coursesSheet = XLSX.utils.json_to_sheet(
      courses.map((course) => ({
        "รหัสวิชา": course.code,
        "ชื่อวิชา": course.name,
        "หน่วยกิต": course.credits,
        "วันเรียน": days.find((day) => day.key === course.day)?.label ?? course.day,
        "เวลาเริ่ม": course.start,
        "เวลาสิ้นสุด": course.end,
        "ห้อง": course.room,
        "อาจารย์": course.teacher,
        "สอบกลางภาค": examText(course.midterm),
        "สอบปลายภาค": examText(course.final),
      })),
    );
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
    const timetableSheet = XLSX.utils.json_to_sheet(timetableRows);
    const examsSheet = XLSX.utils.json_to_sheet(
      courses
        .filter((course) => course.midterm || course.final)
        .map((course) => ({
          "รหัสวิชา": course.code,
          "ชื่อวิชา": course.name,
          "สอบกลางภาค": examText(course.midterm),
          "สอบปลายภาค": examText(course.final),
        })),
    );

    XLSX.utils.book_append_sheet(workbook, coursesSheet, "Courses");
    XLSX.utils.book_append_sheet(workbook, timetableSheet, "Timetable");
    XLSX.utils.book_append_sheet(workbook, examsSheet, "Exams");
    XLSX.writeFile(workbook, `${activePlan?.name || "timetable"}.xlsx`);
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

      setRemoteClasses(data);
    } catch (error) {
      setClassError(error instanceof Error ? error.message : "โหลดข้อมูลรายวิชาไม่สำเร็จ");
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
        <div>
          <p className="eyebrow">Student timetable planner</p>
          <h1>ตารางเรียนส่วนตัว</h1>
        </div>
        <div className="summary">
          <span>{courses.length} วิชา</span>
          <strong>{totalCredits} หน่วยกิต</strong>
        </div>
      </section>

      <section className="plan-bar panel">
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
        <button type="button" className="primary" onClick={addPlan}>เพิ่มตาราง</button>
        <button type="button" className="ghost danger" onClick={removePlan} disabled={plans.length <= 1}>ลบตาราง</button>
        <button type="button" className="ghost" onClick={exportExcel} disabled={courses.length === 0}>Export Excel</button>
      </section>

      <section className="share-bar panel">
        <div>
          <h2>แชร์ตารางร่วมกัน</h2>
          <p>{shareUrl || "สร้างลิงก์แชร์เพื่อให้คนอื่นเปิดและแก้ตารางเดียวกันได้"}</p>
        </div>
        <button type="button" className="primary" onClick={createShareLink}>สร้างลิงก์แชร์</button>
        <button type="button" className="ghost" onClick={copyShareLink} disabled={!shareUrl}>คัดลอกลิงก์</button>
        <button type="button" className="ghost" onClick={() => sharedPlanId && loadSharedPlan(sharedPlanId)} disabled={!sharedPlanId}>โหลดล่าสุด</button>
        {shareStatus && <span>{shareStatus}</span>}
      </section>

      <section className="workspace">
        <form className="panel form" onSubmit={submitCourse}>
          <div className="panel-title">
            <h2>{editingId ? "แก้ไขรายวิชา" : "เพิ่มรายวิชา"}</h2>
            {editingId && (
              <button type="button" className="ghost" onClick={() => { setEditingId(null); setForm(emptyCourse); }}>
                ยกเลิก
              </button>
            )}
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

        <section className="board">
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

      <section className="remote panel">
        <div className="remote-head">
          <div>
            <h2>ข้อมูลรายวิชา KMUTNB</h2>
            <p>เลือกตัวกรองแล้วกดโหลด ระบบจะดึงข้อมูลจาก regapi ตามค่าที่กำหนด</p>
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
        </div>
        {filterError && <div className="alert">{filterError}</div>}
        {classError && <div className="alert">{classError}</div>}
        {remoteClasses.length > 0 && (
          <p className="remote-count">แสดง {filteredRemoteClasses.length} จาก {remoteClasses.length} รายการ</p>
        )}
        {remoteClasses.length > 0 && filteredRemoteClasses.length === 0 && (
          <p className="empty">ไม่พบรายวิชาที่ตรงกับรหัสวิชา “{courseSearch}”</p>
        )}
        {filteredRemoteClasses.length > 0 && (
          <div className="remote-list">
            {filteredRemoteClasses.map((remoteClass) => {
              const parsedTime = parseClassTime(remoteClass.classtime);

              return (
                <article className="remote-card" key={remoteClass.classid}>
                  <div>
                    <strong>{remoteClass.coursecode} · {remoteClass.coursename} · S.{remoteClass.sectioncode}</strong>
                    <span>{days.find((day) => day.key === parsedTime.day)?.label} {parsedTime.start}-{parsedTime.end} · {parsedTime.room || "-"}</span>
                    <span>{teacherName(remoteClass) || "-"} · {remoteClass.courseunit}</span>
                  </div>
                  <button type="button" onClick={() => importRemoteClass(remoteClass)}>นำเข้า</button>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
