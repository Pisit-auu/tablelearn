// พารามิเตอร์ของ /api/kmutnb/classes จากตัวกรองในหน้าต่างดึงรายวิชา
// เมื่อเปิดจากแค็ตตาล็อก GE (มี catalog) ไม่ส่งคณะ/ภาควิชา/กลุ่มเรียนที่ตั้งค้างไว้ และใช้วิทยาเขตของแค็ตตาล็อกถ้าระบุ
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

export type CatalogQuery = { courseCode: string; campusId?: string };

export function classQueryParams(filters: ClassQueryFilters, catalog?: CatalogQuery): URLSearchParams {
  const fromCatalog = catalog !== undefined;
  const params = new URLSearchParams({
    year: filters.academicYear,
    semester: filters.semester,
    campus: catalog?.campusId ?? filters.campusId,
    division: filters.divisionCode,
    level: filters.levelId,
    faculty: fromCatalog ? "" : filters.facultyId,
    department: fromCatalog ? "" : filters.departmentId,
  });
  const courseCode = catalog?.courseCode ?? filters.courseSearch.trim();

  if (courseCode) {
    params.set("courseCode", courseCode);
  }

  if (filters.classSet && !fromCatalog) {
    params.set("classSet", filters.classSet);
  }

  return params;
}
