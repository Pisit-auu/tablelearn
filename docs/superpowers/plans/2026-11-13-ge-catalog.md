# GE Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มส่วน "วิชาศึกษาทั่วไป" ในแถบเมนูของ TableLearn แสดงรายวิชา GE จากเล่มฉบับปี 2566 (รหัส ชื่อ หน่วยกิต กลุ่ม) พร้อมตัวกรองกลุ่ม ช่องค้นหา และปุ่ม "ดูกลุ่มเรียน" ที่โหลดกลุ่มเรียนของวิชานั้นในหน้าต่างดึงรายวิชาเดิม

**Architecture:** ข้อมูลรายวิชาเป็นไฟล์ TS คงที่ คู่กับ pure function สำหรับกรองและค้นหา (ทดสอบด้วย `node --test`) ส่วน UI เป็น zone ใหม่ใน `app/page.tsx` ตามแบบของ zone ที่มีอยู่ ปุ่ม "ดูกลุ่มเรียน" ใช้ `loadRemoteClasses` เดิม แต่ให้ฟังก์ชันรับรหัสวิชาเป็นพารามิเตอร์ได้

**Tech Stack:** Next.js 16 App Router (client component), React 19, CSS ธรรมดาใน `app/globals.css`, Node 22 `node --test` (type stripping)

**Spec:** `docs/superpowers/specs/2026-11-13-ge-catalog-design.md`

## Global Constraints
- ข้อความ UI เป็นภาษาไทยทั้งหมด ใช้ธีม reg.kmutnb ที่มีอยู่ (คลาสเดิมใน `globals.css`) ห้ามเพิ่ม UI library
- แต่ละวิชาแสดงแค่ รหัส ชื่อไทย/อังกฤษ หน่วยกิต กลุ่ม และป้าย "บังคับ" / "เปิดเฉพาะ CIT" ห้ามใส่คำอธิบายรายวิชา วิชาบังคับก่อน GELOs หรือนิยามคำว่า "วิชาเสรี"
- บรรทัดแหล่งที่มา (ข้อความตายตัว): `รายวิชาจากเล่มรายวิชาศึกษาทั่วไป ฉบับปี พ.ศ. 2566` ลิงก์ไปที่ `GE_SOURCE_URL` (เปิดแท็บใหม่ `rel="noreferrer"`)
- `GE_SOURCE_URL` ใช้ลิงก์เต็มจากผู้ใช้ ถ้ายังไม่ได้รับ ให้ใช้ `https://acdserv.kmutnb.ac.th/` ชั่วคราว และแจ้งผู้ใช้ตอนส่งงาน
- ห้ามแตะการตั้งค่า Next และ API route งานนี้เป็นฝั่ง client ล้วน

## Review Focus
- ค้นหาด้วยรหัสที่มีช่องว่างหน้า/หลัง หรือพิมพ์ภาษาอังกฤษตัวเล็ก/ใหญ่ปน ต้องยังเจอวิชา → test `filterGeCourses trims and ignores case`
- ค้นหาด้วยชื่อไทยบางส่วน (เช่น "จิตวิทยา") ต้องเจอทุกวิชาที่มีคำนั้น → test `filterGeCourses matches Thai name substring`
- รหัสวิชาในข้อมูลต้องไม่ซ้ำ และเป็นตัวเลข 9 หลักทุกตัว ถ้าข้อมูลที่ดึงจาก PDF เพี้ยน test ต้องจับได้ → test `ge data codes are unique 9-digit`
- กด "ดูกลุ่มเรียน" ตอนที่ช่องค้นหาในหน้าต่างดึงรายวิชามีค่าอื่นค้างอยู่ ต้องโหลดรหัสของวิชาที่กด ไม่ใช่ค่าเก่า → ตรวจด้วยมือใน Task 2 Step 5
- กด "ดูกลุ่มเรียน" ขณะที่ตารางที่เปิดอยู่เป็นแบบดูอย่างเดียว ต้องยังเปิดดูกลุ่มเรียนได้ (ปุ่มนำเข้าในหน้าต่างถูกปิดอยู่แล้วตามเดิม) → ตรวจด้วยมือใน Task 2 Step 5

