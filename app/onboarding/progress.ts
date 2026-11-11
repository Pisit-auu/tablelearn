export type MissionId = "tour" | "planner" | "lock" | "compare" | "room";

export type OnboardingProgress = { version: 1; panelSeen: boolean; done: MissionId[] };

export const missionIds: readonly MissionId[] = ["tour", "planner", "lock", "compare", "room"];

export const progressStorageKey = "tablelearn-onboarding";

export const defaultProgress: OnboardingProgress = { version: 1, panelSeen: false, done: [] };

function isMissionId(value: unknown): value is MissionId {
  return typeof value === "string" && (missionIds as readonly string[]).includes(value);
}

// อ่านความคืบหน้าที่บันทึกไว้ ถ้ารูปร่างไม่ตรงให้เริ่มใหม่แทนที่จะพังทั้งหน้า
export function parseProgress(raw: string | null): OnboardingProgress {
  if (!raw) {
    return defaultProgress;
  }

  try {
    const value = JSON.parse(raw) as Partial<OnboardingProgress> | null;
    if (!value || value.version !== 1) {
      return defaultProgress;
    }

    const done = Array.isArray(value.done) ? value.done.filter(isMissionId) : [];
    return { version: 1, panelSeen: value.panelSeen === true, done: [...new Set(done)] };
  } catch {
    return defaultProgress;
  }
}

export function markMission(progress: OnboardingProgress, id: MissionId): OnboardingProgress {
  if (progress.done.includes(id)) {
    return progress;
  }

  return { ...progress, done: [...progress.done, id] };
}

// เปิดแผงภารกิจเองแค่ครั้งแรก และไม่เปิดทับห้องของเพื่อนที่เข้ามาผ่านลิงก์
export function shouldAutoOpen(progress: OnboardingProgress, hasRoomParam: boolean): boolean {
  return !progress.panelSeen && !hasRoomParam;
}
