import postgres from "postgres";

export type SharedCoursePayload = {
  id: string;
  name: string;
  code: string;
  credits: number;
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  start: string;
  end: string;
  room: string;
  teacher: string;
  midterm: string;
  final: string;
  color: string;
  locked?: boolean;
};

export type SharedRoomPlanPayload = {
  id: string;
  name: string;
  courses: SharedCoursePayload[];
};

export type SharedPlanPayload = {
  name: string;
  courses: SharedCoursePayload[];
  plans?: SharedRoomPlanPayload[];
  updatedAt?: string;
};

export type SharedPlan = {
  id: string;
  name: string;
  updatedAt: string;
  courses: SharedCoursePayload[];
  plans: SharedRoomPlanPayload[];
};

/**
 * Error whose message is safe to show to the user, with an HTTP-style status
 * (400 invalid input, 403 no edit right, 404 missing, 409 stale write).
 */
export class SharedPlanError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SharedPlanError";
    this.status = status;
  }
}

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
const sql = connectionString ? postgres(connectionString, { ssl: "require" }) : null;
const maxCoursesPerPlan = 80;
const maxPlansPerRoom = 20;
const maxTextLength = 160;
const sharedPlanRetentionDays = 30;
const expiredCleanupIntervalMs = 10 * 60_000;
const validDays = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export function validateShareId(id: string) {
  if (!/^[A-Za-z0-9-]{3,64}$/.test(id)) {
    throw new SharedPlanError("รหัสห้องไม่ถูกต้อง");
  }
}

export function validateEditToken(token: string) {
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(token)) {
    throw new SharedPlanError("รหัสแก้ไขห้องไม่ถูกต้อง");
  }
}

function trimField(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, maxTextLength);
}

function validateTime(value: unknown, fallback: string) {
  const text = trimField(value, fallback);

  if (!/^\d{2}:\d{2}$/.test(text)) {
    return fallback;
  }

  const [hour, minute] = text.split(":").map(Number);
  if (hour > 23 || minute > 59) {
    return fallback;
  }

  return text;
}

function validateDateTime(value: unknown) {
  const text = trimField(value);

  if (!text) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) || Number.isNaN(new Date(text).getTime())) {
    return "";
  }

  return text;
}

function sanitizeCourse(course: Partial<SharedCoursePayload>, index: number): SharedCoursePayload {
  const day = validDays.has(String(course.day)) ? course.day as SharedCoursePayload["day"] : "mon";
  const credits = Number(course.credits);

  return {
    id: trimField(course.id, `course-${index}`) || `course-${index}`,
    name: trimField(course.name, "ไม่ระบุชื่อวิชา"),
    code: trimField(course.code, "ไม่ระบุรหัสวิชา"),
    credits: Number.isFinite(credits) ? Math.min(Math.max(Math.round(credits), 0), 30) : 3,
    day,
    start: validateTime(course.start, "09:00"),
    end: validateTime(course.end, "10:00"),
    room: trimField(course.room),
    teacher: trimField(course.teacher),
    midterm: validateDateTime(course.midterm),
    final: validateDateTime(course.final),
    color: /^#[0-9a-f]{6}$/i.test(String(course.color ?? "")) ? String(course.color) : "#2457ff",
    ...(course.locked === true ? { locked: true } : {}),
  };
}

function sanitizePayload(payload: Partial<SharedPlanPayload>) {
  const roomPlans = Array.isArray(payload.plans) ? payload.plans : null;
  const courses = Array.isArray(payload.courses) ? payload.courses : [];
  const expectedUpdatedAt = payload.updatedAt ? new Date(payload.updatedAt) : null;

  if (roomPlans && roomPlans.length > maxPlansPerRoom) {
    throw new SharedPlanError(`ห้องบันทึกได้สูงสุด ${maxPlansPerRoom} ตาราง`);
  }

  if (roomPlans?.some((plan) => !Array.isArray(plan.courses) || plan.courses.length > maxCoursesPerPlan) || (!roomPlans && courses.length > maxCoursesPerPlan)) {
    throw new SharedPlanError(`แต่ละตารางบันทึกได้สูงสุด ${maxCoursesPerPlan} วิชา`);
  }

  if (expectedUpdatedAt && Number.isNaN(expectedUpdatedAt.getTime())) {
    throw new SharedPlanError("เวลาบันทึกห้องไม่ถูกต้อง");
  }

  const plans = roomPlans?.map((plan, index) => ({
    id: trimField(plan.id, `plan-${index}`) || `plan-${index}`,
    name: trimField(plan.name, `ตาราง${index + 1}`) || `ตาราง${index + 1}`,
    courses: plan.courses.map((course, courseIndex) => sanitizeCourse(course, courseIndex)),
  }));

  return {
    name: trimField(payload.name, "ตารางเรียนในห้อง") || "ตารางเรียนในห้อง",
    courses: courses.map((course, index) => sanitizeCourse(course, index)),
    plans,
    expectedUpdatedAt,
  };
}