---

### Task 1: ข้อมูลรายวิชา GE และตัวกรอง

**Files:**
- Create: `app/ge/ge-courses.ts`
- Create: `app/ge/ge-courses.test.ts`
- Modify: `package.json` (สคริปต์ `test` เพิ่ม `"app/ge/*.test.ts"`)

**Interfaces:**
- Produces:
  - `export type GeGroupId = "language" | "entrepreneur" | "century21" | "quality" | "sport"`
  - `export const geGroups: { id: GeGroupId; label: string; short: string }[]` เรียงตามลำดับนี้:
    - `language`: "กลุ่มเสริมสร้างทักษะการใช้ภาษาและการสื่อสาร" / "ภาษาและการสื่อสาร"
    - `entrepreneur`: "กลุ่มเสริมสร้างทักษะการเป็นผู้ประกอบการและสร้างนวัตกรรม" / "ผู้ประกอบการฯ"
    - `century21`: "กลุ่มเสริมสร้างทักษะในศตวรรษที่ 21" / "ศตวรรษที่ 21"
    - `quality`: "กลุ่มเสริมสร้างคุณภาพชีวิตและวิถีพลเมืองที่ดี" / "คุณภาพชีวิตฯ"
    - `sport`: "ชุดวิชากีฬาและนันทนาการ" / "กีฬาและนันทนาการ"
  - `export type GeCourse = { code: string; nameTh: string; nameEn: string; credits: string; group: GeGroupId; required?: true; citOnly?: true }` (`credits` เก็บเป็นรูปแบบเล่ม เช่น `"3(3-0-6)"`)
  - `export const geCourses: GeCourse[]`
  - `export const GE_SOURCE_URL: string`
  - `export function filterGeCourses(courses: GeCourse[], group: GeGroupId | "", query: string): GeCourse[]` คืนค่าตามลำดับเดิม query ตัดช่องว่างหน้า/หลังและไม่สนตัวพิมพ์ใหญ่/เล็ก จับคู่แบบ substring กับ `code`, `nameTh`, `nameEn` ถ้า `group` เป็น `""` แปลว่าทุกกลุ่ม

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่านใน `app/ge/ge-courses.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterGeCourses, geCourses, geGroups, type GeCourse } from "./ge-courses.ts";

const c = (code: string, nameTh: string, nameEn: string, group: GeCourse["group"]): GeCourse => ({ code, nameTh, nameEn, credits: "3(3-0-6)", group });
const sample = [
  c("080303103", "จิตวิทยาเพื่อความสุขในการดำรงชีวิต", "Psychology for Happy Life", "quality"),
  c("080303802", "จิตวิทยาดิจิทัล", "Digital Psychology", "century21"),
  c("080303503", "แบดมินตัน", "Badminton", "sport"),
];

test("filterGeCourses with empty group and query returns all in order", () => {
  assert.deepEqual(filterGeCourses(sample, "", "").map((x) => x.code), ["080303103", "080303802", "080303503"]);
});
test("filterGeCourses filters by group", () => {
  assert.deepEqual(filterGeCourses(sample, "sport", "").map((x) => x.code), ["080303503"]);
});
test("filterGeCourses trims and ignores case", () => {
  assert.deepEqual(filterGeCourses(sample, "", "  badMINTON ").map((x) => x.code), ["080303503"]);
  assert.deepEqual(filterGeCourses(sample, "", " 0803038").map((x) => x.code), ["080303802"]);
});
test("filterGeCourses matches Thai name substring", () => {
  assert.deepEqual(filterGeCourses(sample, "", "จิตวิทยา").map((x) => x.code), ["080303103", "080303802"]);
});
test("filterGeCourses combines group and query", () => {
  assert.deepEqual(filterGeCourses(sample, "quality", "จิตวิทยา").map((x) => x.code), ["080303103"]);
});
test("ge data codes are unique 9-digit", () => {
  const codes = geCourses.map((x) => x.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^\d{9}$/);
});
test("ge data is complete and uses known groups", () => {
  assert.equal(geCourses.length, 139);
  const ids = new Set(geGroups.map((g) => g.id));
  for (const x of geCourses) {
    assert.ok(ids.has(x.group), x.code);
    assert.ok(x.nameTh && x.nameEn, x.code);
    assert.match(x.credits, /^\d\(\d-\d-\d\)$/, x.code);
  }
  assert.deepEqual(geCourses.filter((x) => x.required).map((x) => x.code).sort(), ["080103001", "080103002", "080103063", "080203914", "080303701"]);
  assert.equal(geCourses.filter((x) => x.citOnly).length, 8);
});
```

