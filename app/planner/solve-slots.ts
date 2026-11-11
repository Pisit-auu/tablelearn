// ค้นหาชุดตัวเลือกให้แต่ละช่อง: ช่องวิชาเดี่ยวต้องได้เสมอ ช่องกลุ่มได้ 1 ตัว
// และข้ามกลุ่มได้เฉพาะเมื่อใส่ไม่ได้จริง (คืนแผนที่ครอบคลุมจำนวนกลุ่มมากที่สุดเท่าที่ทำได้)
export type Slot<T> = { id: string; kind: "single" | "group"; options: T[]; cap?: number };
export type SlotSolution<T> = { picks: (T | null)[]; skipped: string[] };

export function solveSlots<T>(
  slots: Slot<T>[],
  fits: (chosen: T[]) => boolean,
  opts: { perSlotCap: number; maxResults: number },
): SlotSolution<T>[] {
  // กรองตัวเลือกที่ชนกับวิชาที่คงไว้ก่อน แล้วค่อยตัดเพดาน ตัวเลือกที่ลงได้จะไม่หลุดเพราะอยู่ท้ายรายการ
  const candidates = slots.map((slot) => slot.options.filter((option) => fits([option])).slice(0, slot.cap ?? opts.perSlotCap));

  if (slots.some((slot, index) => slot.kind === "single" && candidates[index].length === 0)) {
    return [];
  }

  const groupCount = slots.filter((slot) => slot.kind === "group").length;

  for (let allowedSkips = 0; allowedSkips <= groupCount; allowedSkips += 1) {
    const results: SlotSolution<T>[] = [];
    const picks: (T | null)[] = [];

    const walk = (index: number, chosen: T[], skipped: string[]) => {
      if (results.length >= opts.maxResults) {
        return;
      }

      if (index === slots.length) {
        results.push({ picks: [...picks], skipped: [...skipped] });
        return;
      }

      for (const option of candidates[index]) {
        const next = [...chosen, option];
        if (!fits(next)) {
          continue;
        }
        picks.push(option);
        walk(index + 1, next, skipped);
        picks.pop();
        if (results.length >= opts.maxResults) {
          return;
        }
      }

      if (slots[index].kind === "group" && skipped.length < allowedSkips) {
        picks.push(null);
        walk(index + 1, chosen, [...skipped, slots[index].id]);
        picks.pop();
      }
    };

    walk(0, [], []);
    if (results.length > 0) {
      return results;
    }
  }

  return [];
}
