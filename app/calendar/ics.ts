// สร้างไฟล์ปฏิทิน .ics (RFC 5545) จากตารางเรียน เพื่อนำเข้า Google Calendar / Apple Calendar / Outlook
// วันที่ทั้งหมดคำนวณเป็นวันตามปฏิทินล้วน ไม่ขึ้นกับ timezone ของเครื่องผู้ใช้

export type IcsCourse = {
  id: string;
  code: string;
  name: string;
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  start: string;
  end: string;
  room: string;
  teacher: string;
  midterm: string;
  final: string;
};

const weekdayIndex: Record<IcsCourse["day"], number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const examDuration = "PT3H";

function parseDay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("รูปแบบวันที่ไม่ถูกต้อง");
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function dayStamp(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function localStamp(date: Date, time: string) {
  return `${dayStamp(date)}T${time.replace(":", "")}00`;
}

function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// พับบรรทัดที่ยาวเกิน 75 octets โดยไม่ตัดกลางตัวอักษร UTF-8
function foldLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(courses: IcsCourse[], range: { firstDay: string; lastDay: string }, now: Date): string {
  const first = parseDay(range.firstDay);
  const last = parseDay(range.lastDay);
  if (last < first) {
    throw new Error("วันสุดท้ายต้องไม่ก่อนวันแรก");
  }

  const stamp = utcStamp(now);
  // 23:59:59 เวลาไทยของวันสุดท้าย = 16:59:59 UTC
  const until = `${dayStamp(last)}T165959Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TableLearn//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Bangkok",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:+07",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const course of courses) {
    const offset = (weekdayIndex[course.day] - first.getUTCDay() + 7) % 7;
    const date = new Date(first.getTime() + offset * 86_400_000);
    if (date > last) {
      continue;
    }
    lines.push(
      "BEGIN:VEVENT",
      `UID:${course.id}@tablelearn`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Bangkok:${localStamp(date, course.start)}`,
      `DTEND;TZID=Asia/Bangkok:${localStamp(date, course.end)}`,
      `RRULE:FREQ=WEEKLY;UNTIL=${until}`,
      `SUMMARY:${escapeText(`${course.code} ${course.name}`.trim())}`,
    );
    if (course.room && course.room.trim() !== "-") lines.push(`LOCATION:${escapeText(course.room)}`);
    if (course.teacher) lines.push(`DESCRIPTION:${escapeText(`อาจารย์: ${course.teacher}`)}`);
    lines.push("END:VEVENT");
  }

  const seenExams = new Set<string>();
  for (const course of courses) {
    for (const [kind, label, value] of [
      ["midterm", "สอบกลางภาค", course.midterm],
      ["final", "สอบปลายภาค", course.final],
    ] as const) {
      const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
      const key = `${course.code}|${kind}|${value}`;
      if (!match || seenExams.has(key)) continue;
      seenExams.add(key);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${course.code}-${kind}-${match[1]}${match[2].replace(":", "")}@tablelearn`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Bangkok:${localStamp(parseDay(match[1]), match[2])}`,
        `DURATION:${examDuration}`,
        `SUMMARY:${escapeText(`${label} ${course.code}`)}`,
        `DESCRIPTION:${escapeText("ตรวจเวลาสอบล่าสุดที่ reg.kmutnb.ac.th")}`,
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function defaultIcsRange(today: Date): { firstDay: string; lastDay: string } {
  const date = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const offset = (1 - date.getUTCDay() + 7) % 7;
  const first = new Date(date.getTime() + offset * 86_400_000);
  const last = new Date(first.getTime() + 109 * 86_400_000);
  return { firstDay: isoDay(first), lastDay: isoDay(last) };
}
