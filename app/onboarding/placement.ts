export type Rect = { top: number; left: number; width: number; height: number };

const margin = 12;
const gap = 16;

function overlapArea(a: Rect, b: Rect) {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return Math.max(0, w) * Math.max(0, h);
}

// วางการ์ดอธิบายข้างเป้าหมาย ห้ามบังปุ่มที่ต้องกด ถ้าไม่มีที่ว่างจริง ๆ ให้บังน้อยที่สุด
export function placeCard(
  target: Rect,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const maxTop = viewport.height - card.height - margin;
  const maxLeft = viewport.width - card.width - margin;
  const clampTop = (value: number) => Math.min(Math.max(margin, value), maxTop);
  const clampLeft = (value: number) => Math.min(Math.max(margin, value), maxLeft);

  const candidates = [
    { top: clampTop(target.top), left: target.left + target.width + gap },
    { top: clampTop(target.top), left: target.left - gap - card.width },
    { top: target.top + target.height + gap, left: clampLeft(target.left) },
    { top: target.top - gap - card.height, left: clampLeft(target.left) },
    { top: maxTop, left: margin },
    { top: maxTop, left: maxLeft },
    { top: margin, left: margin },
    { top: margin, left: maxLeft },
  ].map((spot) => ({ top: clampTop(spot.top), left: clampLeft(spot.left) }));

  let best = candidates[0];
  let bestArea = Infinity;
  for (const spot of candidates) {
    const area = overlapArea({ ...spot, ...card }, target);
    if (area < bestArea) {
      best = spot;
      bestArea = area;
    }
    if (area === 0) {
      break;
    }
  }

  return best;
}
