import { parseCourseGroups, type CourseGroup } from "./course-groups.ts";

// ไฟล์ "วิชาในตัวช่วยจัดแผน" สำหรับย้ายเครื่อง ส่งให้เพื่อน หรือสำรองไว้
// เก็บวิชา (พร้อม section), วิชาที่ติ๊ก, section ที่เลือก และกลุ่ม — ไม่เก็บเงื่อนไขเวลา (แต่ละคนตั้งเอง)
export const plannerFileApp = "tablelearn-planner";
export const plannerFileVersion = 1;

export type PlannerClass = { classid: number; coursecode: string } & Record<string, unknown>;
export type PlannerCourse = { code: string; name: string; classes: PlannerClass[] };
export type PlannerSnapshot = {
  pool: PlannerCourse[];
  selectedCodes: string[];
  sectionPicks: Record<string, number[]>;
  groups: CourseGroup[];
};

export function serializePlannerFile(state: PlannerSnapshot, now: Date = new Date()): string {
  return JSON.stringify(
    { app: plannerFileApp, version: plannerFileVersion, exportedAt: now.toISOString(), ...state },
    null,
    2,
  );
}

export function plannerFileName(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `tablelearn-ตัวช่วยจัดแผน-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

function isClass(value: unknown): value is PlannerClass {
  const item = value as Partial<PlannerClass> | null;
  return Boolean(item) && typeof item === "object" && typeof item!.classid === "number" && typeof item!.coursecode === "string";
}

// อ่านไฟล์ที่ผู้ใช้เลือก ไฟล์ที่ไม่ใช่ของเว็บนี้ถูกปฏิเสธทั้งไฟล์ ส่วนที่รูปร่างผิดถูกทิ้งทีละรายการ
export function parsePlannerFile(text: string): { ok: true; data: PlannerSnapshot } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ .json ที่บันทึกจากตัวช่วยจัดแผน" };
  }

  const file = raw as Partial<PlannerSnapshot> & { app?: unknown; version?: unknown };
  if (!file || typeof file !== "object" || file.app !== plannerFileApp) {
    return { ok: false, error: "ไฟล์นี้ไม่ใช่ไฟล์ตัวช่วยจัดแผนของ TableLearn" };
  }
  if (file.version !== plannerFileVersion) {
    return { ok: false, error: "ไฟล์นี้มาจากเวอร์ชันที่เว็บนี้ยังอ่านไม่ได้" };
  }

  const seen = new Set<string>();
  const pool: PlannerCourse[] = [];
  for (const item of Array.isArray(file.pool) ? file.pool : []) {
    const course = item as Partial<PlannerCourse> | null;
    if (!course || typeof course.code !== "string" || seen.has(course.code)) {
      continue;
    }
    seen.add(course.code);
    pool.push({
      code: course.code,
      name: typeof course.name === "string" ? course.name : "",
      classes: Array.isArray(course.classes) ? course.classes.filter(isClass) : [],
    });
  }

  const selectedCodes = (Array.isArray(file.selectedCodes) ? file.selectedCodes : []).filter(
    (code, index, all): code is string => typeof code === "string" && seen.has(code) && all.indexOf(code) === index,
  );

  const sectionPicks: Record<string, number[]> = {};
  if (file.sectionPicks && typeof file.sectionPicks === "object") {
    for (const [code, ids] of Object.entries(file.sectionPicks)) {
      const kept = Array.isArray(ids) ? ids.filter((id): id is number => typeof id === "number") : [];
      if (seen.has(code) && kept.length > 0) {
        sectionPicks[code] = kept;
      }
    }
  }

  return { ok: true, data: { pool, selectedCodes, sectionPicks, groups: parseCourseGroups(file.groups, seen) } };
}

// รวมไฟล์เข้ากับของเดิม: วิชาที่มีอยู่แล้วคงของเดิม, วิชาใหม่พาการติ๊กและ section ที่เลือกมาด้วย,
// วิชาที่อยู่ในกลุ่มของผู้ใช้แล้วอยู่กลุ่มเดิมต่อ, ชื่อกลุ่มซ้ำต่อท้าย "(นำเข้า)", กลุ่มที่ว่างทิ้งไป
export function mergePlannerFile(
  current: PlannerSnapshot,
  incoming: PlannerSnapshot,
  opts: { maxPool: number; newId: () => string },
): { next: PlannerSnapshot; added: number; duplicates: number; skipped: number } {
  const existing = new Set(current.pool.map((course) => course.code));
  const fresh = incoming.pool.filter((course) => !existing.has(course.code));
  const room = Math.max(0, opts.maxPool - current.pool.length);
  const accepted = fresh.slice(0, room);
  const acceptedCodes = new Set(accepted.map((course) => course.code));
  const pool = [...current.pool, ...accepted];
  const poolCodes = new Set(pool.map((course) => course.code));

  const sectionPicks = { ...current.sectionPicks };
  for (const code of acceptedCodes) {
    if (incoming.sectionPicks[code]) {
      sectionPicks[code] = incoming.sectionPicks[code];
    }
  }

  const grouped = new Set(current.groups.flatMap((group) => group.codes));
  // เทียบชื่อกับกลุ่มของผู้ใช้เท่านั้น ชื่อซ้ำกันเองในไฟล์คงไว้ตามที่ผู้บันทึกตั้ง
  const existingNames = new Set(current.groups.map((group) => group.name));
  const usedNames = new Set(existingNames);
  const groups = [...current.groups];
  for (const group of incoming.groups) {
    const codes = group.codes.filter((code) => poolCodes.has(code) && !grouped.has(code));
    if (codes.length === 0) {
      continue;
    }
    codes.forEach((code) => grouped.add(code));
    let name = group.name;
    if (existingNames.has(name)) {
      name = `${group.name} (นำเข้า)`;
      for (let index = 2; usedNames.has(name); index += 1) {
        name = `${group.name} (นำเข้า ${index})`;
      }
    }
    usedNames.add(name);
    groups.push({ id: opts.newId(), name, codes });
  }

  return {
    next: {
      pool,
      selectedCodes: [...current.selectedCodes, ...incoming.selectedCodes.filter((code) => acceptedCodes.has(code))],
      sectionPicks,
      groups,
    },
    added: accepted.length,
    duplicates: incoming.pool.length - fresh.length,
    skipped: fresh.length - accepted.length,
  };
}
