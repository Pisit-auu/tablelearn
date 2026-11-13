// อ่านวันเวลาสอบจากข้อความ classexam ของระบบทะเบียน เช่น "MIDTERM<br>12/01/70 13:00-15:00"
// ปีเป็น พ.ศ. 2 หลัก แปลงเป็น ค.ศ. start เป็น "YYYY-MM-DDTHH:MM" ส่วน end เป็น "HH:MM" หรือ "" ถ้าไม่มี
export function parseExamSlot(value: string, type: "MIDTERM" | "FINAL"): { start: string; end: string } {
  const clean = value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  const match = clean.match(new RegExp(`${type}\\s+(\\d{2})/(\\d{2})/(\\d{2})\\s+(\\d{2}:\\d{2})(?:\\s*-\\s*(\\d{2}:\\d{2}))?`, "i"));

  if (!match) {
    return { start: "", end: "" };
  }

  const gregorianYear = 2500 + Number(match[3]) - 543;
  return { start: `${gregorianYear}-${match[2]}-${match[1]}T${match[4]}`, end: match[5] ?? "" };
}