- [ ] **Step 2: รัน test ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test app/ge/ge-courses.test.ts`
Expected: FAIL ด้วย error ว่าหา module `./ge-courses.ts` ไม่เจอ

- [ ] **Step 3: สร้าง `app/ge/ge-courses.ts`**
- ไล่ type, `geGroups` และ `filterGeCourses` ตาม Interfaces ด้านบน
- สร้าง `geCourses` ด้วยสคริปต์จากไฟล์ที่ดึงจาก PDF ไว้แล้ว `/tmp/claude-1000/-mnt-d-Dev-web-timetable/726b09ce-2b99-4aa3-8078-1fa2493e787c/scratchpad/ge.json`
  - เอาเฉพาะแถวที่ `kind !== "intl"` (ได้ 139 แถว) แล้วยุบช่องว่างซ้อนในชื่อวิชา
  - แปลงกลุ่ม: `ภาษาและการสื่อสาร`→`language`, `ผู้ประกอบการและสร้างนวัตกรรม`→`entrepreneur`, `ศตวรรษที่ 21`→`century21`, `คุณภาพชีวิตและวิถีพลเมือง`→`quality`, `กีฬาและนันท`→`sport`
  - แปลงประเภท: `kind === "req"` ใส่ `required: true` และ `kind === "cit"` ใส่ `citOnly: true`
  - เขียนออกเป็น array literal หนึ่งบรรทัดต่อหนึ่งวิชา
- ใส่ comment หัวไฟล์ภาษาไทยว่าข้อมูลมาจากเล่มรายวิชาศึกษาทั่วไป ฉบับปี พ.ศ. 2566 ส่วน มจพ. กรุงเทพฯ/ปราจีนบุรี ไม่รวมวิชาของหลักสูตรนานาชาติ
- ตั้งค่า `GE_SOURCE_URL` ตาม Global Constraints

- [ ] **Step 4: เพิ่ม `"app/ge/*.test.ts"` ในสคริปต์ `test` ของ `package.json` แล้วรัน test ทั้งหมด**

Run: `npm test`
Expected: PASS ทุก test ทั้งของเดิมและของใหม่ `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add app/ge/ge-courses.ts app/ge/ge-courses.test.ts package.json
git commit -m "feat(ge): add 2566 general-education course data and filter"
```

### Task 2: ส่วน "วิชาศึกษาทั่วไป" ใน UI

**Files:**
- Modify: `app/page.tsx`
  - `zones` (~บรรทัด 964) เพิ่ม zone ใหม่ต่อจาก `blocks`
  - `loadRemoteClasses` (~บรรทัด 2779)
  - เพิ่ม `<section id="ge">` ต่อจาก section `blocks` (~บรรทัด 3168–3243)
- Modify: `app/onboarding/help-copy.ts` (เพิ่ม `"ge"` ใน `HelpZone` และ entry ใน `helpCopy`)
- Modify: `app/globals.css` (style ของรายการ GE)

**Interfaces:**
- Consumes: `geCourses`, `geGroups`, `filterGeCourses`, `GE_SOURCE_URL`, `type GeGroupId` จาก `./ge/ge-courses` (Task 1)
- Produces:
  - `loadRemoteClasses(courseCodeOverride?: string): Promise<void>` ถ้าส่งรหัสมา ให้ใช้รหัสนั้นเป็น `courseCode` แทน `courseSearch` ที่อยู่ใน state
  - zone id `"ge"` และ `HelpZone` ที่มี `"ge"`

- [ ] **Step 1: ทำให้ `loadRemoteClasses` รับรหัสวิชาเป็นพารามิเตอร์ได้**
- เพิ่มพารามิเตอร์ `courseCodeOverride?: string` ถ้ามีค่า ให้ใช้แทน `courseSearch.trim()`
- จุดที่เรียกฟังก์ชันอยู่แล้วต้องเรียกแบบไม่ส่งอาร์กิวเมนต์ ถ้าเจอ `onClick={loadRemoteClasses}` ให้เปลี่ยนเป็น `onClick={() => loadRemoteClasses()}` เพื่อไม่ให้ event object หลุดเข้าไปเป็นรหัสวิชา

- [ ] **Step 2: เพิ่ม zone ใหม่และคำช่วยเหลือ**
- `zones` เพิ่ม `{ id: "ge", label: "วิชาศึกษาทั่วไป", short: "GE", Icon: IconBlock }` ต่อจาก `blocks`
- `helpCopy.ge` ใช้ข้อความตายตัวนี้
  - title: `"วิชาศึกษาทั่วไป"`
  - body: `"รายวิชาศึกษาทั่วไป (GE) ตามเล่มฉบับปี 2566 กรองตามกลุ่มหรือค้นหาด้วยรหัสและชื่อวิชา กด “ดูกลุ่มเรียน” เพื่อดูว่าเทอมที่เลือกเปิดกลุ่มไหนบ้าง แล้วนำเข้าตารางได้เลย"`
- zone ใหม่ต้องพับไว้เป็นค่าเริ่มต้น ซึ่งได้อยู่แล้วจาก `foldedZones` เพราะพับทุก zone ยกเว้น `face`

- [ ] **Step 3: เพิ่ม `<section className="zone" id="ge">` ต่อจาก section `blocks`**
- ส่วนหัวทำแบบเดียวกับ `blocks`: ปุ่มพับ/ขยาย, `h2#ge-title` "วิชาศึกษาทั่วไป", `<HelpButton zone="ge" …/>`
- ใต้หัวข้อมีย่อหน้าแหล่งที่มา: `รายวิชาจากเล่มรายวิชาศึกษาทั่วไป ฉบับปี พ.ศ. 2566` ทำเป็นลิงก์ไป `GE_SOURCE_URL`
- state ใหม่: `geGroup: GeGroupId | ""` (ค่าเริ่มต้น `""`) และ `geQuery: string`
- ตัวกรอง:
  - ช่องค้นหาที่มี `aria-label="ค้นหาวิชาศึกษาทั่วไป"`
  - ปุ่มเลือกกลุ่มที่ใช้ `aria-pressed` มี "ทั้งหมด" ตามด้วย `geGroups[].short`
  - ข้อความนับจำนวน: `แสดง {n} จาก {geCourses.length} วิชา`
