// พารามิเตอร์ของ /api/kmutnb/classes จากตัวกรองในหน้าต่างดึงรายวิชา
// เมื่อเปิดจากแค็ตตาล็อก GE (มี courseCodeOverride) ไม่ส่งคณะ/ภาควิชา/กลุ่มเรียนที่ตั้งค้างไว้
// เพราะวิชา GE เปิดโดยคณะอื่น ตัวกรองค้างจะทำให้ไม่เจอกลุ่มเรียน แล้วเข้าใจผิดว่าเทอมนี้ไม่เปิด
export type ClassQueryFilters = {
  academicYear: string;
  semester: string;
  campusId: string;
  divisionCode: string;
  levelId: string;
  facultyId: string;
  departmentId: string;
  classSet: string;
  courseSearch: string;
};

export function classQueryParams(filters: ClassQueryFilters, courseCodeOverride?: string): URLSearchParams {
  const fromCatalog = courseCodeOverride !== undefined;
  const params = new URLSearchParams({
    year: filters.academicYear,
    semester: filters.semester,
    campus: filters.campusId,
    division: filters.divisionCode,
    level: filters.levelId,
    faculty: fromCatalog ? "" : filters.facultyId,
    department: fromCatalog ? "" : filters.departmentId,
  });
  const courseCode = courseCodeOverride ?? filters.courseSearch.trim();

  if (courseCode) {
    params.set("courseCode", courseCode);
  }

  if (filters.classSet && !fromCatalog) {
    params.set("classSet", filters.classSet);
  }

  return params;
}
