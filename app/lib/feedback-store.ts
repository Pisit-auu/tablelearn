import { requireSql } from "./db";

export const maxFeedbackLength = 100;

export class FeedbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedbackError";
  }
}

// Counts characters as the user sees them, so a Thai vowel mark or an emoji
// is not charged as two.
export function feedbackLength(text: string) {
  return Array.from(text).length;
}

export function sanitizeFeedback(value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();

  if (!text) {
    throw new FeedbackError("กรุณาพิมพ์ข้อเสนอแนะก่อนส่ง");
  }

  if (feedbackLength(text) > maxFeedbackLength) {
    throw new FeedbackError(`ข้อเสนอแนะต้องยาวไม่เกิน ${maxFeedbackLength} ตัวอักษร`);
  }

  return text;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  const db = requireSql();

  if (!schemaReady) {
    schemaReady = (async () => {
      await db`
        create table if not exists feedback (
          id bigserial primary key,
          message text not null check (char_length(message) <= 100),
          created_at timestamptz not null default now()
        )
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  return schemaReady;
}

export async function saveFeedback(value: unknown) {
  const message = sanitizeFeedback(value);
  await ensureSchema();
  await requireSql()`insert into feedback (message) values (${message})`;
}
