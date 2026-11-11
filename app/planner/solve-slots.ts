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
  // แต่ละชุด "กลุ่มที่ถูกข้าม" ได้โควตาของตัวเอง แผนที่ครอบคลุมกลุ่ม B จะไม่หายเพราะแผนที่ครอบคลุม A มาก่อนจนเต็ม
  const perSkipSet = Math.max(1, Math.floor(opts.maxResults / Math.max(1, groupCount)));
  const buckets = new Map<string, SlotSolution<T>[]>();
  let best = Infinity;
  let total = 0;
  const picks: (T | null)[] = [];

  // ค้นรอบเดียวแบบตัดกิ่ง: ลองใส่ตัวเลือกก่อนข้ามเสมอ และไม่เดินกิ่งที่ข้ามกลุ่มมากกว่าแผนที่ดีที่สุดที่เจอแล้ว
  const walk = (index: number, chosen: T[], skipped: string[]) => {
    if (total >= opts.maxResults || skipped.length > best) {
      return;
    }

    if (index === slots.length) {
      if (skipped.length < best) {
        best = skipped.length;
        buckets.clear();
        total = 0;
      }
      const key = skipped.join("\u0000");
      const bucket = buckets.get(key) ?? [];
      if (bucket.length < perSkipSet) {
        bucket.push({ picks: [...picks], skipped: [...skipped] });
        buckets.set(key, bucket);
        total += 1;
      }
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
      if (total >= opts.maxResults) {
        return;
      }
    }

    if (slots[index].kind === "group" && skipped.length + 1 <= best) {
      picks.push(null);
      walk(index + 1, chosen, [...skipped, slots[index].id]);
      picks.pop();
    }
  };

  walk(0, [], []);
  return [...buckets.values()].flat();
}

// เลือกแผนที่จะแสดง: เก็บแผนที่ดีที่สุดของแต่ละชุด "กลุ่มที่ถูกข้าม" ก่อน แล้วเติมที่เหลือตามคะแนน
// (ไม่ให้แผนที่ครอบคลุมกลุ่ม B หายไปหมดเพราะแผนที่ครอบคลุมกลุ่ม A คะแนนสูงกว่า)
export function selectTopPlans<P>(plans: P[], limit: number, score: (plan: P) => number, bucket: (plan: P) => string): P[] {
  const sorted = [...plans].sort((a, b) => score(b) - score(a));
  const seen = new Set<string>();
  const chosen = new Set<P>();
  for (const plan of sorted) {
    if (chosen.size >= limit) break;
    if (!seen.has(bucket(plan))) {
      seen.add(bucket(plan));
      chosen.add(plan);
    }
  }
  for (const plan of sorted) {
    if (chosen.size >= limit) break;
    chosen.add(plan);
  }
  return sorted.filter((plan) => chosen.has(plan));
}
