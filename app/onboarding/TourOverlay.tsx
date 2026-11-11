"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MissionId } from "./progress.ts";
import type { Tour } from "./tour-engine.ts";

type Rect = { top: number; left: number; width: number; height: number };

const pad = 6;
const cardWidth = 300;
const gap = 16;
const mobileQuery = "(max-width: 900px)";

function isVisible(element: Element) {
  return element.getClientRects().length > 0;
}

// รวมกรอบของทุกเป้าหมายในขั้นนี้ ใช้ตัวแรกที่มองเห็นของแต่ละชื่อ
function measureTargets(names: string[]): Rect | null {
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const name of names) {
    const element = Array.from(document.querySelectorAll(`[data-tour="${name}"]`)).find(isVisible);
    if (!element) {
      continue;
    }

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

function placeCard(rect: Rect, cardHeight: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampTop = (value: number) => Math.min(Math.max(12, value), vh - cardHeight - 12);
  const clampLeft = (value: number) => Math.min(Math.max(12, value), vw - cardWidth - 12);

  if (rect.left + rect.width + gap + cardWidth <= vw - 12) {
    return { top: clampTop(rect.top), left: rect.left + rect.width + gap };
  }
  if (rect.left - gap - cardWidth >= 12) {
    return { top: clampTop(rect.top), left: rect.left - gap - cardWidth };
  }
  if (rect.top + rect.height + gap + cardHeight <= vh - 12) {
    return { top: rect.top + rect.height + gap, left: clampLeft(rect.left) };
  }
  return { top: clampTop(rect.top - gap - cardHeight), left: clampLeft(rect.left) };
}

export function TourOverlay({
  tour,
  stepIndex,
  onAck,
  onSkip,
  onStartTour,
}: {
  tour: Tour;
  stepIndex: number;
  onAck: (stepId: string) => void;
  onSkip: () => void;
  onStartTour: (id: MissionId) => void;
}) {
  const step = tour.steps[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [cardHeight, setCardHeight] = useState(180);
  const cardRef = useRef<HTMLDivElement>(null);
  const targetKey = step.targets.join(",");

  // ติดตามตำแหน่งเป้าหมายทุกเฟรม เป้าหมายอาจโผล่ทีหลัง (หน้าต่างเปิด ผลค้นหามา) หรือขยับตอนเลื่อนจอ
  useEffect(() => {
    const names = targetKey ? targetKey.split(",") : [];
    let frame = 0;
    let last: Rect | null = null;
    const tick = () => {
      const next = names.length > 0 ? measureTargets(names) : null;
      if (!sameRect(next, last)) {
        last = next;
        setRect(next);
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
      const element = Array.from(document.querySelectorAll(`[data-tour="${names[0]}"]`)).find(isVisible);
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
      if (event.key === "Escape") {
        onSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const isAction = step.kind === "action";
  const cardStyle = !isMobile && rect ? placeCard(rect, cardHeight) : undefined;
  const titleId = `tour-title-${tour.mission}`;

  return (
    <div className="tour" data-mobile={isMobile ? "true" : undefined}>
      {rect ? (
        <div className={isAction ? "tour-spot is-action" : "tour-spot"} style={rect} aria-hidden="true" />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      {rect && isAction && (
        <span className="tour-hand" style={{ top: rect.top + rect.height - 4, left: rect.left + Math.min(rect.width / 2, 60) }} aria-hidden="true">
          👆
        </span>
      )}

      <div
        ref={cardRef}
        className={cardStyle ? "tour-card" : "tour-card is-docked"}
        style={cardStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
      >
        <p className="tour-step">ขั้นที่ {stepIndex + 1} จาก {tour.steps.length}</p>
        <h2 id={titleId}>{step.title}</h2>
        <p className="tour-body" aria-live="polite">{step.body}</p>

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
          <button type="button" className="btn btn-primary tour-next" onClick={() => onAck(step.id)}>
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
