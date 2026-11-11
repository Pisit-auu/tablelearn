// กลุ่มวิชา "เลือก 1 จากกลุ่ม" ของตัวช่วยจัดแผน กลุ่มแค่อ้างถึงรหัสวิชาใน pool วิชายังอยู่ใน pool เสมอ
export type CourseGroup = { id: string; name: string; codes: string[] };

export const maxGroupNameLength = 40;

export function nextGroupName(groups: CourseGroup[]): string {
  const used = new Set(groups.map((group) => group.name));
  let index = 1;
  while (used.has(`กลุ่ม ${index}`)) {
    index += 1;
  }
  return `กลุ่ม ${index}`;
}

// อ่านกลุ่มที่บันทึกไว้ ทิ้งข้อมูลที่รูปร่างผิด ตัดรหัสที่ไม่อยู่ใน pool และรหัสที่ซ้ำกับกลุ่มก่อนหน้า
export function parseCourseGroups(raw: unknown, poolCodes: ReadonlySet<string>): CourseGroup[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const taken = new Set<string>();
  const groups: CourseGroup[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const { id, name, codes } = item as Partial<CourseGroup>;
    if (typeof id !== "string" || typeof name !== "string") {
      continue;
    }

    const kept = (Array.isArray(codes) ? codes : []).filter(
      (code): code is string => typeof code === "string" && poolCodes.has(code) && !taken.has(code),
    );
    kept.forEach((code) => taken.add(code));
    groups.push({ id, name: name.slice(0, maxGroupNameLength), codes: kept });
  }

  return groups;
}

export function moveCodeToGroup(groups: CourseGroup[], code: string, groupId: string | null): CourseGroup[] {
  if (groupId !== null && !groups.some((group) => group.id === groupId)) {
    return groups;
  }

  return groups.map((group) => {
    const without = group.codes.filter((item) => item !== code);
    return group.id === groupId ? { ...group, codes: [...without, code] } : without.length === group.codes.length ? group : { ...group, codes: without };
  });
}

export function renameGroup(groups: CourseGroup[], id: string, name: string): CourseGroup[] {
  const trimmed = name.trim().slice(0, maxGroupNameLength);
  if (!trimmed) {
    return groups;
  }

  return groups.map((group) => (group.id === id ? { ...group, name: trimmed } : group));
}

export function removeGroup(groups: CourseGroup[], id: string): CourseGroup[] {
  return groups.filter((group) => group.id !== id);
}

// ตัดรหัสที่หลุดจาก pool ออก กลุ่มที่ว่างแล้วยังเก็บไว้จนกว่าผู้ใช้จะลบเอง
export function pruneGroupCodes(groups: CourseGroup[], poolCodes: ReadonlySet<string>): CourseGroup[] {
  return groups.map((group) => {
    const kept = group.codes.filter((code) => poolCodes.has(code));
    return kept.length === group.codes.length ? group : { ...group, codes: kept };
  });
}

export function groupOfCode(groups: CourseGroup[], code: string): CourseGroup | undefined {
  return groups.find((group) => group.codes.includes(code));
}

// วิชาเดี่ยวที่ติ๊ก + กลุ่มที่มีสมาชิกติ๊กอยู่ (กลุ่มละ 1 ช่อง)
export function countPlannerSlots(selectedCodes: string[], groups: CourseGroup[]): number {
  const grouped = new Set(groups.flatMap((group) => group.codes));
  const singles = selectedCodes.filter((code) => !grouped.has(code)).length;
  const tickedGroups = groups.filter((group) => group.codes.some((code) => selectedCodes.includes(code))).length;
  return singles + tickedGroups;
}
