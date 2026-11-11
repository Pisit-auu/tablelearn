"use client";

import { useEffect, useId, useRef, useState } from "react";
import { helpCopy, type HelpZone } from "./help-copy.ts";
import type { MissionId } from "./progress.ts";

export function HelpButton({ zone, onStartTour }: { zone: HelpZone; onStartTour: (id: MissionId) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const popId = useId();
  const copy = helpCopy[zone];

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="help" ref={rootRef}>
      <button
        type="button"
        className="help-btn"
        aria-label={`วิธีใช้ส่วน${copy.title}`}
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open && (
        <span className="help-pop" id={popId} role="note">
          <b>{copy.title}</b>
          <span>{copy.body}</span>
          {copy.tour && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setOpen(false);
                onStartTour(copy.tour as MissionId);
              }}
            >
              พาทำให้ดู →
            </button>
          )}
        </span>
      )}
    </span>
  );
}