- รายการ: จัดตาม `geGroups` แสดงหัวข้อกลุ่มเฉพาะกลุ่มที่ยังมีวิชาหลังกรอง แต่ละแถวมี
  - รหัส (ฟอนต์ตัวเลข), ชื่อไทย, ชื่ออังกฤษ (สีจาง), หน่วยกิต
  - ป้าย "บังคับ" ถ้า `required` และป้าย "เปิดเฉพาะ CIT" ถ้า `citOnly` พร้อม `title="เล่มระบุว่าเปิดให้นักศึกษาวิทยาลัยเทคโนโลยีอุตสาหกรรมเท่านั้น"`
  - ปุ่ม `btn btn-line` "ดูกลุ่มเรียน" ทำงานเป็น `setCourseSearch(code); setIsCourseBrowserOpen(true); void loadRemoteClasses(code);`
- ถ้ากรองแล้วไม่เหลือวิชา: แสดง `<p className="empty">ไม่พบวิชาที่ตรงกับคำค้นหรือกลุ่มที่เลือก</p>`
- เรียก `filterGeCourses` ผ่าน `useMemo` ตาม `geGroup` และ `geQuery`

- [ ] **Step 4: เพิ่ม CSS ใน `app/globals.css`**
- ใช้ตัวแปรสีและขนาดเดิมของธีม ไม่ตั้งสีใหม่ตรง ๆ
- แต่ละแถวเป็น grid: รหัส | ชื่อ | หน่วยกิต | ปุ่ม และที่ความกว้าง ≤ 720px ให้ซ้อนเป็นสองบรรทัด
- ป้าย "บังคับ" ใช้สีหลัก ป้าย CIT ใช้สีเตือนที่ธีมมีอยู่
- ปุ่มเลือกกลุ่มขึ้นบรรทัดใหม่ได้ (wrap) และหน้าเว็บต้องไม่เลื่อนแนวนอน

