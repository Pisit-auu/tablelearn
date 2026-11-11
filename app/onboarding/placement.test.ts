import { test } from "node:test";
import assert from "node:assert/strict";
import { placeCard, type Rect } from "./placement.ts";

const card = { width: 300, height: 200 };

function overlap(a: Rect, b: Rect) {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return Math.max(0, w) * Math.max(0, h);
}

test("prefers the right side when there is room", () => {
  const target = { top: 100, left: 20, width: 240, height: 40 };
  assert.deepEqual(placeCard(target, card, { width: 1440, height: 900 }), { top: 100, left: 276 });
});

test("goes below a wide target instead of covering it", () => {
  const target = { top: 320, left: 210, width: 1010, height: 330 };
  const spot = placeCard(target, card, { width: 1440, height: 900 });
  assert.equal(overlap({ ...spot, ...card }, target), 0);
});

test("when every side is blocked, covers as little of the target as possible", () => {
  const viewport = { width: 1000, height: 700 };
  const target = { top: 100, left: 50, width: 900, height: 500 };
  const spot = placeCard(target, card, viewport);
  const covered = overlap({ ...spot, ...card }, target);
  // ขอบล่างของจอเหลือที่ว่าง 88px ใต้เป้าหมาย การ์ดควรชิดล่างสุด ทับเป้าหมายแค่ส่วนที่เลี่ยงไม่ได้
  assert.equal(spot.top, viewport.height - card.height - 12);
  assert.ok(covered <= 300 * (200 - 88), `covered ${covered}`);
});
