---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/globals.css","app/layout.tsx"]
---

## Scope

`app/page.tsx` — the whole product. TableLearn is a single route; every capability (week face, saved courses, planner, plan comparison, free time, exam schedule, shared room, the two dialogs) lives on it.

## Visitor mode

Operate. The student is completing a task under deadline pressure during KMUTNB registration week. Expression may never obscure the task, the state, or a familiar affordance.

## Audience and job

KMUTNB undergraduates choosing sections. The job: get every course placed without a time collision or an exam collision, keep a backup plan, and know exactly what to click when registration opens.

## Task and information order

The page is ordered by how the job actually runs, not by feature parity:

1. **หน้าตัด (face)** — plan controls, then the collision/exam weather strip, then the week grid. Collisions surface above the grid because they are the reason the student opened the page.
2. **รายวิชาที่บันทึก** — the block inventory with lock / edit / delete.
3. **ตัวช่วยจัดแผน** — three benches: loaded courses, time constraints, generated plans with score and reasons.
4. **เปรียบเทียบ 2 แผน** — a real `<table>`, because it is tabular data being compared.
5. **เวลาว่าง + ตารางสอบ** — paired row.
6. **ห้องตารางร่วมกัน** — collaboration last; it is a mode, not a step.
7. **หมายเหตุการใช้งาน** — the disclaimer, in the footer, still legible.

A left strata rail (desktop) / fixed bottom dock (mobile) indexes those zones with exactly one active tab, driven by an IntersectionObserver.

## Chosen direction

**Cloud Quarry** — a catalog challenger the user adopted over the assigned roll (concept seed `7e83ad0f`). A week is a quarry face; each section is a block cut out of it; free hours are the sky-void left behind; a time collision is a bad cut, shown as a thunder-hatched fracture with a fracture-red cut face.

## Memorable moment

**The cut.** A course block enters with a saw-silver light pass sweeping across it and a short settle. It fires on mount, so switching plans visibly re-cuts the whole face. Disabled under `prefers-reduced-motion`.

## Constraints this surface must keep

- All Thai copy stays verbatim, including the disclaimer and the reg.kmutnb.ac.th attribution.
- Mono (`--font-num`) is for numerals and times only; Thai text must never fall into the mono fallback.
- The colour on a course is user data. Blocks derive their fill, cut face, and text from `--cut` via `color-mix`; any new block surface must keep contrast at that derivation.
- Desktop shows the full 07:00-20:00 week without horizontal scrolling at 1440px; mobile defaults to the day-list view.
- No rounded cards, no soft drop shadows, no pastel chips. The chamfered cut is the only corner language.

## Ceiling left unspent

The finish review judged the build's ceiling "not reached" against the Cloud Quarry reference boards, and named four unused devices, none of them defects: display lettering at poster scale, panel z-stacking, a drawn depth-blue outer frame with cut corners (currently the blue is a gutter the panels float in, not a frame), and ornament density.

Its ranked steer, if a ceiling pass is ever funded:

1. **The drawn outer frame** — a depth-blue rule with cut corners bounding each panel. It makes every panel read as cut *out of* the ground rather than laid *on* it, and buys more than the other three combined.
2. **Extending the crosshairs** past `.zone` to `.readout`, the planner sub-panels, `.cut-block` and the modal — the cheapest of the four now that the marks render.
3. Panel z-stacking, then a second motion moment.

## Known engine limits, deliberately not fought

- `text-overflow: ellipsis` on `<select>` is honoured by Chromium and WebKit, not Gecko; Firefox clips the long faculty and department values without an ellipsis. The right padding keeps the value clear of the chevron in every engine, which was the actual collision. Replacing the native select with a custom listbox is not worth losing the platform picker on mobile.
- `datetime-local` and `time` render in the browser's own locale, so the exam fields can show `mm/dd/yyyy` and a 12-hour clock beside the week face's 24-hour times. A hint under the field names the order; the native pickers stay.

## Unresolved

- The seven course pigments were swapped to quarry strata colours; timetables already saved in localStorage keep their older colours and will read slightly off-world until edited.
- Backlog items 6 and 7 (import from image/text, curriculum templates) have no surface yet.