- [ ] **Step 5: ตรวจ lint, test และลองใช้จริง**

Run: `npm run lint && npm test`
Expected: ไม่มี error และ `# fail 0`

ลองบน dev server (`npm run dev` ที่พอร์ต 3005) ทั้งที่ความกว้าง 1280px และ 390px
- กดแท็บ "วิชาศึกษาทั่วไป" แล้ว zone ต้องเปิดออก ขึ้นว่า "แสดง 139 จาก 139 วิชา" และลิงก์แหล่งที่มาเปิดแท็บใหม่
- กดกลุ่ม "กีฬาและนันทนาการ" แล้วเห็นเฉพาะวิชา 1 หน่วยกิต จากนั้นพิมพ์ " badminton " ต้องเจอ 080303503
- ใส่ "010013016" ค้างไว้ในช่องค้นหาของหน้าต่างดึงรายวิชา ปิดหน้าต่าง แล้วกด "ดูกลุ่มเรียน" ของ 080303503 หน้าต่างต้องเปิดพร้อมผลของ 080303503 ไม่ใช่ 010013016 (Review Focus ข้อ 4)
- เข้าห้องแบบดูอย่างเดียวแล้วกด "ดูกลุ่มเรียน" หน้าต่างต้องเปิดและโหลดผลได้ (Review Focus ข้อ 5)

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/onboarding/help-copy.ts app/globals.css
git commit -m "feat(ge): general-education catalog zone with view-sections shortcut"
```

### Task 3: ส่งออกตารางเป็นไฟล์ปฏิทิน (.ics) สำหรับ Google Calendar

ผู้ใช้ขอเพิ่มเมื่อ 2026-11-13 และขอให้ทำแค่ "export" ผู้ใช้นำไฟล์เข้า Google Calendar เอง (Settings → Import) ไม่มี OAuth และไม่ส่งข้อมูลเข้า Google โดยตรง

**Files:**
- Create: `app/calendar/ics.ts`
- Create: `app/calendar/ics.test.ts`
- Modify: `package.json` (สคริปต์ `test` เพิ่ม `"app/calendar/*.test.ts"`)
- Modify: `app/page.tsx` (ปุ่มต่อจาก "บันทึกเป็นรูป" ~บรรทัด 3104, กล่องเลือกช่วงวันที่, การดาวน์โหลด)
- Modify: `app/globals.css` (ถ้ากล่อง dialog ที่มีอยู่ยังไม่พอ)

**Interfaces:**
- Produces:
  - `export type IcsCourse = { id: string; code: string; name: string; day: "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun"; start: string; end: string; room: string; teacher: string; midterm: string; final: string }` (`start`/`end` เป็น `"HH:MM"` ส่วน `midterm`/`final` เป็น `""` หรือ `"YYYY-MM-DDTHH:MM"` ตามที่ `parseExam` คืนค่า)
  - `export function buildIcs(courses: IcsCourse[], range: { firstDay: string; lastDay: string }, now: Date): string` (`firstDay` และ `lastDay` เป็น `"YYYY-MM-DD"` ส่วน `now` ใช้ทำ DTSTAMP) ถ้า `lastDay < firstDay` ให้ throw `Error("วันสุดท้ายต้องไม่ก่อนวันแรก")`
  - `export function defaultIcsRange(today: Date): { firstDay: string; lastDay: string }` ให้ `firstDay` เป็นวันจันทร์ถัดไป (ถ้าวันนี้เป็นวันจันทร์ ให้ใช้วันนี้) และ `lastDay` เป็นวันศุกร์ของสัปดาห์ที่ 16 นับจาก `firstDay` คือ `firstDay` + 109 วัน

**สิ่งที่ไฟล์ต้องมี:**
- `VCALENDAR` มี `PRODID:-//TableLearn//TH` และ `VTIMEZONE` ของ `Asia/Bangkok` (UTC+7 ไม่มี DST) ทุกบรรทัดลงท้ายด้วย CRLF และพับบรรทัดที่ยาวเกิน 75 octets ตามจำนวน byte ของ UTF-8 ห้ามตัดกลางตัวอักษร
- **คาบเรียน (หนึ่ง VEVENT ต่อหนึ่ง course):**
  - `DTSTART;TZID=Asia/Bangkok` เป็นวันแรกที่ ≥ `firstDay` และตรงกับ `day` ส่วน `DTEND` ใช้วันเดียวกัน เวลา `end`
  - `RRULE:FREQ=WEEKLY;UNTIL=<lastDay>T165959Z` คือ 23:59:59 เวลาไทย
  - `SUMMARY` เป็น `"<code> <name>"`, `LOCATION` เป็น room, `DESCRIPTION` เป็น `"อาจารย์: <teacher>"` (ถ้ามี) และ `UID` เป็น `<id>@tablelearn`
