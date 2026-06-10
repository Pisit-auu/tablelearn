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
};

export type SharedPlanPayload = {
  name: string;
  courses: SharedCoursePayload[];
};

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
const sql = connectionString ? postgres(connectionString, { ssl: "require" }) : null;

async function ensureSchema() {
  if (!sql) {
    throw new Error("ยังไม่ได้ตั้งค่า POSTGRES_URL หรือ DATABASE_URL");
  }

  await sql`
    create table if not exists shared_plans (
      id text primary key,
      name text not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists shared_courses (
      id text primary key,
      plan_id text not null references shared_plans(id) on delete cascade,
      data jsonb not null,
      position integer not null default 0
    )
  `;
}

export async function getSharedPlan(id: string) {
  await ensureSchema();

  const plans = await sql!`select id, name from shared_plans where id = ${id}`;

  if (plans.length === 0) {
    return null;
  }

  const courses = await sql!`
    select data
    from shared_courses
    where plan_id = ${id}
    order by position asc
  `;

  return {
    id: plans[0].id as string,
    name: plans[0].name as string,
    courses: courses.map((course) => course.data as SharedCoursePayload),
  };
}

export async function saveSharedPlan(id: string, payload: Partial<SharedPlanPayload>) {
  await ensureSchema();

  const name = payload.name?.trim() || "ตารางเรียนแชร์";
  const courses = payload.courses ?? [];

  await sql!.begin(async (transaction) => {
    await transaction`
      insert into shared_plans (id, name, updated_at)
      values (${id}, ${name}, now())
      on conflict (id)
      do update set name = excluded.name, updated_at = now()
    `;

    await transaction`delete from shared_courses where plan_id = ${id}`;

    for (const [index, course] of courses.entries()) {
      await transaction`
        insert into shared_courses (id, plan_id, data, position)
        values (${course.id}, ${id}, ${transaction.json(course)}, ${index})
      `;
    }
  });

  return { id, name, courses };
}
