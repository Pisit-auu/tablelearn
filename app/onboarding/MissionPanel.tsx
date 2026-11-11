"use client";

import { useEffect } from "react";
import type { MissionId, OnboardingProgress } from "./progress.ts";
import { missions, type MissionIcon } from "./tours.ts";

const iconPaths: Record<MissionIcon | "check" | "trophy" | "close" | "chevron", string[]> = {
  check: ["M20 6 9 17l-5-5"],
  map: ["M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z", "M8 2v16", "M16 6v16"],
  crane: ["M12 2v4", "M5 6h14l-2 6H7z", "M9 12v8", "M15 12v8", "M6 20h12"],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  compare: ["M16 3l4 4-4 4", "M20 7H4", "M8 21l-4-4 4-4", "M4 17h16"],
  people: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  trophy: ["M8 21h8", "M12 17v4", "M7 4h10v5a5 5 0 0 1-10 0z", "M17 5h3v2a3 3 0 0 1-3 3", "M7 5H4v2a3 3 0 0 0 3 3"],
  close: ["M18 6 6 18", "M6 6l12 12"],
  chevron: ["M9 18l6-6-6-6"],
};

function Icon({ name }: { name: keyof typeof iconPaths }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function MissionPanel({
  progress,
  open,
  onOpenChange,
  onStart,
  notice,
}: {
  progress: OnboardingProgress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (id: MissionId) => void;
  notice: string | null;
}) {
  const doneCount = missions.filter((mission) => progress.done.includes(mission.id)).length;
  const total = missions.length;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) {
    if (doneCount === total) {
      return null;
    }

    return (
      <button type="button" className="mission-launcher" onClick={() => onOpenChange(true)} aria-label={`ภารกิจเริ่มต้นใช้งาน สำเร็จแล้ว ${doneCount} จาก ${total}`}>
        <Icon name="trophy" />
        ภารกิจ <b>{doneCount}/{total}</b>
      </button>
    );
  }

  return (
    <section className="mission-panel" role="dialog" aria-modal="false" aria-labelledby="mission-title">
      <header className="mission-head">
        <span className="mission-badge"><Icon name="trophy" /></span>
        <h2 id="mission-title">ภารกิจเริ่มต้นใช้งาน</h2>
        <button type="button" className="btn btn-icon" aria-label="ปิด" onClick={() => onOpenChange(false)}>
          <Icon name="close" />
        </button>
      </header>

      <div className="mission-meter">
        <p>คุณทำภารกิจสำเร็จไปแล้ว <b>{doneCount}/{total}</b></p>
        <span className="mission-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount} aria-label="ความคืบหน้าภารกิจ">
          <i style={{ width: `${(doneCount / total) * 100}%` }} />
        </span>
      </div>

      {notice && <p className="status-line is-clash mission-notice" role="status">{notice}</p>}

      <ul className="mission-list">
        {missions.map((mission) => {
          const isDone = progress.done.includes(mission.id);
          return (
            <li key={mission.id}>
              <button type="button" className={isDone ? "mission-item is-done" : "mission-item"} onClick={() => onStart(mission.id)}>
                <span className="mission-ico"><Icon name={isDone ? "check" : mission.icon} /></span>
                <span className="mission-label">{mission.label}</span>
                {isDone ? <span className="mission-tag">สำเร็จแล้ว</span> : <Icon name="chevron" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
