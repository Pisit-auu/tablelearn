import postgres from "postgres";

const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

// One connection pool per server process, shared by every store.
export const sql = connectionString ? postgres(connectionString, { ssl: "require" }) : null;

export function requireSql() {
  if (!sql) {
    throw new Error("ยังไม่ได้ตั้งค่า POSTGRES_URL หรือ DATABASE_URL");
  }

  return sql;
}
