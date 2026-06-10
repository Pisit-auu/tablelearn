"use server";

import { getSharedPlan, saveSharedPlan, type SharedCoursePayload } from "../lib/shared-plans-store";

export async function loadSharedPlanAction(id: string) {
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
    editToken: string;
    updatedAt?: string;
  },
) {
  return saveSharedPlan(id, payload);
}
