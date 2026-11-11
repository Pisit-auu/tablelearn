"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { helpCopy, type HelpZone } from "./help-copy.ts";
import type { MissionId } from "./progress.ts";

export function HelpButton({ zone, onStartTour }: { zone: HelpZone; onStartTour: (id: MissionId) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const popId = useId();
  const copy = helpCopy[zone];
  const popRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  // จอแคบ ป๊อปอัปอาจล้นขวา เลื่อนกลับเข้ามาให้อยู่ในจอ (ไม่ให้หน้าเลื่อนซ้ายขวา)
  // วัดจากตำแหน่งปุ่ม + ความกว้างป๊อปอัป (ไม่ขยับตาม translate) คำนวณครั้งเดียวตอนเปิด กันวนวัดซ้ำไม่จบ
  useLayoutEffect(() => {
    if (!open || !popRef.current || !rootRef.current) {
      return;
    }

    const anchorLeft = rootRef.current.getBoundingClientRect().left;
    const right = anchorLeft + popRef.current.offsetLeft + popRef.current.offsetWidth;
    const overflow = Math.ceil(right - (document.documentElement.clientWidth - 12));
    setShift(overflow > 0 ? overflow : 0);
  }, [open]);

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
        <span className="help-pop" id={popId} role="note" ref={popRef} style={shift ? { translate: `${-shift}px 0` } : undefined}>
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
