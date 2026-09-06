---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/globals.css","app/layout.tsx"]
---

## Scope

`app/page.tsx` — the whole product. TableLearn is a single route; every capability (week grid, saved courses, planner, plan comparison, free time, exam schedule, shared room, the two dialogs) lives on it.

## Visitor mode

Operate. The student is completing a task under deadline pressure during KMUTNB registration week. Expression may never obscure the task, the state, or a familiar affordance.

## Audience and job

KMUTNB undergraduates choosing sections. The job: get every course placed without a time clash or an exam clash, keep a backup plan, and know exactly what to click when registration opens.

## Task and information order

The page is ordered by how the job actually runs, not by feature parity:

1. **ตารางเรียนสัปดาห์นี้** — plan controls, then the clash/exam alert strip, then the week grid. Clashes surface above the grid because they are the reason the student opened the page.
2. **รายวิชาที่บันทึก** — the course inventory with lock / edit / delete.
3. **ตัวช่วยจัดแผน** — three benches: loaded courses, time constraints, generated plans with score and reasons.
4. **เปรียบเทียบ 2 แผน** — a real `<table>`, because it is tabular data being compared.
5. **เวลาว่าง + ตารางสอบ** — paired row.
6. **ห้องตารางร่วมกัน** — collaboration last; it is a mode, not a step.
7. **หมายเหตุการใช้งาน** — the disclaimer, in the footer, still legible.

A left menu (desktop) / fixed bottom dock (mobile) indexes those zones with exactly one active tab, driven by an IntersectionObserver.

## Chosen direction

**Registrar Console** — pinned by the user to `reg.kmutnb.ac.th/registrar/home`, overriding direction seed `c92d1359`. The planner wears the KMUTNB registrar system's own theme (Vision Net / Vuexy), so the tab the student switches to from the real registrar feels like the same desk. Palette, radii, shadows, control metrics, and the active-nav gradient were read off the registrar's live stylesheet rather than approximated. The pinned theme is recorded as a brand commitment in PRODUCT.md, so it governs later work too.

Continuity is deliberate; impersonation is not. No university mark, no claim of affiliation, and the footer disclaimer stays.

## Memorable moment

**The week reads like the registrar's own class table.** Each block is a field tinted in its own course pigment at 9%, and a time clash is the only red on the page — a red field, a red border, and the word `ชนกัน` on a pill, never colour alone.

## Constraints this surface must keep

- All Thai copy stays verbatim, including the disclaimer and the reg.kmutnb.ac.th attribution.
- **Thai never takes `letter-spacing` or `text-transform: uppercase`** — it breaks cluster rendering. Tracking is for Latin room codes only.
- The colour on a course is user data. It appears as a 9% tinted field on the week grid and as an 8px dot beside the course code everywhere else, derived from `--course`; it may never become a thick edge stripe.
- Red `#ea5455` is reserved for a time clash and amber `#ff9f43` for exam risk. No course pigment may sit in either family.
- Desktop shows the full 07:00–20:00 week without horizontal scrolling at 1440px; mobile defaults to the day-list view.
- Under 900px every zone but the week folds by default (`data-folded` plus a chevron disclosure; the bottom dock unfolds the zone it links to). This is what keeps the phone's first load near 3,600 CSS px instead of 9,700.

## Known engine limits, deliberately not fought

- `text-overflow: ellipsis` on `<select>` is honoured by Chromium and WebKit, not Gecko; Firefox clips the long faculty and department values without an ellipsis. The right padding keeps the value clear of the chevron in every engine.
- `datetime-local` and `time` render in the browser's own locale, so the exam fields can show `mm/dd/yyyy` and a 12-hour clock beside the week grid's 24-hour times. A hint under the field names the order; the native pickers stay.

## Unresolved

- Timetables already saved in localStorage keep their Cloud Quarry pigments and will read slightly off-theme until edited. The `#a32d67` magenta in particular sits close to the clash red; only new courses get the replacement `#7b3fa0`.
- Backlog items 6 and 7 (import from image/text, curriculum templates) have no surface yet.