- **สอบ:** หนึ่ง VEVENT ต่อหนึ่งค่าสอบที่ไม่ซ้ำ โดยถือว่าซ้ำเมื่อ code + ประเภท + ค่าตรงกัน เพราะหลายคาบของ section เดียวกันมีวันสอบเดียวกัน
  - `SUMMARY` เป็น `"สอบกลางภาค <code>"` หรือ `"สอบปลายภาค <code>"`
  - `DTSTART;TZID=Asia/Bangkok` ตามค่าที่เก็บไว้ และใช้ `DURATION:PT3H` เพราะข้อมูลไม่เก็บเวลาสิ้นสุด
  - `DESCRIPTION` เป็น `"ตรวจเวลาสอบล่าสุดที่ reg.kmutnb.ac.th"`
- escape `\`, `;`, `,` และขึ้นบรรทัดใหม่ในข้อความตาม RFC 5545

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่านใน `app/calendar/ics.test.ts`** ใช้ course ตัวอย่าง `{ id:"c1", code:"080303503", name:"BADMINTON S.1", day:"wed", start:"13:00", end:"15:00", room:"52-302", teacher:"อ.ดร.ทดสอบ", midterm:"2027-01-12T13:00", final:"" }` และ `range { firstDay:"2026-11-16", lastDay:"2027-03-05" }` (16 พ.ย. 2569 เป็นวันจันทร์)
  - `buildIcs starts weekly class on first matching weekday`: ผลมี `DTSTART;TZID=Asia/Bangkok:20261118T130000`, `DTEND;TZID=Asia/Bangkok:20261118T150000` และ `RRULE:FREQ=WEEKLY;UNTIL=20270305T165959Z`
  - `buildIcs uses firstDay when it matches the weekday`: เปลี่ยน day เป็น `"mon"` แล้วต้องได้ `DTSTART;TZID=Asia/Bangkok:20261116T…`
  - `buildIcs adds one exam event per unique exam`: ใส่ course เดียวกันสองตัวที่ id ต่างกันแต่ midterm เท่ากัน ต้องได้ `SUMMARY:สอบกลางภาค 080303503` แค่ครั้งเดียว พร้อม `DTSTART;TZID=Asia/Bangkok:20270112T130000` และ `DURATION:PT3H` ส่วนจำนวน `BEGIN:VEVENT` ต้องเป็น 3
  - `buildIcs escapes text and uses CRLF`: room `"a,b;c"` ต้องได้ `LOCATION:a\,b\;c` และทุกบรรทัดต้องคั่นด้วย `\r\n` โดยไม่มี `\n` ที่ไม่มี `\r` นำหน้า
  - `buildIcs folds long lines by UTF-8 bytes`: name เป็นภาษาไทยยาว 60 ตัว ต้องไม่มีบรรทัดใดเกิน 75 byte และเมื่อ unfold (ลบ `\r\n `) แล้วต้องได้ SUMMARY เดิมครบ
  - `buildIcs rejects lastDay before firstDay`: ต้อง throw
  - `defaultIcsRange picks next Monday and 16 weeks`: `today = new Date(2026, 10, 13)` (วันศุกร์) ต้องได้ `{ firstDay: "2026-11-16", lastDay: "2027-03-05" }` และ `new Date(2026, 10, 16)` ต้องได้ firstDay `"2026-11-16"`
- [ ] **Step 2: รัน `node --test app/calendar/ics.test.ts`** Expected: FAIL เพราะหา module ไม่เจอ
- [ ] **Step 3: เขียน `app/calendar/ics.ts` ตาม Interfaces** วันที่ทั้งหมดคำนวณแบบ calendar date ล้วน (UTC date arithmetic) ไม่พึ่ง timezone ของเครื่อง
- [ ] **Step 4: เพิ่ม glob ใน `package.json` แล้วรัน `npm test`** Expected: `# fail 0`
- [ ] **Step 5: UI ใน `app/page.tsx`**
  - ปุ่ม `btn btn-line` "ส่งออกปฏิทิน" ต่อจาก "บันทึกเป็นรูป" ปิดไว้เมื่อไม่มีวิชา กดแล้วเปิด dialog แบบเดียวกับ dialog อื่น (`className="dialog"`, `role="dialog"`, `aria-modal`)
  - ใน dialog มี
    - หัวข้อ "ส่งออกเป็นปฏิทิน (.ics)"
    - คำอธิบาย: `ใช้กับ Google Calendar, Apple Calendar หรือ Outlook ได้ ใน Google Calendar ไปที่ ตั้งค่า → นำเข้าและส่งออก แล้วเลือกไฟล์นี้ ถ้านำเข้าซ้ำจะได้นัดซ้ำ แนะนำให้สร้างปฏิทินแยกไว้สำหรับตารางเรียน`
    - ช่อง `<input type="date">` สองช่อง "วันเริ่มเรียน" และ "วันเรียนวันสุดท้าย" ค่าเริ่มต้นจาก `defaultIcsRange(new Date())`
    - ปุ่ม "ดาวน์โหลดไฟล์"
  - การดาวน์โหลด: เรียก `buildIcs` กับ `shownCourses` (ไม่รวมวิชาที่ซ่อน) แล้วสร้าง Blob `text/calendar;charset=utf-8` ดาวน์โหลดเป็น `<ชื่อตาราง>.ics` ด้วยวิธีเดียวกับไฟล์ planner (~บรรทัด 2051) ถ้า throw ให้แสดงข้อความ error ใน dialog
- [ ] **Step 6: รัน `npm run lint && npm test` แล้วลองบน dev server**
  - นำวิชาเข้าตาราง 1 วิชา แล้วดาวน์โหลดไฟล์
  - เปิดไฟล์ดูว่ามี VEVENT ของคาบเรียนและสอบ
  - ตั้งวันสุดท้ายให้ก่อนวันแรก แล้วต้องเห็นข้อความ error
- [ ] **Step 7: Commit** `git commit -m "feat(calendar): export timetable as .ics for Google Calendar"`
