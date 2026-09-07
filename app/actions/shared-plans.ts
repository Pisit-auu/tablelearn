"use server";

import {
  getSharedPlan,
  saveSharedPlan,
  SharedPlanError,
  type SharedCoursePayload,
  type SharedPlan,
  type SharedRoomPlanPayload,
} from "../lib/shared-plans-store";

// Server Actions must return failures as data instead of throwing: in a
// production build Next.js replaces a thrown error's message with a generic
// English one, which would hide every Thai validation, permission and
// conflict message from the user.
export type SharedPlanResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

function failure<T>(error: unknown, fallback: string): SharedPlanResult<T> {
  if (error instanceof SharedPlanError) {
    return { ok: false, error: error.message, status: error.status };
  }

  console.error("shared-plans action failed", error);
  return { ok: false, error: fallback, status: 500 };
}

export async function loadSharedPlanAction(id: string): Promise<SharedPlanResult<SharedPlan>> {
  try {
    const plan = await getSharedPlan(id);

    if (!plan) {
      return { ok: false, error: "ไม่พบห้องนี้", status: 404 };
    }

    return { ok: true, data: plan };
  } catch (error) {
    return failure(error, "โหลดห้องไม่สำเร็จ");
  }
}

export async function saveSharedPlanAction(
  id: string,
  payload: {
    name: string;
    courses: SharedCoursePayload[];
    plans?: SharedRoomPlanPayload[];
    editToken: string;
    updatedAt?: string;
  },
): Promise<SharedPlanResult<SharedPlan>> {
  try {
    return { ok: true, data: await saveSharedPlan(id, payload) };
  } catch (error) {
    return failure(error, "บันทึกห้องไม่สำเร็จ");
  }
}
