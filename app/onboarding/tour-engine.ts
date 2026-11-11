import type { MissionId } from "./progress.ts";

// สถานะของหน้าเว็บเท่าที่บทพาทำต้องรู้ เพื่อตัดสินว่าแต่ละขั้นทำเสร็จหรือยัง
export type TourSnapshot = {
  canEdit: boolean;
  browserOpen: boolean;
  searchResultCount: number;
  plannerPoolCount: number;
  generatedPlanCount: number;
  courseCount: number;
  planCount: number;
  inRoom: boolean;
  done: MissionId[];
};

export type TourStep = {
  id: string;
  title: string;
  body: string;
  // ชื่อใน data-tour ที่จะไฮไลต์ หลายชื่อจะรวมเป็นกรอบเดียว ว่างไว้ = การ์ดกลางจอ
  targets: string[];
  // ส่วนของหน้าที่ต้องกางและเลื่อนไปหาก่อนแสดงขั้นนี้
  zone?: string;
} & ({ kind: "action"; isDone: (snapshot: TourSnapshot) => boolean } | { kind: "info"; nextLabel: string });

export type Tour = { mission: MissionId; requiresEdit: boolean; steps: TourStep[] };

// ขั้นปัจจุบันคือขั้นแรกที่ยังไม่เสร็จเสมอ ผู้ใช้ทำย้อนหลุดเมื่อไหร่ก็ถอยกลับไปเอง (-1 = จบบท)
export function resolveStep(tour: Tour, snapshot: TourSnapshot, acked: ReadonlySet<string>): number {
  return tour.steps.findIndex((step) => (step.kind === "action" ? !step.isDone(snapshot) : !acked.has(step.id)));
}
