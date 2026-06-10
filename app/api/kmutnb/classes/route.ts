import { fetchCompressedJson, getToken } from "../_utils";

function pathSegment(value: string | null, fallback: string, emptyFallback = fallback) {
  const trimmed = value?.trim();
  const segment = value === null ? fallback : trimmed || emptyFallback;

  if (!/^[A-Za-z0-9-]+$/.test(segment)) {
    return null;
  }

  return segment;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const academicYear = searchParams.get("year") ?? "2569";
  const semester = searchParams.get("semester") ?? "1";
  const campusId = pathSegment(searchParams.get("campus"), "10", "0");
  const divisionCode = pathSegment(searchParams.get("division"), "-");
  const levelId = pathSegment(searchParams.get("level"), "61", "0");
  const facultyId = pathSegment(searchParams.get("faculty"), "4", "0");
  const departmentId = pathSegment(searchParams.get("department"), "406", "0");
  const courseCode = pathSegment(searchParams.get("courseCode"), "-");
  const courseName = pathSegment(searchParams.get("courseName"), "-");
  const classSet = pathSegment(searchParams.get("classSet"), "-");
  const officerId = pathSegment(searchParams.get("officer"), "0");

  if (
    !/^\d{4}$/.test(academicYear) ||
    !/^[1-3]$/.test(semester) ||
    !campusId ||
    !divisionCode ||
    !levelId ||
    !facultyId ||
    !departmentId ||
    !courseCode ||
    !courseName ||
    !classSet ||
    !officerId
  ) {
    return Response.json({ error: "ตัวกรองรายวิชาไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const token = await getToken();
    const classes = await fetchCompressedJson(
      `Classinfo/Classinfo/${academicYear}/${semester}/${campusId}/${divisionCode}/${levelId}/${facultyId}/${departmentId}/${courseCode}/${courseName}/${classSet}/${officerId}`,
      token,
    );

    return Response.json(classes);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "ไม่สามารถดึงข้อมูลรายวิชาจากระบบทะเบียนได้" },
      { status: 502 },
    );
  }
}