function requireSql() {
  if (!sql) {
    throw new Error("ยังไม่ได้ตั้งค่า POSTGRES_URL หรือ DATABASE_URL");
  }

  return sql;
}

async function createSchema(db: NonNullable<typeof sql>) {
  await db`
    create table if not exists shared_plans (
      id text primary key,
      edit_token text,
      name text not null,
      updated_at timestamptz not null default now()
    )
  `;

  await db`
    alter table shared_plans
    add column if not exists edit_token text
  `;

  await db`
    alter table shared_plans
    add column if not exists room_plans jsonb
  `;

  await db`
    create table if not exists shared_courses (
      id text primary key,
      plan_id text not null references shared_plans(id) on delete cascade,
      data jsonb not null,
      position integer not null default 0
    )
  `;

  await db`
    create index if not exists shared_plans_updated_at_idx
    on shared_plans (updated_at)
  `;
}

// The schema DDL only needs to run once per server process, not on every
// request. A failed attempt clears the cache so the next request retries.
let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  const db = requireSql();

  if (!schemaReady) {
    schemaReady = createSchema(db).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  return schemaReady;
}

// Expired rooms are swept at most every few minutes per process rather than on
// every read, since the room sync polls the server every couple of seconds.
let lastExpiredCleanupAt = 0;

async function deleteExpiredSharedPlans() {
  const now = Date.now();

  if (now - lastExpiredCleanupAt < expiredCleanupIntervalMs) {
    return;
  }

  lastExpiredCleanupAt = now;

  try {
    await requireSql()`
      delete from shared_plans
      where updated_at < now() - (${sharedPlanRetentionDays} * interval '1 day')
    `;
  } catch (error) {
    lastExpiredCleanupAt = 0;
    console.error("shared-plans: expired cleanup failed", error);
  }
}

function formatTimestamp(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function getSharedPlan(id: string): Promise<SharedPlan | null> {
  validateShareId(id);
  await ensureSchema();
  await deleteExpiredSharedPlans();
  const db = requireSql();

  const plans = await db`select id, name, updated_at, room_plans from shared_plans where id = ${id}`;

  if (plans.length === 0) {
    return null;
  }

  const courses = await db`
    select data
    from shared_courses
    where plan_id = ${id}
    order by position asc
  `;

  const roomPlans = Array.isArray(plans[0].room_plans) ? plans[0].room_plans as SharedRoomPlanPayload[] : null;
  const legacyCourses = courses.map((course) => course.data as SharedCoursePayload);

  return {
    id: plans[0].id as string,
    name: plans[0].name as string,
    updatedAt: formatTimestamp(plans[0].updated_at),
    courses: legacyCourses,
    plans: roomPlans ?? [{ id: "main", name: plans[0].name as string, courses: legacyCourses }],
  };
}

export async function saveSharedPlan(id: string, payload: Partial<SharedPlanPayload>): Promise<SharedPlan> {
  validateShareId(id);
  await ensureSchema();
  await deleteExpiredSharedPlans();
  const db = requireSql();

  const editToken = trimField((payload as Partial<SharedPlanPayload> & { editToken?: unknown }).editToken);
  validateEditToken(editToken);
  const { name, courses, plans, expectedUpdatedAt } = sanitizePayload(payload);
  const roomPlans = plans ?? [{ id: "main", name, courses }];
  let updatedAt = "";

  await db.begin(async (transaction) => {
    const existingPlans = await transaction`select edit_token, updated_at from shared_plans where id = ${id} for update`;

    if (existingPlans.length > 0) {
      if (existingPlans[0].edit_token !== editToken && editToken !== id) {
        throw new SharedPlanError("ไม่มีสิทธิ์แก้ไขห้องนี้", 403);
      }

      if (expectedUpdatedAt && formatTimestamp(existingPlans[0].updated_at) !== expectedUpdatedAt.toISOString()) {
        throw new SharedPlanError("ห้องมีการเปลี่ยนแปลงใหม่กว่า กรุณาโหลดล่าสุดก่อนบันทึก", 409);
      }
    }

    const savedPlans = await transaction`
      insert into shared_plans (id, edit_token, name, room_plans, updated_at)
      values (${id}, ${editToken}, ${name}, ${transaction.json(roomPlans)}, now())
      on conflict (id)
      do update set name = excluded.name, room_plans = excluded.room_plans, updated_at = now()
      returning updated_at
    `;
    updatedAt = formatTimestamp(savedPlans[0].updated_at);

    await transaction`delete from shared_courses where plan_id = ${id}`;

    for (const [index, course] of roomPlans[0]?.courses.entries() ?? []) {
      await transaction`
        insert into shared_courses (id, plan_id, data, position)
        values (${course.id}, ${id}, ${transaction.json(course)}, ${index})
      `;
    }
  });

  return { id, name, updatedAt, courses: roomPlans[0]?.courses ?? [], plans: roomPlans };
}
