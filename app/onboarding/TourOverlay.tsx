"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MissionId } from "./progress.ts";
import { dockSide, placeCard, type Rect } from "./placement.ts";
import type { Tour } from "./tour-engine.ts";

const pad = 6;
const cardWidth = 300;
const mobileQuery = "(max-width: 900px)";

function isVisible(element: Element) {
  return element.getClientRects().length > 0;
}

// รวมกรอบของทุกเป้าหมายที่มองเห็นในขั้นนี้ (ชื่อเดียวอาจติดหลายชิ้น เช่น ตัวกรอง + ปุ่มค้นหา)
function measureTargets(names: string[]): Rect | null {
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  const elements = names.flatMap((name) => Array.from(document.querySelectorAll(`[data-tour="${name}"]`)).filter(isVisible));
  for (const element of elements) {
    const box = element.getBoundingClientRect();
    top = Math.min(top, box.top);
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
    bottom = Math.max(bottom, box.bottom);
  }

  if (top === Infinity) {
    return null;
  }

  return { top: top - pad, left: left - pad, width: right - left + pad * 2, height: bottom - top + pad * 2 };
}

function sameRect(a: Rect | null, b: Rect | null) {
  return a === b || (!!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);
}

export function TourOverlay({
  tour,
  stepIndex,
  onAck,
  onSkip,
  onStartTour,
  hint,
}: {
  tour: Tour;
  stepIndex: number;
  onAck: (stepId: string) => void;
  onSkip: () => void;
  onStartTour: (id: MissionId) => void;
  hint: string | null;
}) {
  const step = tour.steps[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);
  // มือชี้ไปที่เป้าหมายตัวสุดท้ายในรายการ (ปุ่มที่ต้องกด) ไม่ใช่มุมของกรอบรวม
  const [handRect, setHandRect] = useState<Rect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [cardHeight, setCardHeight] = useState(180);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const targetKey = step.targets.join(",");

  // ติดตามตำแหน่งเป้าหมายทุกเฟรม เป้าหมายอาจโผล่ทีหลัง (หน้าต่างเปิด ผลค้นหามา) หรือขยับตอนเลื่อนจอ
  useEffect(() => {
    const names = targetKey ? targetKey.split(",") : [];
    let frame = 0;
    let last: Rect | null = null;
    let lastHand: Rect | null = null;
    const tick = () => {
      const next = names.length > 0 ? measureTargets(names) : null;
      if (!sameRect(next, last)) {
        last = next;
        setRect(next);
      }
      const hand = names.length > 0 ? measureTargets(names.slice(-1)) : null;
      if (!sameRect(hand, lastHand)) {
        lastHand = hand;
        setHandRect(hand);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [targetKey]);

  // เลื่อนไปหาเป้าหมายเมื่อเปลี่ยนขั้น รอสักครู่เผื่อส่วนที่ย่ออยู่กางออก
  useEffect(() => {
    const names = targetKey ? targetKey.split(",") : [];
    if (names.length === 0) {
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      // เลื่อนไปหาปุ่มที่ต้องกด (ชื่อสุดท้าย) ไม่ใช่กรอบแรก บนมือถือกรอบแรกอาจยาวจนปุ่มหลุดจอ
      const element = Array.from(document.querySelectorAll(`[data-tour="${names[names.length - 1]}"]`)).filter(isVisible).at(-1);
      if (element) {
        element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        return;
      }
      if (tries++ < 10) {
        timer = window.setTimeout(attempt, 100);
      }
    };
    timer = window.setTimeout(attempt, 60);
    return () => window.clearTimeout(timer);
  }, [step.id, targetKey]);

  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (cardRef.current) {
      setCardHeight(cardRef.current.offsetHeight);
    }
  }, [step.id, isMobile]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Esc ปิดชั้นบนสุดก่อน ถ้ามีหน้าต่างค้นหาเปิดอยู่ให้หน้าต่างนั้นปิดไป บทพาทำยังอยู่
      if (event.key === "Escape" && !document.querySelector(".scrim")) {
        onSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  // ให้ใช้คีย์บอร์ดได้: เริ่มบทแล้วโฟกัสการ์ด ขั้นที่ต้องกด "ถัดไป" โฟกัสปุ่มนั้น (ขั้นที่ให้ทำเองไม่แย่งโฟกัส)
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [tour.mission]);

  useEffect(() => {
    if (step.kind === "info") {
      nextRef.current?.focus({ preventScroll: true });
    }
  }, [step.id, step.kind]);

  const isAction = step.kind === "action";
  const side = isMobile ? dockSide(handRect ?? rect, cardHeight, window.innerHeight) : "bottom";
  const cardStyle = !isMobile && rect ? placeCard(rect, { width: cardWidth, height: cardHeight }, { width: window.innerWidth, height: window.innerHeight }) : undefined;
  const titleId = `tour-title-${tour.mission}`;

  return (
    <div className="tour" data-mobile={isMobile ? "true" : undefined}>
      {rect ? (
        <div className={isAction ? "tour-spot is-action" : "tour-spot"} style={rect} aria-hidden="true" />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      {handRect && isAction && (
        <span className="tour-hand" style={{ top: handRect.top + handRect.height - 4, left: handRect.left + Math.min(handRect.width / 2, 60) }} aria-hidden="true">
          👆
        </span>
      )}

      <div
        ref={cardRef}
        className={cardStyle ? "tour-card" : side === "top" ? "tour-card is-docked is-top" : "tour-card is-docked"}
        tabIndex={-1}
        style={cardStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
      >
        <p className="tour-step">ขั้นที่ {stepIndex + 1} จาก {tour.steps.length}</p>
        <h2 id={titleId}>{step.title}</h2>
        <p className="tour-body" aria-live="polite">{step.body}</p>
        {hint && <p className="tour-hint" role="status">{hint}</p>}

        {step.kind === "action" ? (
          <p className="tour-wait">
            <i aria-hidden="true" />
            รอคุณทำขั้นนี้…
          </p>
        ) : null}

        {tour.mission === "lock" && step.id === "need-courses" && (
          <button type="button" className="btn btn-primary tour-next" onClick={() => onStartTour("planner")}>
            เริ่มภารกิจจัดแผน
          </button>
        )}
        {step.kind === "info" && (
          <button ref={nextRef} type="button" className="btn btn-primary tour-next" onClick={() => onAck(step.id)}>
            {step.nextLabel}
          </button>
        )}

        <div className="tour-foot">
          <span className="tour-dots" aria-hidden="true">
            {tour.steps.map((item, index) => (
              <i key={item.id} className={index <= stepIndex ? "is-on" : undefined} />
            ))}
          </span>
          <button type="button" className="link-btn" onClick={onSkip}>
            ข้ามบทเรียน
          </button>
        </div>
      </div>
    </div>
  );
}
