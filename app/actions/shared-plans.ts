"use server";

import { getSharedPlan, saveSharedPlan, type SharedCoursePayload, type SharedRoomPlanPayload } from "../lib/shared-plans-store";

export async function loadSharedPlanAction(id: string) {
  const plan = await getSharedPlan(id);

  if (!plan) {
    throw new Error("ไม่พบห้องนี้");
  }

  return plan;
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
) {
  return saveSharedPlan(id, payload);
}
