"use client";

import { useEffect, useRef, useState } from "react";
import { maxGroupNameLength, nextMenuIndex, type CourseGroup } from "./course-groups.ts";

// ปุ่ม "ย้ายเข้ากลุ่ม ▾" กดเลือกกลุ่ม (ไม่ใช้ลากวาง ใช้บนมือถือได้) ปิดเมื่อเลือก กด Esc หรือกดนอกเมนู
export function GroupMoveMenu({ groups, onMove, onCreate }: { groups: CourseGroup[]; onMove: (groupId: string) => void; onCreate: () => void }) {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // เมนูอยู่ในรายการที่เลื่อนได้ (สูงสุด 420px) จึงวางแบบ fixed ตามตำแหน่งปุ่ม ไม่ให้โดนตัด และไม่ล้นจอ
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }

    const box = buttonRef.current?.getBoundingClientRect();
    if (box) {
      const width = 220;
      // สูงไม่เกินจอ (CSS จำกัด max-height และเลื่อนในเมนูได้เมื่อมีกลุ่มเยอะ)
      const height = Math.min(44 + (groups.length + 1) * 38, window.innerHeight - 24);
      const left = Math.min(Math.max(12, box.right - width), window.innerWidth - width - 12);
      const below = box.bottom + 6;
      const top = below + height > window.innerHeight - 12 ? Math.max(12, box.top - 6 - height) : below;
      setSpot({ top, left });
    }
    setOpen(true);
  };

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
        buttonRef.current?.focus();
      }
    };
    // เลื่อนหน้า = ปิดเมนู (ตำแหน่ง fixed จะไม่ตรงปุ่มแล้ว) แต่เลื่อนในตัวเมนูเองไม่ปิด
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    // เปิดแล้วโฟกัสรายการแรก ให้ใช้คีย์บอร์ดต่อได้ทันที
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="group-move" ref={rootRef}>
      <button ref={buttonRef} type="button" className={open ? "btn btn-quiet is-on" : "btn btn-quiet"} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        ย้ายเข้ากลุ่ม ▾
      </button>
      {open && (
        <div
          ref={menuRef}
          className="group-move-menu"
          role="menu"
          style={spot ?? undefined}
          onKeyDown={(event) => {
            const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
            const next = nextMenuIndex(items.indexOf(document.activeElement as HTMLButtonElement), event.key, items.length);
            if (next !== null) {
              event.preventDefault();
              items[next]?.focus();
            }
          }}
        >
          {groups.map((group) => (
            <button key={group.id} type="button" role="menuitem" onClick={() => choose(() => onMove(group.id))}>
              {group.name}
            </button>
          ))}
          {groups.length > 0 && <hr />}
          <button type="button" role="menuitem" onClick={() => choose(onCreate)}>
            + กลุ่มใหม่…
          </button>
        </div>
      )}
    </div>
  );
}

// ชื่อกลุ่มแก้ได้ในที่ Enter/ออกจากช่อง = บันทึก Esc = ยกเลิก (ชื่อว่างจะคงชื่อเดิม)
export function GroupNameInput({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const [value, setValue] = useState(name);
  const cancelled = useRef(false);

  return (
    <input
      className="pick-group-name"
      value={value}
      maxLength={maxGroupNameLength}
      aria-label="ชื่อกลุ่ม"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        if (!cancelled.current && value.trim() && value.trim() !== name) {
          onCommit(value);
        } else {
          setValue(name);
        }
        cancelled.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          cancelled.current = true;
          setValue(name);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
