"use server";

import { headers } from "next/headers";
import { clientKeyFromHeaders, isRateLimited } from "../api/rate-limit";
import { FeedbackError, saveFeedback } from "../lib/feedback-store";

export type FeedbackResult = { ok: true } | { ok: false; error: string };

export async function sendFeedbackAction(message: string): Promise<FeedbackResult> {
  try {
    const client = clientKeyFromHeaders(await headers());

    if (isRateLimited(`feedback:${client}`, 5, 10 * 60_000)) {
      return { ok: false, error: "ส่งข้อเสนอแนะถี่เกินไป กรุณาลองใหม่ภายหลัง" };
    }

    await saveFeedback(message);
    return { ok: true };
  } catch (error) {
    if (error instanceof FeedbackError) {
      return { ok: false, error: error.message };
    }

    console.error("feedback action failed", error);
    return { ok: false, error: "ส่งข้อเสนอแนะไม่สำเร็จ กรุณาลองใหม่ภายหลัง" };
  }
}
