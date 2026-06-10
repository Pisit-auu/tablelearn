"use server";

import { getSharedPlan, saveSharedPlan, type SharedCoursePayload } from "../lib/shared-plans-store";

function validateShareId(id: string) {
  if (!/^[A-Za-z0-9-]{3,64}$/.test(id)) {
    throw new Error("รหัสลิงก์แชร์ไม่ถูกต้อง");
  }
}

export async function loadSharedPlanAction(id: string) {
  validateShareId(id);

  const plan = await getSharedPlan(id);

  if (!plan) {
    throw new Error("ไม่พบตารางที่แชร์");
  }

  return plan;
}

export async function saveSharedPlanAction(
  id: string,
  payload: {
    name: string;
    courses: SharedCoursePayload[];
  },
) {
  validateShareId(id);

  return saveSharedPlan(id, payload);
}
