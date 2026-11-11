"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultProgress, markMission, parseProgress, progressStorageKey, shouldAutoOpen, type MissionId, type OnboardingProgress } from "./progress.ts";
import { resolveStep, type TourSnapshot } from "./tour-engine.ts";
import { tours } from "./tours.ts";

export const readOnlyTourNotice = "ห้องนี้เป็นโหมดดูอย่างเดียว จึงเริ่มบทพาทำนี้ไม่ได้";

export function useOnboarding(snapshot: Omit<TourSnapshot, "done">, opts: { onUnfoldZone: (zoneId: string) => void }) {
  const [progress, setProgress] = useState<OnboardingProgress>(defaultProgress);
  const [loaded, setLoaded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTour, setActiveTour] = useState<MissionId | null>(null);
  const [acked, setAcked] = useState<ReadonlySet<string>>(() => new Set());
  // ภารกิจที่เคยสำเร็จแล้ว ถ้าเริ่มพาทำซ้ำต้องทำจริงอีกรอบ ไม่ใช่ข้ามไปขั้นสุดท้าย
  const [completedInTour, setCompletedInTour] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { onUnfoldZone } = opts;

  // อ่านหลัง mount (เหมือนตารางใน page.tsx) กัน hydration ไม่ตรงกับ HTML จากเซิร์ฟเวอร์
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(progressStorageKey);
      } catch {
        stored = null;
      }

      let next = parseProgress(stored);
      const hasRoomParam = new URLSearchParams(window.location.search).has("room");
      if (shouldAutoOpen(next, hasRoomParam)) {
        next = { ...next, panelSeen: true };
        setPanelOpen(true);
      }

      setProgress(next);
      setLoaded(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    try {
      window.localStorage.setItem(progressStorageKey, JSON.stringify(progress));
    } catch {
      // บันทึกไม่ได้ (โหมดส่วนตัว/บล็อก) ก็ใช้ต่อได้ แค่จำไม่ได้
    }
  }, [loaded, progress]);

  const tourSnapshot = useMemo<TourSnapshot>(
    () => ({
      ...snapshot,
      done: progress.done.filter((id) => id !== activeTour || completedInTour),
    }),
    [snapshot, progress.done, activeTour, completedInTour],
  );

  const tour = activeTour ? tours[activeTour] : null;
  const stepIndex = tour ? resolveStep(tour, tourSnapshot, acked) : -1;
  const step = tour && stepIndex >= 0 ? tour.steps[stepIndex] : null;

  const completeMission = useCallback(
    (id: MissionId) => {
      setProgress((current) => markMission(current, id));
      if (id === activeTour) {
        setCompletedInTour(true);
      }
    },
    [activeTour],
  );

  // ครบทุกขั้นแล้วปิดบททันทีระหว่าง render ไม่ปล่อยค้าง เพราะถ้าสถานะถอยภายหลังบทจะเด้งกลับมาเอง
  if (activeTour && stepIndex === -1) {
    if (activeTour === "tour" && !progress.done.includes("tour")) {
      setProgress(markMission(progress, "tour"));
    }
    setActiveTour(null);
  }

  const stepZone = step?.zone;
  const stepId = step?.id;
  useEffect(() => {
    if (stepZone) {
      onUnfoldZone(stepZone);
    }
  }, [stepId, stepZone, onUnfoldZone]);

  const startTour = useCallback(
    (id: MissionId) => {
      if (tours[id].requiresEdit && !snapshot.canEdit) {
        setNotice(readOnlyTourNotice);
        setPanelOpen(true);
        return;
      }

      setNotice(null);
      setAcked(new Set());
      setCompletedInTour(false);
      setPanelOpen(false);
      setActiveTour(id);
    },
    [snapshot.canEdit],
  );

  const skipTour = useCallback(() => setActiveTour(null), []);
  const ackStep = useCallback((id: string) => setAcked((current) => new Set(current).add(id)), []);

  return { progress, panelOpen, setPanelOpen, activeTour, tour, stepIndex, startTour, skipTour, ackStep, completeMission, notice };
}
